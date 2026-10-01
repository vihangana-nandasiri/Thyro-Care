// One-off: embeds approved knowledge versions that predate GOOGLE_AI_API_KEY
// being set (or that failed at approval time). Safe to re-run — it only
// updates rows where embedding is still null.
import { and, eq, isNull } from "drizzle-orm";
import { db } from "./index";
import { knowledgeVersions } from "./schema";
import { embedText, isEmbeddingEnabled } from "@/lib/ai/embeddings";

if (!isEmbeddingEnabled()) {
  console.error("Set GOOGLE_AI_API_KEY to backfill embeddings.");
  process.exit(1);
}

const rows = await db.query.knowledgeVersions.findMany({
  where: and(eq(knowledgeVersions.status, "approved"), isNull(knowledgeVersions.embedding)),
});

console.log(`Backfilling ${rows.length} approved version(s)...`);
let done = 0;
for (const row of rows) {
  try {
    const embedding = await embedText(`${row.title}\n${row.content}`);
    await db.update(knowledgeVersions).set({ embedding }).where(eq(knowledgeVersions.id, row.id));
    done++;
  } catch (err) {
    console.error(`Failed to embed version ${row.id} (${row.title}):`, err);
  }
}
console.log(`Done: ${done}/${rows.length} embedded.`);
process.exit(0);
