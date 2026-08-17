# Patient Profile Architecture

Phase 7 patient self-profile management for ThyroCare AI.

> This profile is **support metadata**, not a medical record. It does not provide diagnosis or clinical decision-making.

## Separation

| Concern                                               | Store              | Mutable via `/profiles/me`              |
| ----------------------------------------------------- | ------------------ | --------------------------------------- |
| Email, full name, role, account status                | `users`            | No                                      |
| Support fields, emergency contact, consent timestamps | `patient_profiles` | Editable fields only; consent read-only |

## Endpoints

- `GET /api/v1/profiles/me` — Bearer PATIENT token; returns `{ profile, account }`
- `PATCH /api/v1/profiles/me` — partial update; requires `expected_version`

Ownership is always derived from the access token. Clients never send `user_id` or profile id.

## Consent

Consent and disclaimer flags/timestamps are set at registration and preserved on every update. Update schemas forbid changing them.

## Concurrency

Integer `version` on the profile document. PATCH matches `user_id` + `version`, then `$inc` version. Mismatch → HTTP 409.

## Completion

Deterministic 0–100 score over eight optional support fields. Consent is excluded. Score has no medical meaning.

## Audit

`PROFILE_UPDATED` records changed field **names** only — never emergency-contact or medication-summary values.
