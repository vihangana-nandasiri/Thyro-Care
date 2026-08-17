# Phase 11 — Safe Knowledge-Grounded Assistant Plan

## Scope

Patient-owned chat with answers grounded only in approved knowledge. Deterministic lexical retrieval foundation, provider abstraction (default disabled), citation enforcement, prompt-injection protection, and medical-safety policy. Phase 10 structured safety rules remain the only emergency classifier.

**Out of scope (Phase 12+):** production LLM credentials, Atlas Vector Search requirement, admin CMS UI, autonomous agents, tool execution, public-web browsing.

## Knowledge-content boundary

- Answers only from `APPROVED` documents/chunks in controlled local content.
- Seed files use existing educational project material and are marked `PENDING_REVIEW` until medical-expert sign-off.
- Never retrieve from chat, profile, medications, appointments, or symptoms.
- No runtime public-web fetch.

## Content approval process

Statuses: `DRAFT` → `PENDING_REVIEW` → `APPROVED` | `RETIRED`.  
Patient retrieval uses `APPROVED` only. Ingestion upserts metadata + chunks; never auto-approves.

## Retrieval strategy

- Default: deterministic lexical scoring (token overlap) over approved chunks.
- Filters: language, topic; bounded top-K; minimum score threshold.
- Optional vector mode behind interface — not required for tests; not claimed active unless configured.

## Provider abstraction

- Interface: `generate_grounded_answer`, `health_check`.
- Implementations: `DisabledLLMProvider`, `FakeLLMProvider` (tests).
- Default: `AI_ASSISTANT_ENABLED=false`, `LLM_PROVIDER=disabled`.
- No API keys in repo; no VITE exposure of secrets.

## Provider-disabled behavior

Honest `PROVIDER_UNAVAILABLE` response; resources + symptom safety check remain available. No fake generation.

## Citation enforcement

Factual medical statements require ≥1 citation mapped to retrieved approved chunks. Unknown/unapproved citations → `INSUFFICIENT_EVIDENCE`. Never fabricate.

## Medical-safety policy

Refuse diagnosis, dosage/med changes, lab interpretation, prognosis. Emergency concerns → `SAFETY_REDIRECT` to Phase 10 safety check + Emergency page (no free-text triage). No false reassurance.

## Prompt-injection protection

Filter override/extract/tool/secret requests before generation. Document text treated as data, not instructions. Policy cannot be overridden by user or chunks.

## Conversation ownership

Sessions/messages owned by authenticated PATIENT; foreign → safe 404; soft delete; no user_id from client.

## Privacy and retention

Audit metadata only (modes, counts, versions). Never log raw messages, chunk text, prompts, or provider payloads. No localStorage chat. No chain-of-thought storage.

## Testing strategy

MemoryDatabase + FakeLLMProvider. Cover ingestion, retrieval, security, medical policy, grounding, ownership, API. No real LLM, Atlas, or internet.

## Frontend integration

Preserve ChatPage design; wire sessions/messages/citations; safety redirect UX; remove chat mocks.

## Git push strategy

Commit on `main`: `feat: implement safe knowledge-grounded assistant`. Push to `https://github.com/jkchinthaka/thyro_t1.git`.

## Deferred Phase 12

Admin review UI, production provider enablement, vector search ops, multilingual reviewed translations, clinician workflows.
