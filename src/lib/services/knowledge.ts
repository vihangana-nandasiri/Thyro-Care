import { createHash } from "node:crypto";
import { and, eq, max } from "drizzle-orm";
import { db } from "@/db";
import { knowledgeDocuments, knowledgeVersions, reviewHistory } from "@/db/schema";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors";
import { embedText, isEmbeddingEnabled } from "@/lib/ai/embeddings";
import type { Lang } from "@/lib/i18n/config";

function hashContent(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

function slugify(title: string): string {
  return (
    title
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || `doc-${Date.now()}`
  );
}

export interface DraftInput {
  title: string;
  topic: string;
  language: Lang;
  content: string;
}

export async function createDraft(adminId: string, input: DraftInput) {
  const [document] = await db
    .insert(knowledgeDocuments)
    .values({ slug: `${slugify(input.title)}-${Date.now().toString(36)}`, createdBy: adminId })
    .returning();
  const [version] = await db
    .insert(knowledgeVersions)
    .values({
      documentId: document.id,
      versionNo: 1,
      title: input.title,
      topic: input.topic,
      language: input.language,
      content: input.content,
      contentHash: hashContent(input.content),
      createdBy: adminId,
    })
    .returning();
  return { document, version };
}

export async function updateDraft(versionId: string, actorId: string, patch: Partial<DraftInput>) {
  const current = await db.query.knowledgeVersions.findFirst({
    where: eq(knowledgeVersions.id, versionId),
  });
  if (!current) throw new NotFoundError("Draft not found.");
  if (current.status !== "draft" && current.status !== "changes_requested") {
    throw new ValidationError("Only a draft or changes-requested version can be edited.");
  }
  const nextContent = patch.content ?? current.content;
  const [updated] = await db
    .update(knowledgeVersions)
    .set({
      ...patch,
      contentHash: patch.content ? hashContent(nextContent) : current.contentHash,
    })
    .where(eq(knowledgeVersions.id, versionId))
    .returning();
  void actorId; // reserved for future author-scoping; any admin may edit any draft today
  return updated;
}

export async function createNewVersionFromApproved(
  adminId: string,
  documentId: string,
  content: string,
) {
  const document = await db.query.knowledgeDocuments.findFirst({
    where: eq(knowledgeDocuments.id, documentId),
  });
  if (!document) throw new NotFoundError("Document not found.");

  const [{ value: maxVersionNo }] = await db
    .select({ value: max(knowledgeVersions.versionNo) })
    .from(knowledgeVersions)
    .where(eq(knowledgeVersions.documentId, documentId));

  const [version] = await db
    .insert(knowledgeVersions)
    .values({
      documentId,
      versionNo: (maxVersionNo ?? 0) + 1,
      title: document.slug,
      topic: "",
      language: "en",
      content,
      contentHash: hashContent(content),
      createdBy: adminId,
    })
    .returning();
  return version;
}

export async function submitForReview(versionId: string, actorId: string) {
  const current = await db.query.knowledgeVersions.findFirst({
    where: eq(knowledgeVersions.id, versionId),
  });
  if (!current) throw new NotFoundError("Draft not found.");
  if (current.status !== "draft") {
    throw new ValidationError("Only a draft version can be submitted for review.");
  }
  const [updated] = await db
    .update(knowledgeVersions)
    .set({ status: "pending_review", submittedAt: new Date() })
    .where(eq(knowledgeVersions.id, versionId))
    .returning();
  await db.insert(reviewHistory).values({ versionId, actorId, action: "submit" });
  return updated;
}

/** Closes the changes_requested loop: lets the author edit the same
 * version (via updateDraft, now allowed for this status) and send it back
 * to review, rather than being forced to start a brand-new version. */
export async function resubmitAfterChanges(versionId: string, actorId: string) {
  const current = await db.query.knowledgeVersions.findFirst({
    where: eq(knowledgeVersions.id, versionId),
  });
  if (!current) throw new NotFoundError("Version not found.");
  if (current.status !== "changes_requested") {
    throw new ValidationError("Only a version with requested changes can be resubmitted.");
  }
  const [updated] = await db
    .update(knowledgeVersions)
    .set({ status: "pending_review", submittedAt: new Date() })
    .where(eq(knowledgeVersions.id, versionId))
    .returning();
  await db.insert(reviewHistory).values({
    versionId,
    actorId,
    action: "submit",
    comment: "Resubmitted after requested changes.",
  });
  return updated;
}

async function requireCurrentHash(versionId: string, expectedContentHash: string) {
  const current = await db.query.knowledgeVersions.findFirst({
    where: eq(knowledgeVersions.id, versionId),
  });
  if (!current) throw new NotFoundError("Version not found.");
  if (current.contentHash !== expectedContentHash) {
    throw new ConflictError("Content changed since you last viewed it. Reload and try again.");
  }
  return current;
}

/** Best-effort: retrieval still works via full-text search if this fails or
 * is disabled — a backfill script can (re)embed later. */
async function embedVersionBestEffort(versionId: string, title: string, content: string): Promise<void> {
  if (!isEmbeddingEnabled()) return;
  try {
    const embedding = await embedText(`${title}\n${content}`);
    await db.update(knowledgeVersions).set({ embedding }).where(eq(knowledgeVersions.id, versionId));
  } catch (err) {
    console.error(`Embedding failed for knowledge version ${versionId}:`, err);
  }
}

export async function approve(versionId: string, expertId: string, expectedContentHash: string) {
  const current = await requireCurrentHash(versionId, expectedContentHash);
  if (current.status !== "pending_review") {
    throw new ValidationError("Only a version pending review can be approved.");
  }
  const [updated] = await db
    .update(knowledgeVersions)
    .set({ status: "approved", decidedAt: new Date(), decidedBy: expertId })
    .where(and(eq(knowledgeVersions.id, versionId),eq(knowledgeVersions.status,"pending_review"),eq(knowledgeVersions.contentHash,expectedContentHash)))
    .returning();
  if (!updated) throw new ConflictError();
  await db
    .update(knowledgeDocuments)
    .set({ currentVersionId: versionId, status: "active" })
    .where(eq(knowledgeDocuments.id, current.documentId));
  await db.insert(reviewHistory).values({ versionId, actorId: expertId, action: "approve" });
  await embedVersionBestEffort(versionId, updated.title, updated.content);
  return updated;
}

export async function editPendingContent(versionId:string, doctorId:string, content:string, expectedContentHash:string) {
  if (!content.trim()) throw new ValidationError("Content is required.");
  return db.transaction(async tx=>{
    const [version]=await tx.update(knowledgeVersions).set({content,contentHash:hashContent(content)}).where(and(eq(knowledgeVersions.id,versionId),eq(knowledgeVersions.status,"pending_review"),eq(knowledgeVersions.contentHash,expectedContentHash))).returning();
    if(!version)throw new ConflictError("Content changed or is no longer pending review.");
    await tx.insert(reviewHistory).values({versionId,actorId:doctorId,action:"submit",comment:"Doctor edited the pending content; review remains required."});
    return version;
  });
}

export async function requestChanges(versionId: string, expertId: string, comment: string) {
  if (!comment.trim()) throw new ValidationError("A comment is required.");
  const current = await db.query.knowledgeVersions.findFirst({
    where: eq(knowledgeVersions.id, versionId),
  });
  if (!current) throw new NotFoundError("Version not found.");
  if (current.status !== "pending_review") {
    throw new ValidationError("Only a version pending review can have changes requested.");
  }
  const [updated] = await db
    .update(knowledgeVersions)
    .set({ status: "changes_requested", decidedAt: new Date(), decidedBy: expertId, decisionComment: comment })
    .where(eq(knowledgeVersions.id, versionId))
    .returning();
  await db.insert(reviewHistory).values({ versionId, actorId: expertId, action: "request_changes", comment });
  return updated;
}

export async function reject(versionId: string, expertId: string, comment: string) {
  if (!comment.trim()) throw new ValidationError("A comment is required.");
  const current = await db.query.knowledgeVersions.findFirst({
    where: eq(knowledgeVersions.id, versionId),
  });
  if (!current) throw new NotFoundError("Version not found.");
  if (current.status !== "pending_review") {
    throw new ValidationError("Only a version pending review can be rejected.");
  }
  const [updated] = await db
    .update(knowledgeVersions)
    .set({ status: "rejected", decidedAt: new Date(), decidedBy: expertId, decisionComment: comment })
    .where(eq(knowledgeVersions.id, versionId))
    .returning();
  await db.insert(reviewHistory).values({ versionId, actorId: expertId, action: "reject", comment });
  return updated;
}

export async function retire(versionId: string, actorId: string, reason: string) {
  const current = await db.query.knowledgeVersions.findFirst({
    where: eq(knowledgeVersions.id, versionId),
  });
  if (!current) throw new NotFoundError("Version not found.");
  if (current.status !== "approved") {
    throw new ValidationError("Only an approved version can be retired.");
  }
  const [updated] = await db
    .update(knowledgeVersions)
    .set({ status: "retired" })
    .where(eq(knowledgeVersions.id, versionId))
    .returning();
  await db
    .update(knowledgeDocuments)
    .set({ status: "retired" })
    .where(eq(knowledgeDocuments.id, current.documentId));
  await db.insert(reviewHistory).values({ versionId, actorId, action: "retire", comment: reason });
  return updated;
}

export async function restore(versionId: string, expertId: string, expectedContentHash: string) {
  const current = await requireCurrentHash(versionId, expectedContentHash);
  if (current.status !== "retired") {
    throw new ValidationError("Only a retired version can be restored.");
  }
  const [updated] = await db
    .update(knowledgeVersions)
    .set({ status: "approved" })
    .where(eq(knowledgeVersions.id, versionId))
    .returning();
  await db
    .update(knowledgeDocuments)
    .set({ currentVersionId: versionId, status: "active" })
    .where(eq(knowledgeDocuments.id, current.documentId));
  await db.insert(reviewHistory).values({ versionId, actorId: expertId, action: "restore" });
  await embedVersionBestEffort(versionId, updated.title, updated.content);
  return updated;
}

export async function compareVersions(versionAId: string, versionBId: string) {
  const [a, b] = await Promise.all([
    db.query.knowledgeVersions.findFirst({ where: eq(knowledgeVersions.id, versionAId) }),
    db.query.knowledgeVersions.findFirst({ where: eq(knowledgeVersions.id, versionBId) }),
  ]);
  if (!a || !b) throw new NotFoundError("Version not found.");
  return { a, b };
}

export async function listVersions(documentId: string) {
  return db.query.knowledgeVersions.findMany({
    where: eq(knowledgeVersions.documentId, documentId),
    orderBy: (v, { desc }) => [desc(v.versionNo)],
  });
}

export async function listReviewHistory(versionId: string) {
  return db.query.reviewHistory.findMany({
    where: eq(reviewHistory.versionId, versionId),
    orderBy: (h, { asc }) => [asc(h.createdAt)],
  });
}

export async function listDocuments() {
  return db.query.knowledgeDocuments.findMany({ orderBy: (d, { desc }) => [desc(d.createdAt)] });
}

export async function listDraftsAndPending() {
  return db.query.knowledgeVersions.findMany({
    where: (v, { inArray }) => inArray(v.status, ["draft", "pending_review", "changes_requested"]),
    orderBy: (v, { desc }) => [desc(v.createdAt)],
  });
}

export async function listPendingReview() {
  return db.query.knowledgeVersions.findMany({
    where: eq(knowledgeVersions.status, "pending_review"),
    orderBy: (v, { asc }) => [asc(v.submittedAt)],
  });
}

export async function getVersion(versionId: string) {
  const version = await db.query.knowledgeVersions.findFirst({
    where: eq(knowledgeVersions.id, versionId),
  });
  if (!version) throw new NotFoundError("Version not found.");
  return version;
}
