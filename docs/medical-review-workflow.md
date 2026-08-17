# Medical review workflow (Phase 12)

## Who can review

Only an authenticated user with role `MEDICAL_EXPERT` can record a review decision. `ADMIN` can author and submit content but **cannot** approve, request changes, or reject — enforced server-side by `require_knowledge_reviewer` (alias for `require_medical_expert`) in `app/api/dependencies.py`, independent of any frontend UI restriction.

There is **no auto-approve** and **no LLM/AI approval path** — every decision requires a human `MEDICAL_EXPERT` action through the API.

## Review queue

`GET /api/v1/governance/review-queue` lists all versions with `review_status == PENDING_REVIEW`, ordered by `submitted_for_review_at` (oldest first). Each item exposes `document_id`, `version_id`, `version_number`, `title`, `topic`, `language`, `content_hash`, and submission metadata — never the reviewer's own prior comments or other documents' drafts.

`GET /api/v1/governance/review-queue/{document_id}/{version_id}` returns the full document detail (including version history) scoped to that item so the reviewer can inspect content and, via `GET /api/v1/governance/knowledge/{document_id}/compare`, diff it against the prior approved version.

## Recording a decision

Single endpoint: `POST /api/v1/governance/review-queue/{document_id}/{version_id}/decision`.

Request body (`KnowledgeReviewDecisionRequest`):

| Field                   | Required    | Notes                                                                                                |
| ----------------------- | ----------- | ---------------------------------------------------------------------------------------------------- |
| `decision`              | yes         | `approve` \| `request_changes` \| `reject`                                                           |
| `expected_version`      | yes         | Optimistic-concurrency guard on the version document                                                 |
| `expected_content_hash` | yes         | Must exactly match the version's current `content_hash`                                              |
| `comments`              | conditional | **Required and non-blank** for `request_changes` and `reject`; optional review summary for `approve` |

Any mismatch on `expected_version` or `expected_content_hash` returns **409 Conflict** with a message asking the reviewer to reload — this blocks approving content that changed after the reviewer opened it.

### Approve

- Version must be `PENDING_REVIEW`.
- On success: version → `APPROVED` (body now immutable), parent document mirrors the approved fields and becomes `active`, an append-only `KnowledgeReviewRecordDocument` is written, and ingestion into `knowledge_chunks` is attempted.
- Response (`KnowledgeApprovalResult`) always includes `ingestion_status` (`completed` or `failed`). See [`knowledge-publication-and-ingestion.md`](knowledge-publication-and-ingestion.md) for what happens on ingestion failure.
- The frontend review console requires an explicit confirmation step before submitting an approve decision.

### Request changes

- Version must be `PENDING_REVIEW`; `comments` required.
- Version → `CHANGES_REQUESTED`; document mirrors the status; content stays non-retrievable.
- ADMIN may then edit the draft again and resubmit.

### Reject

- Version must be `PENDING_REVIEW`; `comments` required.
- Version → `REJECTED`; document mirrors the status; content stays non-retrievable. The decision and comments remain in the append-only review history for audit but are never exposed on patient-facing APIs.

## Review history

`GET /api/v1/governance/knowledge/{document_id}/review-history` returns every `KnowledgeReviewRecordDocument` across all versions of a document, sorted chronologically. Records are never updated or deleted (see [`knowledge-versioning-and-hashing.md`](knowledge-versioning-and-hashing.md)).

## Retire and restore

- **Retire** (`POST /knowledge/{document_id}/retire`): ADMIN or MEDICAL_EXPERT; requires a non-empty `reason`; only valid from `APPROVED`; deactivates chunks, sets document/version to `RETIRED`, audited.
- **Restore** (`POST /knowledge/{document_id}/restore`): MEDICAL_EXPERT only; requires `expected_content_hash` to match the retired version exactly; re-approves and re-ingests; writes a `RESTORE` review record. Does not rewrite prior history.

## Privacy boundary

Draft bodies, review comments, and rejection reasons are only ever returned by `/api/v1/governance/*` endpoints, which are restricted to `ADMIN`/`MEDICAL_EXPERT`. Patient-facing chat and knowledge endpoints never expose drafts, `CHANGES_REQUESTED`/`REJECTED` content, or review comments — only `APPROVED` and `active` chunks.
