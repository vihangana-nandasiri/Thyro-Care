# Phase 7 — Patient Profile Management Plan

Date: 2026-07-11  
Workspace: `Thyro-Care-t1`

## Baseline (pre-implementation)

| Check                                      | Result                          |
| ------------------------------------------ | ------------------------------- |
| Backend ruff / format                      | PASS                            |
| Backend pytest                             | 60 passed, 1 skipped            |
| Frontend typecheck / lint / format / build | PASS (2 react-refresh warnings) |

## Approved profile fields

Editable (patient self-service):

- `age_range`
- `preferred_language`
- `surgery_date`
- `rai_treatment_status`
- `treatment_stage`
- `emergency_contact_name`
- `emergency_contact_phone`
- `current_medication_summary`
- `expected_version` (concurrency token, not persisted as input)

Read-only on profile:

- consent / disclaimer flags and timestamps
- `created_at`, `updated_at`, `version`
- `profile_completion_percentage` (computed)

Account identity (users collection, not profile updates):

- `id`, `full_name`, `email`, `role`, `account_status`, `email_verified`, `created_at`

## Account / profile separation

- Email, name, role, and account status live only on `users`.
- Profile stores support metadata and emergency contact only.
- No national ID, exact home address, labs, uploads, diagnosis, or TNM staging.
- Public registration already creates a minimal profile with consent timestamps.

## Ownership strategy

- `GET` / `PATCH /api/v1/profiles/me` require `require_patient()`.
- User identity comes from the access token + persisted user load.
- Repository queries always filter by authenticated `user_id`.
- No `user_id` or profile `_id` accepted from clients.
- Admin / medical_expert cannot use the patient self-profile endpoints.

## Consent-preservation strategy

- Update payloads forbid consent/disclaimer fields.
- Repository update `$set` never includes consent fields.
- Registration timestamps remain authoritative.
- Missing-profile legacy: only create a shell when trusted registration consent evidence exists; otherwise return a safe initialization error (do not fabricate consent).

## Optimistic-concurrency strategy

- Persist integer `version` on profile documents (default 1).
- PATCH requires `expected_version`.
- Atomic update: match `user_id` + `version` + not deleted, then `$set` fields and `$inc: { version: 1 }`.
- Mismatch → repository conflict → HTTP 409 with safe message.

## Validation strategy

- Pydantic `extra="forbid"` on update schemas.
- Enums: AgeRange, PreferredLanguage, RAITreatmentStatus, TreatmentStage (stable lowercase/snake string values aligned FE/BE).
- Empty optional strings → `null`.
- Phone normalization utility (optional field).
- Surgery date: not unreasonably far in the future.
- Medication summary max length 500.

## Audit strategy

- `PROFILE_UPDATED` with changed **field names only**.
- Include actor user id, request id, entity id, timestamp.
- Never log emergency contact, medication summary, bodies, or tokens.
- Audit write failure is best-effort (does not roll back successful update).

## Frontend integration

- Types + `profileService` using authenticated Axios client.
- Replace Profile page mock identity/editable fields with API data.
- Preserve visual design; email/role/consent read-only.
- Loading / error / saving / 409 conflict UX with Reload Profile.
- Sidebar/TopBar already use auth user; keep that.
- Dashboard: only update existing name/summary surfaces if present (no new cards).
- Do not cache profile in localStorage.

## Test strategy

- Schema, phone, completion, repository concurrency, API authz, audit field-name-only.
- In-memory DB fakes (no Atlas).
- Preserve auth and health tests.

## Deferred features

- Medication CRUD, appointments, symptoms, AI/RAG, file uploads, email/password change, admin profile management, diagnosis fields.

## Implementation order

1. Enums + model `version`
2. Schemas + phone + completion
3. Repository + service + API
4. Backend tests
5. Frontend types/service/schemas/page
6. Docs + validation + commit/push
