# Phase 5 — Database Plan

**Date:** 2026-07-11  
**Workspace:** Thyro-Care-t1  
**Baseline:** Phase 4 commit `79323f7`  
**Motor:** 3.7.1 (to be removed)  
**PyMongo:** 4.17.0 (AsyncMongoClient available)  
**Scope:** Persistence foundation only — no auth endpoints, no domain CRUD routes, no AI

---

## 1. Motor → PyMongo Async migration

| Before (Phase 4)                         | After (Phase 5)                               |
| ---------------------------------------- | --------------------------------------------- |
| `motor.motor_asyncio.AsyncIOMotorClient` | `pymongo.AsyncMongoClient`                    |
| `AsyncIOMotorDatabase`                   | `pymongo.asynchronous.database.AsyncDatabase` |
| Motor + PyMongo dual dep                 | PyMongo only                                  |

- One `AsyncMongoClient` per application event loop (lifespan)
- Explicit `serverSelectionTimeoutMS`, `connectTimeoutMS`, `socketTimeoutMS`
- Async ping / async close
- Preserve degraded (non-prod) and unhealthy (prod) health behavior
- Remove `motor` from `requirements.txt` only after tests pass
- Test: no `motor` imports in `backend/app`

## 2. Collection strategy

Centralized names in `app/db/collections.py` (snake_case). Declaring names does **not** create collections; MongoDB creates on first write or explicit init. No seed documents.

Collections: users, patient_profiles, refresh_tokens, medications, medication_logs, appointments, symptom_logs, chat_sessions, chat_messages, knowledge_documents, knowledge_chunks, user_feedback, emergency_events, resources, notifications, audit_logs, schema_migrations.

## 3. Document conventions

Shared mixins / base models:

- `_id` (ObjectId) internally; public `id` string
- `created_at` / `updated_at` UTC-aware
- Soft delete: `is_deleted`, `deleted_at`, `deleted_by` where meaningful
- Audit actors: `created_by` / `updated_by` where meaningful
- `schema_version` (int, default 1)

Not every collection uses every field (e.g. append-only logs omit soft-delete).

## 4. ObjectId strategy

`app/models/object_id.py`:

- Validate ObjectId / hex string
- Serialize to string for API-safe models
- Helpers: `to_object_id()`, `object_id_to_string()`
- No global BSON encoders

## 5. Timestamp strategy

Reuse `app/utils/datetime.py` (`utc_now`, `utc_isoformat`). Repositories set timestamps on insert/update. Schedule fields store UTC + separate `timezone` where needed.

## 6. Schema-version strategy

Integer `schema_version` on documents. Initial value `1`. Migrations record applied versions in `schema_migrations`; no destructive rewrites in Phase 5.

## 7. Soft-delete strategy

Default queries filter `is_deleted=false`. Explicit `include_deleted` for future authorized use. Soft-delete sets `is_deleted`, `deleted_at`, `deleted_by`. Hard delete not provided in base repository.

## 8. Ownership strategy

Patient-owned collections always include `user_id`. Public-service foundations must query by `_id` **and** `user_id` (`get_owned_by_id`). Routes must never access collections directly.

## 9. Repository pattern

- `BaseRepository[T]` — generic async CRUD + soft-delete + pagination
- Domain repositories — ownership-aware query methods only
- Exception mapping: DuplicateKey → Conflict; connection failures → ServiceUnavailable; InvalidId → Validation/NotFound
- No public HTTP endpoints in Phase 5

## 10. Index strategy

Explicit named indexes in `app/db/indexes.py`. Idempotent `create_index`. Never drop unknown indexes. Dev may auto-initialize; production gated by settings.

## 11. TTL strategy

TTL on `refresh_tokens.expires_at` and `notifications.expires_at` (expireAfterSeconds=0). Document rationale and operational caveats.

## 12. Test strategy

- Unit tests with fakes / in-memory adapters / dependency overrides (default `pytest`)
- Marker `@pytest.mark.integration` for optional real Mongo (`*_test` DB only)
- Preserve Phase 4 health/middleware tests
- No production DB; no Atlas required for unit suite

## 13. Privacy strategy

Data minimization: no national ID, home address, full medical records, lab results, plaintext passwords/tokens. Symptom free text optional + length-capped; never logged. Audit logs exclude medical free text and secrets. Documented in `docs/database-privacy-design.md` (privacy-by-design; not a compliance claim).

## 14. Deferred Phase 6 work

Registration, login, password hashing, JWT/refresh workflows, public profile/medication/appointment/symptom/chat endpoints, frontend wiring, AI/RAG, seed data.

## 15. Validation strategy

After each major change: `ruff check`, `ruff format --check`, `pytest`. Final: health endpoints, OpenAPI, frontend typecheck/lint/format/build. Mark Phase 5 complete only if all pass. Stop before Phase 6.

## Collection-validation decision (preview)

**Pydantic is primary validation.** MongoDB JSON Schema validators deferred (document in `docs/database-validation-strategy.md`) to avoid blocking controlled schema migrations and duplicating every rule.
