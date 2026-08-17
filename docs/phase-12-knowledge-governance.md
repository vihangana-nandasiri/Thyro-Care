# Phase 12 — Knowledge governance and medical-expert review console (completion report)

**Status:** Complete.
**Plan:** [`phase-12-knowledge-governance-plan.md`](phase-12-knowledge-governance-plan.md).
**Baseline:** Phase 11 complete (safe knowledge-grounded assistant foundation).

## What was built

### Backend

- `KnowledgeStatus` extended with `CHANGES_REQUESTED` (retaining `draft`, `pending_review`, `approved`, `rejected`, `retired` used since Phase 11); added `KnowledgeReviewDecision` enum.
- New models: `KnowledgeDocumentVersionDocument`, `KnowledgeReviewRecordDocument` (append-only); `KnowledgeDocumentDocument` extended with governance parent fields (`document_id`, `current_version_id`, `current_status`).
- New collections: `knowledge_document_versions`, `knowledge_review_records`, with named indexes for review-queue ordering, content-hash lookups, and reviewer/document audit history.
- `KnowledgeGovernanceRepository` — OCC-safe document/version updates, append-only review-record inserts, review-queue queries.
- `KnowledgeGovernanceService` — draft create/update, submit, approve/request-changes/reject, new-version-from-approved, retire/restore, document/version reads, version compare (diff).
- `KnowledgeDiffService` — line-level diff between two versions for reviewer comparison.
- API router `app/api/v1/knowledge_governance.py`, mounted under `/api/v1/governance` (prefix `governance`, tags `knowledge-governance`):
  - `POST /api/v1/governance/knowledge` — create draft (ADMIN)
  - `GET /api/v1/governance/knowledge` — list documents (ADMIN, MEDICAL_EXPERT)
  - `GET /api/v1/governance/knowledge/{document_id}` — document detail with versions
  - `GET /api/v1/governance/knowledge/{document_id}/versions` / `/versions/{version_id}`
  - `PATCH /api/v1/governance/knowledge/{document_id}/versions/{version_id}` — update draft (ADMIN)
  - `POST /api/v1/governance/knowledge/{document_id}/versions/{version_id}/submit` — submit for review (ADMIN)
  - `POST /api/v1/governance/knowledge/{document_id}/versions/new` — new draft from approved (ADMIN)
  - `GET /api/v1/governance/knowledge/{document_id}/compare` — version diff
  - `GET /api/v1/governance/knowledge/{document_id}/review-history` — append-only history
  - `POST /api/v1/governance/knowledge/{document_id}/retire` / `/restore`
  - `GET /api/v1/governance/review-queue` — pending-review list (ADMIN, MEDICAL_EXPERT)
  - `GET /api/v1/governance/review-queue/{document_id}/{version_id}` — inspect item
  - `POST /api/v1/governance/review-queue/{document_id}/{version_id}/decision` — approve / request_changes / reject (MEDICAL_EXPERT only)
- `KnowledgeIngestionService.ingest_approved_version()` — deterministic chunking, idempotent upsert, supersede prior chunks; invoked on approve and on restore; failures return `ingestion_status="failed"` without blocking the review decision.
- Audit events added: `KNOWLEDGE_DRAFT_CREATED/UPDATED`, `KNOWLEDGE_SUBMITTED_FOR_REVIEW`, `KNOWLEDGE_VERSION_CREATED`, `KNOWLEDGE_APPROVED`, `KNOWLEDGE_CHANGES_REQUESTED`, `KNOWLEDGE_REJECTED`, `KNOWLEDGE_RETIRED`, `KNOWLEDGE_RESTORED`, `KNOWLEDGE_INGESTION_COMPLETED/FAILED` — metadata only (ids, statuses, field names, hash prefix), never full body or full review comments.

### Frontend

- New role-protected consoles (see [`knowledge-governance-rbac.md`](knowledge-governance-rbac.md)):
  - ADMIN: `/admin/knowledge` (list), `/admin/knowledge/new`, `/admin/knowledge/:documentId` (editor), `/admin/knowledge/:documentId/versions/:versionId` (version view)
  - MEDICAL_EXPERT: `/medical-review` (queue), `/medical-review/:documentId/:versionId` (review detail — approve/request-changes/reject with required confirmation)
- `RoleProtectedRoute` restricts these routes by role; sidebar (`navigation.ts`) filters links by role; patient routes and navigation are unchanged.
- Safe rendering only (no raw HTML execution) for draft/version bodies.

### Documentation

- Architecture: [`knowledge-governance-architecture.md`](knowledge-governance-architecture.md)
- Lifecycle: [`knowledge-content-lifecycle.md`](knowledge-content-lifecycle.md)
- Review workflow: [`medical-review-workflow.md`](medical-review-workflow.md)
- Versioning/hashing/OCC: [`knowledge-versioning-and-hashing.md`](knowledge-versioning-and-hashing.md)
- Publication/ingestion: [`knowledge-publication-and-ingestion.md`](knowledge-publication-and-ingestion.md)
- RBAC: [`knowledge-governance-rbac.md`](knowledge-governance-rbac.md)
- Validation checklist: [`phase-12-validation.md`](phase-12-validation.md)
- `docs/database-indexes.md` and `docs/database-design.md` updated for the two new collections.

## Key guarantees

- Only `MEDICAL_EXPERT` can approve, request changes, reject, or restore. `ADMIN` cannot perform any review decision, enforced server-side.
- No auto-approve path and no LLM/AI approval anywhere in the workflow — every publication decision is a human `MEDICAL_EXPERT` action.
- Review decisions require `expected_version` (OCC) and `expected_content_hash` (content-hash match); mismatches return 409.
- Approving may still return `ingestion_status: "failed"` (partial success) — the review decision is recorded regardless of ingestion outcome; ingestion can be retried.
- Patient-facing chat/knowledge APIs never expose drafts, pending-review content, review comments, or rejection reasons — only `APPROVED` and `active` chunks.
- `KnowledgeReviewRecordDocument` rows are append-only; no update/delete path exists in the repository.
- Seed JSON files under `backend/app/content/approved_knowledge/` remain `PENDING_REVIEW` — Phase 12 did not introduce any auto-approval of seed content.

## Deployment status

- FastAPI backend is **not publicly deployed** in this phase (local/dev only, as in prior phases).
- Cloudflare Worker frontend deployment is unchanged as an infrastructure requirement for this phase; however, the frontend **did** gain new admin/medical-review pages and routes, so a frontend redeploy (`npm run ci:build` + `npm run cf:deploy`) is a separate, later action if/when this is pushed live — it is not required to complete Phase 12 documentation or backend work.

## Out of scope (Phase 13 and beyond — not implemented)

Per the Phase 12 plan's exclusions: production LLM provider wiring, automatic/AI medical approval, patient-facing knowledge authoring, web crawling/ingestion from the internet, diagnosis categories, and any other Phase 13+ scope. **Phase 13 has not started.**

## Next phase

Phase 13 — not started; scope not yet defined in this repository. Do not begin Phase 13 work without an approved plan.
