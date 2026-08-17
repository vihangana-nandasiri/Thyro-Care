# Chatbot architecture (Phase 13B)

ThyroCare AI chat is an authenticated PATIENT educational assistant.

## Flow

1. Prompt-security evaluation
2. Deterministic medical-safety pre-check (no free-text emergency triage)
3. Hybrid retrieval over APPROVED active knowledge only
4. Bounded conversation context (clarification only; not medical evidence)
5. Provider generation (disabled/fake/OpenAI Responses API)
6. Grounding validation v2
7. Post-generation safety check
8. Persist validated answer + privacy-safe audit summary

## Providers

- `disabled` — default
- `fake` — deterministic tests
- `openai` — AsyncOpenAI Responses API with `store=False`

API keys never leave the backend. No `VITE_` OpenAI secrets.

## Retrieval

- Lexical overlap remains available
- Semantic embeddings stored in `knowledge_chunk_embeddings`
- Hybrid RRF fusion when configured
- Atlas Vector Search is optional; in-app cosine fallback is bounded

## Streaming

`POST /api/v1/chat/sessions/{id}/messages/stream` (SSE). Final validated payload only is persisted.

## Feedback

`POST /api/v1/chat/messages/{id}/feedback` — owned assistant messages only.

Phase 13B does not fine-tune models on patient chats.
