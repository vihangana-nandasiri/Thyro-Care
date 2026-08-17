# ThyroCare AI API (Backend)

FastAPI + PyMongo Async persistence through Phase 12 (auth, profile, medications, appointments, symptoms, safe chat foundation, knowledge governance).

> **Medical disclaimer:** Educational/support prototype only. Chat answers (when enabled) use approved sources with citations. No diagnosis, lab interpretation, or medication advice. Free-text chat is not an emergency classifier.

## Current scope (through Phase 12)

Includes Phase 4–10 capabilities plus:

- Patient chat sessions/messages with ownership and soft delete
- Controlled knowledge ingest (PENDING_REVIEW seed; APPROVED-only retrieval)
- Lexical retrieval foundation + provider abstraction (default disabled)
- Citation/grounding validation, prompt-injection protection, medical-safety policy
- Knowledge governance: ADMIN-authored drafts, versioning, MEDICAL_EXPERT-only review/approval, append-only review records, deterministic re-ingestion (Phase 12)

**Not included yet:** production LLM credentials, vector search requirement, autonomous agents/tools, Phase 13 scope of any kind. FastAPI is not publicly deployed.

## Prerequisites

- Python **3.11+** (validated on 3.14 locally; Docker uses 3.12)
- `pip`
- MongoDB on `localhost:27017` recommended for full auth flows (app can start degraded without it in non-production)

## Windows setup

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements-dev.txt
copy .env.example .env
```

Generate a local JWT secret (do not commit it):

```powershell
python -c "import secrets; print(secrets.token_hex(32))"
```

Set `JWT_SECRET_KEY` in `backend/.env`. Development may use a long local secret; production must use a strong unique secret and `COOKIE_SECURE=true`.

## Start development server

```powershell
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## Health endpoints

| Method | Path             | Purpose                           |
| ------ | ---------------- | --------------------------------- |
| GET    | `/health`        | Lightweight probe                 |
| GET    | `/api/v1/health` | Detailed health + database status |

## Authentication endpoints

| Method | Path                    | Notes                                     |
| ------ | ----------------------- | ----------------------------------------- |
| POST   | `/api/v1/auth/register` | Creates PATIENT only; sets refresh + CSRF |
| POST   | `/api/v1/auth/login`    | Generic failure messages; sets cookies    |
| POST   | `/api/v1/auth/refresh`  | Cookie + `X-CSRF-Token`; rotates refresh  |
| POST   | `/api/v1/auth/logout`   | CSRF when cookie present; clears cookies  |
| GET    | `/api/v1/auth/me`       | Bearer access token                       |

## Patient profile endpoints

| Method | Path                  | Notes                                                        |
| ------ | --------------------- | ------------------------------------------------------------ |
| GET    | `/api/v1/profiles/me` | PATIENT only; returns profile + account                      |
| PATCH  | `/api/v1/profiles/me` | Partial update; requires `expected_version`; 409 on conflict |

Profile is support metadata only — not a medical record and not diagnostic.

## Medication endpoints

| Method | Path                            | Notes                                       |
| ------ | ------------------------------- | ------------------------------------------- |
| GET    | `/api/v1/medications`           | List owned; optional `status`, pagination   |
| POST   | `/api/v1/medications`           | Create owned medication                     |
| GET    | `/api/v1/medications/schedule`  | Computed schedule (`date_from`, `date_to`)  |
| GET    | `/api/v1/medications/adherence` | Tracking adherence metrics                  |
| GET    | `/api/v1/medications/{id}`      | Get owned; foreign → 404                    |
| PATCH  | `/api/v1/medications/{id}`      | Update; `expected_version`; 409 on conflict |
| DELETE | `/api/v1/medications/{id}`      | Soft delete                                 |
| POST   | `/api/v1/medications/{id}/logs` | Log taken/missed/skipped                    |
| GET    | `/api/v1/medications/{id}/logs` | List logs for owned medication              |

All medication routes require an active PATIENT. Ownership is derived from the JWT. Soft delete and unique occurrence logs apply. See `docs/medication-architecture.md`.

## Appointment endpoints

| Method | Path                               | Notes                              |
| ------ | ---------------------------------- | ---------------------------------- |
| GET    | `/api/v1/appointments`             | List owned; filters + pagination   |
| POST   | `/api/v1/appointments`             | Create                             |
| GET    | `/api/v1/appointments/calendar`    | Bounded calendar range             |
| GET    | `/api/v1/appointments/upcoming`    | Next upcoming (excludes cancelled) |
| GET    | `/api/v1/appointments/{id}`        | Get owned; foreign → 404           |
| PATCH  | `/api/v1/appointments/{id}`        | Update; `expected_version`         |
| PATCH  | `/api/v1/appointments/{id}/status` | Status transition                  |
| DELETE | `/api/v1/appointments/{id}`        | Soft delete                        |

Organization/tracking only — reminders are not sent. See `docs/appointment-architecture.md`.

### Symptoms (Phase 10)

