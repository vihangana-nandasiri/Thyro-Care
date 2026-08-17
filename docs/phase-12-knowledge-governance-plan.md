# Phase 12 — Knowledge Governance and Medical-Expert Review Console (Plan)

**Status:** Plan only — implementation follows this document.  
**Baseline commit:** `7a557091` (Phase 11 complete).  
**Out of scope:** Phase 13 and any production LLM approval.

---

## 1. Role permissions

| Action                                     | ADMIN    | MEDICAL_EXPERT        | PATIENT                       |
| ------------------------------------------ | -------- | --------------------- | ----------------------------- |
| List/view governance documents & versions  | Yes      | Yes (queue + inspect) | No                            |
| Create / edit drafts                       | Yes      | No                    | No                            |
| Submit for review                          | Yes      | No                    | No                            |
| Create new draft version from approved     | Yes      | No                    | No                            |
| Approve / request changes / reject         | **No**   | Yes                   | No                            |
| Retire approved content (audited)          | Yes      | Yes (policy)          | No                            |
| Restore (republish)                        | No alone | Yes (required)        | No                            |
| Patient retrieval of drafts / review notes | No       | No                    | No                            |
| Patient retrieval of APPROVED chunks       | N/A      | N/A                   | Yes (existing chat/knowledge) |

Actor identity is always derived from the authenticated user. Clients must never send actor user IDs. Backend role checks remain authoritative; frontend nav is convenience only.

---

## 2. Content lifecycle

```
DRAFT ──submit──► PENDING_REVIEW ──approve──► APPROVED ──retire──► RETIRED
  ▲                     │                        │
  │                     ├──request_changes──► CHANGES_REQUESTED ──edit──► DRAFT
  │                     └──reject──────────► REJECTED (audit kept; not retrievable)
  │
  └── new version from APPROVED (new DRAFT; prior APPROVED immutable)
```

- Only **APPROVED** content may be ingested into active retrieval chunks.
- **RETIRED** remains visible to governance users; excluded from patient retrieval.
- Seed JSON files remain `pending_review` until an expert approves via the console (no auto-approve).

---

## 3. Version strategy

- Parent **KnowledgeDocument**: stable `document_id`, `slug`, `current_version_id`, `current_status`, OCC integer `version`.
- Child **KnowledgeDocumentVersion**: sequential `version_number`, body, metadata, `content_hash`, review timestamps/actors, `supersedes_version_id`.
- Approved version bodies are **immutable**. Edits require a new draft version.
- Updating a draft recalculates `content_hash` and clears prior submission metadata.

---

## 4. Review workflow

1. ADMIN creates DRAFT → edits → submits (`PENDING_REVIEW`).
2. MEDICAL_EXPERT opens review queue item; may compare with prior approved version.
3. Decision with `expected_version` + `expected_content_hash`:
   - **APPROVE** — immutable review record; status APPROVED; trigger ingestion.
   - **REQUEST_CHANGES** — comments required; status CHANGES_REQUESTED; not published.
   - **REJECT** — comments required; immutable review; not published.
4. ADMIN may edit after CHANGES_REQUESTED and resubmit.

---

## 5. Approval requirements

- Authenticated **MEDICAL_EXPERT** only (ADMIN cannot approve).
- Exact `content_hash` match; version must be `PENDING_REVIEW`.
- Append-only `KnowledgeReviewRecord` (decision, hash, reviewer, timestamp, optional comments).
- Frontend confirmation text required before approve.
- No LLM / AI auto-approval.

---

## 6. Rejection & changes-requested

- Comments required and bounded; visible only on governance APIs.
- Never exposed on patient chat/knowledge endpoints.
- Content remains non-retrievable until a later APPROVED version exists.

---

## 7. Retirement & restoration

- **Retire:** ADMIN or MEDICAL_EXPERT; reason required; deactivate chunks; preserve history; audit.
- **Restore:** MEDICAL_EXPERT; revalidate approved hash; re-ingest; audit. Does not rewrite history.

---

## 8. Re-ingestion strategy

- On approve (and restore): deterministic chunking from approved version body.
- Supersede prior approved chunks for the same `document_id`.
- Idempotent upserts by `chunk_id`.
- If review succeeds but ingestion fails: return safe partial-failure; do not claim publication success; allow admin retry of ingestion without re-approving.

---

## 9. Audit strategy

Events: draft created/updated, submitted, approved, changes requested, rejected, version created, retired, restored, ingestion completed/failed.

Metadata: actor id, document/version ids, statuses, field names, content hash, ingestion status — **never** full body or full review comments.

---

## 10. Privacy strategy

- No patient data in knowledge collections.
- No logging of bodies/comments/tokens/secrets.
- Review notes never on patient APIs.
- Safe Markdown/plain-text rendering on frontend (no raw HTML execution).

---

## 11. Frontend route strategy

- ADMIN: `/admin/knowledge`, `/new`, `/:documentId`, `/:documentId/versions/:versionId`
- MEDICAL_EXPERT: `/medical-review`, `/medical-review/:documentId/:versionId`
- `RoleProtectedRoute` + role-filtered sidebar items.
- Patient routes unchanged.

---

## 12. Testing strategy

- Authz matrix (patient denied; admin cannot approve; expert can).
- Workflow, hash conflicts (409), OCC, ingestion sync, privacy, regression of Phases 6–11.
- In-memory Mongo only; no Atlas / real LLM / internet.

---

## 13. Git push strategy

- Commit: `feat: implement knowledge governance and medical review`
- Push to `https://github.com/jkchinthaka/thyro_t1.git` on `main`
- Secret/artifact scan before commit; no force push unless documented recovery case

---

## 14. Phase 13 exclusions

Do **not** implement: production LLM provider wiring, automatic medical approval, patient-facing knowledge authoring, web crawling, diagnosis categories, or any Phase 13 scope.

---

## 15. Compatibility notes

- Extend `KnowledgeStatus` with `CHANGES_REQUESTED`; retain Phase 11 values used by seeds/tests where safe (`pending_review`, `approved`, `retired`).
- Introduce version + review-record collections; keep approved-only chunk retrieval for chat.
- File-based seeds stay PENDING_REVIEW until expert approval via governance (not auto-published).
