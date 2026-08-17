# Knowledge versioning, hashing, and optimistic concurrency (Phase 12)

## Version identity

- Parent `KnowledgeDocumentDocument.document_id` (`kg-<hex>`) is stable for the life of the document.
- Each revision is a separate `KnowledgeDocumentVersionDocument` with its own `version_id` (`{document_id}:v{version_number}`) and sequential `version_number` starting at 1.
- `supersedes_version_id` links a new version back to the version it was created from (used when starting a new draft from an approved version).
- The parent document's `current_version_id` always points at the version currently being edited or that is currently approved/retired.

## Content hash

`canonical_content_hash()` (`app/services/knowledge_ingestion_service.py`) computes a SHA-256 hash over the pipe-joined, medically relevant fields of a version: `title`, `source_name`, `source_url`, `topic`, `language`, `body`, `medical_disclaimer`. This hash is stored as `content_hash` on the version (and mirrored to the parent document once approved).

The hash is recalculated and stored:

- On draft creation.
- On every draft update (`update_draft`) — this also clears `submitted_for_review_at`/`submitted_by_user_id`, forcing a fresh submission if the content changes after submission was reset to `DRAFT`.
- When a new version is created from an approved document.

## Why the hash matters for review

Every review decision (`approve`, `request_changes`, `reject`) and `restore` requires the caller to pass `expected_content_hash`. The service compares it against the version's stored `content_hash` and returns **409 Conflict** on any mismatch. This prevents a reviewer from approving content that changed after they loaded the review screen (time-of-check / time-of-use protection), independent of the optimistic-concurrency check below.

## Optimistic concurrency control (OCC)

Both `KnowledgeDocumentDocument` and `KnowledgeDocumentVersionDocument` carry an integer `version` field (distinct from the content `version_number`) used purely for OCC:

- Every mutating call also requires `expected_version`.
- `KnowledgeGovernanceRepository.update_document` / `update_version` perform `update_one({..., "version": expected_version}, {"$set": ..., "$inc": {"version": 1}})`.
- If no document matches (because `version` moved), the repository re-reads the row: if it still exists, it raises `RepositoryConflictError` → **409**; if it no longer exists, it raises `RepositoryNotFoundError` → **404**.
- Parent-document mirror updates (e.g. reflecting a version's new status onto the document) are treated as best-effort: a stale parent `version` on a mirror-only field update is swallowed rather than surfaced, since the version record remains the source of truth for review state.

## Immutability of approved content

Once a version's `review_status` is `APPROVED`, its body is treated as immutable by workflow rules: `update_draft`/`submit_for_review` only operate on versions in `DRAFT` or `CHANGES_REQUESTED`. To change approved content, an ADMIN must call `POST /knowledge/{document_id}/versions/new`, which creates a new `DRAFT` version (`version_number + 1`) with `supersedes_version_id` set to the current approved version — the original approved version's document row is never edited in place.

## Append-only review records

`KnowledgeReviewRecordDocument` has no update path in the repository — only `append_review_record` (insert) and `list_review_records`/list-by-document reads exist. Each record captures `reviewer_user_id`, `reviewer_role`, `decision`, `reviewed_content_hash` (the hash that was actually reviewed), optional `comments`, and `created_at`. This gives a permanent, non-editable audit trail independent of the mutable version/document rows.