| Method | Path                            | Notes                              |
| ------ | ------------------------------- | ---------------------------------- |
| GET    | `/api/v1/symptoms`              | List owned; filters + pagination   |
| POST   | `/api/v1/symptoms`              | Create + structured safety_answers |
| POST   | `/api/v1/symptoms/safety-check` | Assessment only; no persistence    |
| GET    | `/api/v1/symptoms/active`       | Active + improving                 |
| GET    | `/api/v1/symptoms/{id}`         | Get owned; foreign → 404           |
| PATCH  | `/api/v1/symptoms/{id}`         | Update; `expected_version`         |
| PATCH  | `/api/v1/symptoms/{id}/status`  | Status transition                  |
| DELETE | `/api/v1/symptoms/{id}`         | Soft delete                        |

Tracking + safety awareness only — no diagnosis; free text never used for safety. See `docs/symptom-architecture.md`.

### Knowledge governance (Phase 12)

All routes are mounted under `/api/v1/governance` and require an authenticated ADMIN or MEDICAL_EXPERT (PATIENT is always denied). Only **MEDICAL_EXPERT** can approve, request changes, reject, or restore — ADMIN cannot, even though ADMIN authors content. There is no auto-approve and no LLM/AI approval path.

| Method | Path                                                                      | Role            | Notes                                                                                                                                                                         |
| ------ | ------------------------------------------------------------------------- | --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| POST   | `/api/v1/governance/knowledge`                                            | ADMIN           | Create draft                                                                                                                                                                  |
| GET    | `/api/v1/governance/knowledge`                                            | ADMIN / EXPERT  | List documents; filter by status/topic/language                                                                                                                               |
| GET    | `/api/v1/governance/knowledge/{document_id}`                              | ADMIN / EXPERT  | Document detail with versions                                                                                                                                                 |
| GET    | `/api/v1/governance/knowledge/{document_id}/versions`                     | ADMIN / EXPERT  | List versions                                                                                                                                                                 |
| GET    | `/api/v1/governance/knowledge/{document_id}/versions/{version_id}`        | ADMIN / EXPERT  | Get one version                                                                                                                                                               |
| PATCH  | `/api/v1/governance/knowledge/{document_id}/versions/{version_id}`        | ADMIN           | Update draft; `expected_version`; 409 on conflict                                                                                                                             |
| POST   | `/api/v1/governance/knowledge/{document_id}/versions/{version_id}/submit` | ADMIN           | Submit for review                                                                                                                                                             |
| POST   | `/api/v1/governance/knowledge/{document_id}/versions/new`                 | ADMIN           | New draft from an approved version                                                                                                                                            |
| GET    | `/api/v1/governance/knowledge/{document_id}/compare`                      | ADMIN / EXPERT  | Diff two versions                                                                                                                                                             |
| GET    | `/api/v1/governance/knowledge/{document_id}/review-history`               | ADMIN / EXPERT  | Append-only review records                                                                                                                                                    |
| POST   | `/api/v1/governance/knowledge/{document_id}/retire`                       | ADMIN / EXPERT  | Retire approved content; reason required                                                                                                                                      |
| POST   | `/api/v1/governance/knowledge/{document_id}/restore`                      | **EXPERT only** | Restore retired content; `expected_content_hash`                                                                                                                              |
| GET    | `/api/v1/governance/review-queue`                                         | ADMIN / EXPERT  | List `PENDING_REVIEW` versions                                                                                                                                                |
| GET    | `/api/v1/governance/review-queue/{document_id}/{version_id}`              | ADMIN / EXPERT  | Inspect a queue item                                                                                                                                                          |
| POST   | `/api/v1/governance/review-queue/{document_id}/{version_id}/decision`     | **EXPERT only** | `approve` \| `request_changes` \| `reject`; requires `expected_version` + `expected_content_hash`; comments required for request_changes/reject; 409 on version/hash mismatch |

Approving (or restoring) triggers deterministic re-ingestion into `knowledge_chunks`; the response's `ingestion_status` may be `"failed"` (partial success) — the review decision is still recorded and ingestion can be retried. Patient-facing chat/knowledge endpoints never expose drafts, pending-review content, or review comments — only `APPROVED` and active chunks. See `docs/knowledge-governance-architecture.md`, `docs/medical-review-workflow.md`, `docs/knowledge-versioning-and-hashing.md`, `docs/knowledge-publication-and-ingestion.md`, `docs/knowledge-governance-rbac.md`.

Local cookies: `COOKIE_SECURE=false`, `COOKIE_SAMESITE=lax`, refresh path `/api/v1/auth`. Frontend origin must be listed in `ALLOWED_ORIGINS` (default `http://localhost:5173`) with credentials enabled.

## Database notes

- Driver: `pymongo.AsyncMongoClient`
- Indexes: `DATABASE_AUTO_INITIALIZE` (dev default true)
- Migrations: `DATABASE_RUN_MIGRATIONS` (dev default true; initial migration = indexes only)
- Test DB names must end with `_test`
- See `docs/motor-to-pymongo-async-migration.md` and `docs/database-design.md`

## Tests

```powershell
pytest                                          # unit suite (no Mongo required)
pytest tests/test_knowledge_governance.py -v    # governance-specific tests
pytest -m integration                           # optional; requires authorized local/test Mongo
ruff check app tests
ruff format --check app tests
```

## Known limitations

- Email verification and password reset are not implemented
- Medication/appointment reminders / pharmacy / prescription upload are not implemented
- In-memory rate limiting only (not multi-instance safe)
- Integration index creation requires Mongo authorization
- No production LLM provider wiring and no automatic/AI approval for knowledge governance (human MEDICAL_EXPERT decision only)
- FastAPI is not publicly deployed
