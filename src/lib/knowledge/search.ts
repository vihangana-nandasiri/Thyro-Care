import { sql } from "drizzle-orm";
import { db } from "@/db";
import { embedText, isEmbeddingEnabled } from "@/lib/ai/embeddings";

export interface RetrievedChunk {
  documentId: string;
  versionId: string;
  title: string;
  content: string;
  score: number;
}

type Row = { document_id: string; version_id: string; title: string; content: string; score: number };

function toChunk(r: Row): RetrievedChunk {
  return { documentId: r.document_id, versionId: r.version_id, title: r.title, content: r.content, score: Number(r.score) };
}

/**
 * Builds an OR-combined tsquery string ("avoid | rai | treatment") instead
 * of relying on plainto_tsquery's implicit AND. A natural-language question
 * has many words, and short educational snippets rarely contain every one
 * of them — requiring all of them (AND) misses obviously-relevant content
 * (e.g. "what foods should I avoid" AND-fails against a passage that says
 * "seafood" instead of "food"). OR + ts_rank scoring is the standard
 * recall-oriented approach for this kind of consumer Q&A search.
 */
function toOrQuery(query: string): string {
  const words = query
    .toLowerCase()
    .split(/[^\p{L}\p{M}\p{N}]+/u)
    .filter((w) => w.length > 1);
  return words.length > 0 ? words.join(" | ") : "";
}

const CANDIDATE_POOL = 10;
// ponytail: fixed cutoff calibrated by hand on gemini-embedding-001 (on-topic
// questions scored >= 0.62, unrelated ones <= 0.53). Re-check it if the
// embedding model changes or the corpus grows a lot.
const MIN_SIMILARITY = 0.6;
const RRF_K = 60;

/** Reciprocal Rank Fusion: combines two independently-ranked lists (full
 * text, vector) into one ranking without needing to normalize or weigh
 * their very different score scales against each other. */
function fuseRankings(lists: RetrievedChunk[][]): RetrievedChunk[] {
  const scored = new Map<string, { chunk: RetrievedChunk; score: number }>();
  for (const list of lists) {
    list.forEach((chunk, rank) => {
      const entry = scored.get(chunk.versionId) ?? { chunk, score: 0 };
      entry.score += 1 / (RRF_K + rank + 1);
      scored.set(chunk.versionId, entry);
    });
  }
  return [...scored.values()].sort((a, b) => b.score - a.score).map((e) => e.chunk);
}

async function fullTextSearch(tsQuery: string): Promise<RetrievedChunk[]> {
  const rows = await db.execute<Row>(sql`
    select
      d.id as document_id,
      v.id as version_id,
      v.title as title,
      v.content as content,
      ts_rank(v.search_vector, to_tsquery('english', ${tsQuery})) as score
    from knowledge_versions v
    join knowledge_documents d on d.current_version_id = v.id
    where d.status = 'active'
      and v.status = 'approved'
      and v.search_vector @@ to_tsquery('english', ${tsQuery})
    order by score desc
    limit ${CANDIDATE_POOL}
  `);
  return rows.map(toChunk);
}

async function vectorSearch(queryEmbedding: number[]): Promise<RetrievedChunk[]> {
  const literal = JSON.stringify(queryEmbedding);
  const rows = await db.execute<Row>(sql`
    select
      d.id as document_id,
      v.id as version_id,
      v.title as title,
      v.content as content,
      1 - (v.embedding <=> ${literal}::vector) as score
    from knowledge_versions v
    join knowledge_documents d on d.current_version_id = v.id
    where d.status = 'active'
      and v.status = 'approved'
      and v.embedding is not null
      and 1 - (v.embedding <=> ${literal}::vector) >= ${MIN_SIMILARITY}
    order by v.embedding <=> ${literal}::vector
    limit ${CANDIDATE_POOL}
  `);
  return rows.map(toChunk);
}

/**
 * Hybrid retrieval: full-text search (ts_rank) always runs and is the
 * baseline — it works with zero external dependencies and never fails from
 * a network blip. When Gemini embeddings are configured (GOOGLE_AI_API_KEY),
 * a semantic vector-similarity pass also runs, and the two independently
 * ranked lists are merged via Reciprocal Rank Fusion. Versions approved
 * before embeddings were enabled (embedding is null) are simply absent from
 * the vector pass and are found via full text until a backfill script
 * embeds them (see src/db/backfill-embeddings.ts).
 *
 * No language filter: approved content is mostly English, and filtering by
 * the chat language left Sinhala/Tamil questions with zero context. The
 * embeddings are multilingual, and the model answers in the chat language.
 */
export async function retrieve(
  query: string,
  limit = 5,
  embedFn: (text: string) => Promise<number[]> = embedText,
): Promise<RetrievedChunk[]> {
  const tsQuery = toOrQuery(query);
  const textRanked = tsQuery ? await fullTextSearch(tsQuery) : [];
  // Mirrors the completionFn-override checks elsewhere (answer.ts, policy.ts)
  // so tests can inject a fake embedder without a real API key.
  if (!isEmbeddingEnabled() && embedFn === embedText) return textRanked.slice(0, limit);

  try {
    const queryEmbedding = await embedFn(query);
    const vectorRanked = await vectorSearch(queryEmbedding);
    return fuseRankings([textRanked, vectorRanked]).slice(0, limit);
  } catch {
    // Embedding call failed (rate limit, network, bad key) — full text alone still works.
    return textRanked.slice(0, limit);
  }
}
