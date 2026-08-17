# Chatbot RAG pipeline

1. Normalize query
2. Detect dominant language (heuristic)
3. Lexical retrieval over approved chunks
4. Optional query embedding + semantic ranking
5. RRF hybrid merge + per-document diversity cap
6. Provide evidence excerpts to the LLM as data (never instructions)
7. Require structured citations subset of retrieved IDs
8. Reject invented URLs/titles and forbidden medical-action language

Versions:

- `PROMPT_VERSION` / `assistant-policy-v2`
- `RETRIEVAL_VERSION` / `hybrid-retrieval-v1`
- `EMBEDDING_PIPELINE_VERSION`
- `EVAL_DATASET_VERSION`
