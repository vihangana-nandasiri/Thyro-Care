import { test, expect } from "bun:test";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users, knowledgeDocuments, knowledgeVersions, reviewHistory } from "@/db/schema";
import { createDraft, submitForReview, approve, retire } from "@/lib/services/knowledge";
import { retrieve } from "./search";

async function setup() {
  const [admin] = await db
    .insert(users)
    .values({ email: `search-admin.${Date.now()}@example.com`, passwordHash: "x", role: "admin" })
    .returning();
  const [expert] = await db
    .insert(users)
    .values({ email: `search-expert.${Date.now()}@example.com`, passwordHash: "x", role: "doctor" })
    .returning();
  return { adminId: admin.id, expertId: expert.id };
}

async function cleanup(documentIds: string[], userIds: string[]) {
  for (const documentId of documentIds) {
    const versions = await db.query.knowledgeVersions.findMany({
      where: eq(knowledgeVersions.documentId, documentId),
    });
    for (const v of versions) {
      await db.delete(reviewHistory).where(eq(reviewHistory.versionId, v.id));
    }
    await db.delete(knowledgeVersions).where(eq(knowledgeVersions.documentId, documentId));
    await db.delete(knowledgeDocuments).where(eq(knowledgeDocuments.id, documentId));
  }
  for (const id of userIds) await db.delete(users).where(eq(users.id, id));
}

test("retrieve only returns approved+active content, never retired or draft", async () => {
  const { adminId, expertId } = await setup();
  const active = await createDraft(adminId, {
    title: "Thyroidectomy scar care",
    topic: "wound-care",
    language: "en",
    content: "Keep the thyroidectomy incision site clean and moisturized once healed.",
  });
  const retired = await createDraft(adminId, {
    title: "Old scar guidance",
    topic: "wound-care",
    language: "en",
    content: "Thyroidectomy scar tissue outdated advice about ointments.",
  });
  try {
    await submitForReview(active.version.id, adminId);
    await approve(active.version.id, expertId, active.version.contentHash);

    await submitForReview(retired.version.id, adminId);
    await approve(retired.version.id, expertId, retired.version.contentHash);
    await retire(retired.version.id, adminId, "outdated");

    const results = await retrieve("thyroidectomy scar");
    const documentIds = results.map((r) => r.documentId);
    expect(documentIds).toContain(active.document.id);
    expect(documentIds).not.toContain(retired.document.id);
  } finally {
    await cleanup([active.document.id, retired.document.id], [adminId, expertId]);
  }
});

test("hybrid retrieval surfaces a vector-only match via a mocked embedder", async () => {
  const { adminId, expertId } = await setup();
  const vectorOnly = await createDraft(adminId, {
    title: "Xyzzyzzy nonword content",
    topic: "misc",
    language: "en",
    content: "This passage intentionally shares no keywords with the query below.",
  });
  try {
    await submitForReview(vectorOnly.version.id, adminId);
    await approve(vectorOnly.version.id, expertId, vectorOnly.version.contentHash);

    // approve() only embeds when GOOGLE_AI_API_KEY is set; set a fake
    // embedding directly so the vector path has something to find.
    const fakeVector = new Array(768).fill(0);
    fakeVector[0] = 1;
    await db
      .update(knowledgeVersions)
      .set({ embedding: fakeVector })
      .where(eq(knowledgeVersions.id, vectorOnly.version.id));

    const results = await retrieve(
      "completely different query wording",
      5,
      async () => fakeVector,
    );
    expect(results.map((r) => r.documentId)).toContain(vectorOnly.document.id);
  } finally {
    await cleanup([vectorOnly.document.id], [adminId, expertId]);
  }
});
