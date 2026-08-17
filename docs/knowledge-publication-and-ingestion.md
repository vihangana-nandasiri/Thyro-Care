# Knowledge publication and ingestion (Phase 12)

## Trigger

Ingestion into the patient-retrievable `knowledge_chunks` collection happens automatically, as part of the same request, in exactly two places in `KnowledgeGovernanceService`:

1. `approve()` — after a version transitions to `APPROVED`.
2. `restore()` — after a `RETIRED` version transitions back to `APPROVED`.

There is no separate "publish" step and no scheduled/background ingestion job for governance content — approval (or restore) is publication.

## Deterministic chunking

`ingest_approved_version()` (`app/services/knowledge_ingestion_service.py`) rebuilds a temporary in-memory `KnowledgeDocumentDocument` from the approved version's fields, then:

1. `deterministic_chunks(body, size=800, overlap=100)` splits normalized body text into overlapping windows (whitespace-collapsed; no LLM/embedding call involved).
2. Each chunk gets a stable `chunk_id` = `{document_id}:c{index}` and its own `content_hash` (SHA-256 of the chunk text).
3. `KnowledgeGovernanceRepository`/`KnowledgeRepository.upsert_chunks()` idempotently upserts chunks by `chunk_id` — re-running ingestion for the same content produces the same chunk set rather than duplicates.
4. `retire_old_chunks(document_id, current_version_number)` deactivates chunks from any prior version of the same document, so only the latest approved version's chunks remain `active`.

Chunks carry `review_status` and `active`, mirroring the version they came from; patient retrieval (`knowledge_retrieval_service.py`) only reads chunks where `review_status == APPROVED and active`.

## Partial failure handling

Ingestion is wrapped in a broad `try/except` so an ingestion failure **never rolls back or hides the review decision**:

- The approval (or restore) itself — status change, document mirror update, append-only review record — is committed first and always succeeds or fails independently of ingestion.
- If ingestion raises, the service records an audit event (`KNOWLEDGE_INGESTION_FAILED`) and returns `KnowledgeApprovalResult` with `ingestion_status="failed"` and a safe message: _"Ingestion failed. The approval was recorded; retry ingestion."_
- If ingestion succeeds, `ingestion_status="completed"` and `KNOWLEDGE_INGESTION_COMPLETED` is audited.
- Callers (console / API clients) must treat `ingestion_status="failed"` as "approved but not yet live for patients" and can retry ingestion without re-approving, since the approval record and content hash are already durable.
- Retry endpoint: `POST /api/v1/governance/knowledge/{document_id}/versions/{version_id}/reingest` with `{ "expected_content_hash": "..." }` (ADMIN or MEDICAL_EXPERT). The admin/medical version detail page exposes **Retry publication**.

## What is never published

- `DRAFT`, `PENDING_REVIEW`, `CHANGES_REQUESTED`, and `REJECTED` versions never produce chunks.
- Retiring a document deactivates its chunks (`retire_old_chunks(document_id, None)`) without deleting them, preserving history for audit while removing them from active retrieval.
- Seed JSON under `backend/app/content/approved_knowledge/` loads as `PENDING_REVIEW` via `python -m app.scripts.ingest_approved_knowledge` and produces **inactive** chunks until a MEDICAL_EXPERT approves the corresponding governance version through the API.

## Idempotency guarantees

- `upsert_chunks` keys on the unique `chunk_id`, so retrying ingestion after a transient failure is safe.
- `canonical_content_hash` on the version and per-chunk `content_hash` allow detecting whether re-ingested content actually changed.
- Re-approving the same unchanged content (not a normal workflow path, since approval requires `PENDING_REVIEW`) would still produce the same deterministic chunk set.
