# Database privacy design

ThyroCare AI follows **privacy-by-design** and **data-minimization** principles for a patient-support research prototype. This document is **not** a legal compliance claim (including GDPR).

## Collection purposes (minimum data)

| Collection         | Purpose              | Sensitive fields             | Deliberately excluded                         |
| ------------------ | -------------------- | ---------------------------- | --------------------------------------------- |
| users              | Account identity     | email, password_hash         | demographics beyond name                      |
| patient_profiles   | Survivorship context | emergency contact (optional) | national ID, home address, full records, labs |
| medications / logs | Reminder support     | dosage_text (informational)  | system dosing recommendations                 |
| appointments       | Scheduling           | notes                        | calendar OAuth tokens                         |
| symptom_logs       | Assessment history   | optional free text           | diagnosis, clinical certainty                 |
| chat\_\*           | Future support chat  | message content              | hidden chain-of-thought, prompts, secrets     |
| knowledge\_\*      | Curated education    | content                      | unverified scraped medical text               |
| refresh_tokens     | Future auth          | token_hash only              | plaintext tokens                              |
| audit_logs         | Security/ops         | actor ids, action            | medical free text, secrets                    |
| emergency_events   | Safety workflow      | rule ids                     | full clinical narratives                      |

## Ownership

Patient-owned documents always include `user_id`. Repository foundations query by `_id` **and** `user_id` for owned reads.

## Soft delete

Soft-deleted records are filtered by default. Hard deletes are not part of Phase 5 repositories.

## Retention (guidance)

- Refresh tokens / notifications: TTL indexes on expiry fields
- Chat and symptom free text: retain only as long as research/support needs require; future phases should define retention jobs
- Audit logs: longer retention for security review; keep summaries non-clinical

## Logging rules

- Never log MongoDB URIs, password hashes, tokens, or symptom/chat free text by default
- Prefer request IDs for correlation

## Passwords and tokens

- Store password_hash / token_hash only (hashing workflows deferred to Phase 6)
- Never expose hashes in public schemas

## Future considerations

- Encryption at rest (MongoDB/provider)
- Backup access controls
- Research anonymization / aggregation exports
