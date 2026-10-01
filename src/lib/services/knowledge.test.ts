import { test, expect } from "bun:test";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users, knowledgeDocuments, knowledgeVersions, reviewHistory } from "@/db/schema";
import {
  createDraft,
  submitForReview,
  approve,
  reject,
  requestChanges,
  retire,
  restore,
  editPendingContent,
  resubmitAfterChanges,
  updateDraft,
} from "./knowledge";
import { ConflictError, ValidationError } from "@/lib/errors";

async function createTestUsers() {
  const [admin] = await db
    .insert(users)
    .values({ email: `kb-admin.${Date.now()}@example.com`, passwordHash: "x", role: "admin" })
    .returning();
  const [expert] = await db
    .insert(users)
    .values({ email: `kb-expert.${Date.now()}@example.com`, passwordHash: "x", role: "doctor" })
    .returning();
  return { adminId: admin.id, expertId: expert.id };
}

async function cleanup(documentId: string, userIds: string[]) {
  const versions = await db.query.knowledgeVersions.findMany({
    where: eq(knowledgeVersions.documentId, documentId),
  });
  for (const v of versions) {
    await db.delete(reviewHistory).where(eq(reviewHistory.versionId, v.id));
  }
  await db.delete(knowledgeVersions).where(eq(knowledgeVersions.documentId, documentId));
  await db.delete(knowledgeDocuments).where(eq(knowledgeDocuments.id, documentId));
  await db.delete(users).where(eq(users.id, userIds[0]));
  await db.delete(users).where(eq(users.id, userIds[1]));
}

test("reject requires a non-blank comment", async () => {
  const { adminId, expertId } = await createTestUsers();
  const { document, version } = await createDraft(adminId, {
    title: "Diet after RAI",
    topic: "diet",
    language: "en",
    content: "Approved educational content.",
  });
  try {
    await submitForReview(version.id, adminId);
    await expect(reject(version.id, expertId, "")).rejects.toThrow(ValidationError);
    await expect(reject(version.id, expertId, "   ")).rejects.toThrow(ValidationError);
  } finally {
    await cleanup(document.id, [adminId, expertId]);
  }
});

test("doctor edits stay pending and invalidate stale approval hashes", async()=>{
  const {adminId,expertId}=await createTestUsers();
  const {document,version}=await createDraft(adminId,{title:"Editable review",topic:"care",language:"en",content:"Original draft."});
  try{
    await submitForReview(version.id,adminId);
    const edited=await editPendingContent(version.id,expertId,"Corrected education.",version.contentHash);
    expect(edited.status).toBe("pending_review");
    await expect(approve(version.id,expertId,version.contentHash)).rejects.toThrow(ConflictError);
    await approve(version.id,expertId,edited.contentHash);
    await expect(editPendingContent(version.id,expertId,"Cannot alter published content.",edited.contentHash)).rejects.toThrow(ConflictError);
  }finally{await cleanup(document.id,[adminId,expertId]);}
},120000);

test("requestChanges requires a non-blank comment", async () => {
  const { adminId, expertId } = await createTestUsers();
  const { document, version } = await createDraft(adminId, {
    title: "Medication reminders",
    topic: "medication",
    language: "en",
    content: "Content.",
  });
  try {
    await submitForReview(version.id, adminId);
    await expect(requestChanges(version.id, expertId, "")).rejects.toThrow(ValidationError);
  } finally {
    await cleanup(document.id, [adminId, expertId]);
  }
});

test("approve with a stale content hash throws ConflictError", async () => {
  const { adminId, expertId } = await createTestUsers();
  const { document, version } = await createDraft(adminId, {
    title: "RAI prep",
    topic: "rai",
    language: "en",
    content: "Original content.",
  });
  try {
    await submitForReview(version.id, adminId);
    await expect(approve(version.id, expertId, "not-the-real-hash")).rejects.toThrow(ConflictError);
  } finally {
    await cleanup(document.id, [adminId, expertId]);
  }
});

test("approving makes the document active and immutable, and retire/restore round-trips", async () => {
  const { adminId, expertId } = await createTestUsers();
  const { document, version } = await createDraft(adminId, {
    title: "Post-op wound care",
    topic: "wound-care",
    language: "en",
    content: "Keep the incision clean and dry.",
  });
  try {
    await submitForReview(version.id, adminId);
    const approved = await approve(version.id, expertId, version.contentHash);
    expect(approved.status).toBe("approved");

    const doc = await db.query.knowledgeDocuments.findFirst({
      where: eq(knowledgeDocuments.id, document.id),
    });
    expect(doc?.status).toBe("active");
    expect(doc?.currentVersionId).toBe(version.id);

    const retired = await retire(version.id, adminId, "outdated guidance");
    expect(retired.status).toBe("retired");

    const restored = await restore(version.id, expertId, version.contentHash);
    expect(restored.status).toBe("approved");

    const history = await db.query.reviewHistory.findMany({
      where: eq(reviewHistory.versionId, version.id),
    });
    expect(history.map((h) => h.action).sort()).toEqual(
      ["approve", "restore", "retire", "submit"].sort() as typeof history[number]["action"][],
    );
  } finally {
    await cleanup(document.id, [adminId, expertId]);
  }
});

test("changes_requested can be edited and resubmitted on the same version", async () => {
  const { adminId, expertId } = await createTestUsers();
  const { document, version } = await createDraft(adminId, {
    title: "Fatigue management",
    topic: "recovery",
    language: "en",
    content: "First draft content.",
  });
  try {
    await submitForReview(version.id, adminId);
    const changesRequested = await requestChanges(version.id, expertId, "Add more detail.");
    expect(changesRequested.status).toBe("changes_requested");

    // The dead end this closes: editing used to require status "draft".
    const edited = await updateDraft(version.id, adminId, { content: "Revised content with more detail." });
    expect(edited.status).toBe("changes_requested");
    expect(edited.content).toBe("Revised content with more detail.");

    const resubmitted = await resubmitAfterChanges(version.id, adminId);
    expect(resubmitted.status).toBe("pending_review");

    await expect(resubmitAfterChanges(version.id, adminId)).rejects.toThrow(ValidationError);

    const approved = await approve(version.id, expertId, resubmitted.contentHash);
    expect(approved.status).toBe("approved");

    const history = await db.query.reviewHistory.findMany({
      where: eq(reviewHistory.versionId, version.id),
    });
    expect(history.map((h) => h.action)).toEqual([
      "submit",
      "request_changes",
      "submit",
      "approve",
    ]);
  } finally {
    await cleanup(document.id, [adminId, expertId]);
  }
});

test("knowledge service exposes no update/delete path for review history", async () => {
  const mod = await import("./knowledge");
  expect("updateReviewHistory" in mod).toBe(false);
  expect("deleteReviewHistory" in mod).toBe(false);
});
