# Atlas Vector Search setup

Phase 13B stores embeddings in `knowledge_chunk_embeddings`.

Atlas Vector Search index creation is a **manual** Atlas console step and is not claimed working until verified.

Suggested fields for an Atlas vector index:

- path: `embedding`
- dimensions: match `OPENAI_EMBEDDING_MODEL`
- similarity: cosine
- filters: `active`, `review_status`, `language`, `topic`

Until Atlas Vector Search is verified:

- `VECTOR_SEARCH_ENABLED=false`
- hybrid mode uses bounded in-app cosine over filtered embeddings and lexical fallback

Do not load unbounded vectors into memory.
