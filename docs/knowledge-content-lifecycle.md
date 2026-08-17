# Knowledge content lifecycle (Phase 12)

`KnowledgeStatus` (`app/models/enums.py`) drives both the parent document's `current_status` and each version's `review_status`.

## States

- `DRAFT` — editable by ADMIN; not visible to patients.
- `PENDING_REVIEW` — submitted; editable only by re-entering `DRAFT`/`CHANGES_REQUESTED`; awaiting a MEDICAL_EXPERT decision.
- `CHANGES_REQUESTED` — MEDICAL_EXPERT sent it back with required comments; ADMIN may edit again.
- `APPROVED` — MEDICAL_EXPERT approved; body becomes immutable; eligible for ingestion into `knowledge_chunks`; only status ever reachable by patient retrieval.
- `REJECTED` — MEDICAL_EXPERT rejected with required comments; audit-visible; not retrievable; not directly re-editable (a new version must be created from a later approved state, or the document remains rejected).
- `RETIRED` — previously APPROVED content withdrawn from patient retrieval; history and audit preserved; visible to governance users only.

(`IN_REVIEW` and `ARCHIVED` remain declared on the enum for backward compatibility but are not used by the Phase 12 workflow.)

## Transition diagram

```
DRAFT ──submit──► PENDING_REVIEW ──approve──► APPROVED ──retire──► RETIRED
  ▲                     │                        │                   │
  │                     ├─request_changes─► CHANGES_REQUESTED         │
  │                     │                        │                   │
  │                     └─reject──────────► REJECTED (terminal;       │
  │                                          audit kept)              │
  └── new version created from APPROVED (new DRAFT; prior            │
      APPROVED version body stays immutable) ◄──────────────────────┘
                                              (restore, MEDICAL_EXPERT only)
```

## Rules enforced by `KnowledgeGovernanceService`

- Only `DRAFT` or `CHANGES_REQUESTED` versions are editable (`update_draft`).
- Only `DRAFT`/`CHANGES_REQUESTED` versions can be submitted, and only with a non-empty body.
- Only `PENDING_REVIEW` versions can be approved, sent to changes-requested, or rejected.
- A new version can only be created from a document whose `current_status` is `APPROVED`.
- Retire only applies to `APPROVED` documents; restore only applies to `RETIRED` documents.
- Patient-facing retrieval (`knowledge_retrieval_service.py`) only ever reads chunks where `review_status == APPROVED` **and** `active` — drafts, pending-review, changes-requested, rejected, and retired content are never returned to patients.

## Seed content

JSON files under `backend/app/content/approved_knowledge/` are ingested with `review_status = pending_review` by `python -m app.scripts.ingest_approved_knowledge`. That script never sets `APPROVED` — a MEDICAL_EXPERT must approve through the governance API (or console) before seed content is retrievable by patients. This remains true after Phase 12: seed files are **PENDING_REVIEW**, not auto-approved.
