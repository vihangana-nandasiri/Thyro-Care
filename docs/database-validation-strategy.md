# Database validation strategy

**Decision (Phase 5):** Pydantic remains the primary application validation layer.

## Why

- Domain rules live next to typed models used by repositories and future services
- Avoids duplicating every constraint in MongoDB JSON Schema
- Reduces risk of `collMod` conflicts blocking controlled schema migrations

## MongoDB validators

Deferred. Critical uniqueness/invariants are enforced with indexes (unique email, unique profile `user_id`, unique chunk `(document_id, chunk_index)`, unique migration id).

If validators are added later:

- Keep them minimal (required keys / enums)
- Make application of validators idempotent and opt-in
- Never overwrite stricter production validators automatically
- Avoid destructive `collMod` without explicit configuration
