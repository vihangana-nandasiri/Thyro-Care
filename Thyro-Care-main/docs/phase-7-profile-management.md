# Phase 7 — Patient Profile Management

## Summary

Authenticated patients can retrieve and update their own support profile. Account identity remains on `users`. Consent timestamps from registration are preserved. Optimistic concurrency and privacy-safe audits are enforced.

## Delivered

- `GET` / `PATCH /api/v1/profiles/me`
- Profile enums, schemas, phone normalization, completion service
- Ownership via `require_patient()` + `user_id` repository filter
- Frontend Profile page wired to API (mock identity/profile fields removed from that page)
- Docs: architecture, data dictionary, validation

## Not delivered (deferred)

- Medication / appointment / symptom CRUD
- Chatbot / AI / RAG
- File uploads
- Email or password change
- Admin profile management
- Diagnosis fields

## Related docs

- `docs/phase-7-profile-plan.md`
- `docs/patient-profile-architecture.md`
- `docs/profile-data-dictionary.md`
- `docs/phase-7-validation.md`
