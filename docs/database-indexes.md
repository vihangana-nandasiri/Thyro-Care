# Database indexes

All indexes are defined in `backend/app/db/indexes.py` as named `IndexSpec` entries. Creation is idempotent via `create_index`. Unknown indexes are never dropped.

## Summary

| Collection                  | Index name                                    | Fields                                 | Unique                            | TTL | Rationale                                                |
| --------------------------- | --------------------------------------------- | -------------------------------------- | --------------------------------- | --- | -------------------------------------------------------- |
| users                       | ux_users_email_normalized_active              | email_normalized                       | yes (partial `is_deleted: false`) | no  | Unique active email (Atlas-compatible equality filter)   |
| users                       | ix_users_role                                 | role                                   | no                                | no  | Role queries                                             |
| users                       | ix_users_account_status                       | account_status                         | no                                | no  | Lifecycle filter                                         |
| patient_profiles            | ux_patient_profiles_user_id                   | user_id                                | yes                               | no  | One profile/user                                         |
| patient_profiles            | ix_patient_profiles_is_deleted                | is_deleted                             | no                                | no  | Soft-delete                                              |
| refresh_tokens              | ux_refresh_tokens_token_hash                  | token_hash                             | yes                               | no  | Hash lookup                                              |
| refresh_tokens              | ix_refresh_tokens_user_id                     | user_id                                | no                                | no  | Revocation                                               |
| refresh_tokens              | ix_refresh_tokens_family_id                   | family_id                              | no                                | no  | Rotation                                                 |
| refresh_tokens              | ttl_refresh_tokens_expires_at                 | expires_at                             | no                                | 0s  | Expiry cleanup                                           |
| medications                 | ix_medications_user_status                    | user_id, status                        | no                                | no  | Owner lists                                              |
| medications                 | ix_medications_user_deleted                   | user_id, is_deleted                    | no                                | no  | Soft-delete                                              |
| medications                 | ix_medications_user_created                   | user_id, created_at                    | no                                | no  | Recents                                                  |
| medications                 | ix_medications_user_start                     | user_id, start_date                    | no                                | no  | Start-date lists                                         |
| medication_logs             | ix_medication_logs_user_scheduled             | user_id, scheduled_for                 | no                                | no  | History                                                  |
| medication_logs             | ux_medication_logs_med_scheduled              | medication_id, scheduled_for           | **yes**                           | no  | One log/occurrence                                       |
| medication_logs             | ix_medication_logs_user_status                | user_id, status                        | no                                | no  | Adherence                                                |
| medication_logs             | ix_medication_logs_user_med_recorded          | user_id, medication_id, recorded_at    | no                                | no  | Per-med history                                          |
| appointments                | ix_appointments_user_start                    | user_id, scheduled_start               | no                                | no  | Schedule                                                 |
| appointments                | ix_appointments_user_status_start             | user_id, status, scheduled_start       | no                                | no  | Status lists                                             |
| appointments                | ix_appointments_user_deleted_start            | user_id, is_deleted, scheduled_start   | no                                | no  | Soft-delete + order                                      |
| appointments                | ix_appointments_user_type_start               | user_id, type, scheduled_start         | no                                | no  | Type filter                                              |
| appointments                | ix_appointments_user_created                  | user_id, created_at                    | no                                | no  | Recents                                                  |
| symptoms                    | ix_symptoms_user_started                      | user_id, started_at                    | no                                | no  | Timeline                                                 |
| symptoms                    | ix_symptoms_user_status_started               | user_id, status, started_at            | no                                | no  | Status filter                                            |
| symptoms                    | ix_symptoms_user_type_started                 | user_id, symptom_type, started_at      | no                                | no  | Type filter                                              |
| symptoms                    | ix_symptoms_user_severity_started             | user_id, severity, started_at          | no                                | no  | Severity filter                                          |
| symptoms                    | ix_symptoms_user_deleted_started              | user_id, is_deleted, started_at        | no                                | no  | Soft-delete aware                                        |
| symptoms                    | ix_symptoms_user_created                      | user_id, created_at                    | no                                | no  | Recent                                                   |
| symptom_logs                | ix_symptom_logs_user_created                  | user_id, created_at                    | no                                | no  | Legacy history                                           |
| symptom_logs                | ix_symptom_logs_emergency_created             | emergency_detected, created_at         | no                                | no  | Triage                                                   |
| chat_sessions               | ix_chat_sessions_user_last_message            | user_id, last_message_at               | no                                | no  | Recents                                                  |
| chat_sessions               | ix_chat_sessions_user_archived                | user_id, archived_at                   | no                                | no  | Archive                                                  |
| chat_messages               | ix_chat_messages_session_created              | session_id, created_at                 | no                                | no  | Thread order                                             |
| chat_messages               | ix_chat_messages_user_created                 | user_id, created_at                    | no                                | no  | Owner history                                            |
| chat_messages               | ix_chat_messages_emergency_created            | emergency_detected, created_at         | no                                | no  | Safety                                                   |
| knowledge_documents         | ux_knowledge_docs_document_id                 | document_id                            | yes                               | no  | Stable doc id                                            |
| knowledge_documents         | ix_knowledge_docs_slug_language               | slug, language                         | no                                | no  | Slug lookup                                              |
| knowledge_documents         | ix_knowledge_docs_review_language             | review_status, language                | no                                | no  | Review workflow                                          |
| knowledge_documents         | ix_knowledge_docs_content_hash                | content_hash                           | no                                | no  | Content integrity                                        |
| knowledge_documents         | ix_knowledge_docs_status_active               | status, active                         | no                                | no  | Retrieval set                                            |
| knowledge_documents         | ix_knowledge_docs_category_status             | category, status                       | no                                | no  | Review                                                   |
| knowledge_documents         | ix_knowledge_docs_source_reference            | source_reference                       | no                                | no  | Dedup                                                    |
| knowledge_documents         | ix_knowledge_docs_current_status              | current_status                         | no                                | no  | Governance lifecycle (Phase 12)                          |
| knowledge_documents         | ix_knowledge_docs_current_version             | current_version_id                     | no                                | no  | Parent-by-version lookup (Phase 12)                      |
| knowledge_document_versions | ux_knowledge_versions_version_id              | version_id                             | yes                               | no  | Stable version id (Phase 12)                             |
| knowledge_document_versions | ux_knowledge_versions_document_number         | document_id, version_number            | yes                               | no  | Sequential numbering per document (Phase 12)             |
| knowledge_document_versions | ix_knowledge_versions_review_status_submitted | review_status, submitted_for_review_at | no                                | no  | Medical-expert review-queue order (Phase 12)             |
| knowledge_document_versions | ix_knowledge_versions_content_hash            | content_hash                           | no                                | no  | Content integrity / OCC hash checks (Phase 12)           |
| knowledge_review_records    | ix_knowledge_reviews_version_created          | version_id, created_at                 | no                                | no  | Review history for a version (Phase 12, append-only)     |
| knowledge_review_records    | ix_knowledge_reviews_document_created         | document_id, created_at                | no                                | no  | Review history for a document (Phase 12, append-only)    |
| knowledge_review_records    | ix_knowledge_reviews_reviewer_created         | reviewer_user_id, created_at           | no                                | no  | Reviewer activity timeline (Phase 12, append-only)       |
| knowledge_chunks            | ux_knowledge_chunks_chunk_id                  | chunk_id                               | yes                               | no  | Stable chunk id                                          |
| knowledge_chunks            | ix_knowledge_chunks_doc_version               | document_id, document_version          | no                                | no  | Version-aware chunk sets                                 |
| knowledge_chunks            | ix_knowledge_chunks_review_lang_topic         | review_status, language, topic         | no                                | no  | Approved retrieval filters                               |
| knowledge_chunks            | ix_knowledge_chunks_content_hash              | content_hash                           | no                                | no  | Chunk integrity                                          |
| knowledge_chunks            | ux_knowledge_chunks_document_index            | document_id, chunk_index               | yes                               | no  | Order                                                    |
| knowledge_chunks            | ix_knowledge_chunks_active                    | active                                 | no                                | no  | Active filter                                            |
| knowledge_chunks            | ix_knowledge_chunks_version_id                | version_id                             | no                                | no  | Trace chunk to originating governance version (Phase 12) |
| user_feedback               | ix_feedback_message_user                      | message_id, user_id                    | no                                | no  | Feedback path                                            |
| user_feedback               | ix_feedback_type_created                      | feedback_type, created_at              | no                                | no  | Analytics                                                |
| emergency_events            | ix_emergency_status_created                   | event_status, created_at               | no                                | no  | Queue                                                    |
| emergency_events            | ix_emergency_user_created                     | user_id, created_at                    | no                                | no  | History                                                  |
| notifications               | ix_notifications_user_read_created            | user_id, read_at, created_at           | no                                | no  | Unread                                                   |
| notifications               | ttl_notifications_expires_at                  | expires_at                             | no                                | 0s  | Expiry                                                   |
| audit_logs                  | ix_audit_actor_created                        | actor_user_id, created_at              | no                                | no  | Actor timeline                                           |
| audit_logs                  | ix_audit_entity_created                       | entity_type, entity_id, created_at     | no                                | no  | Entity history                                           |
| audit_logs                  | ix_audit_request_id                           | request_id                             | no                                | no  | Correlation                                              |
| schema_migrations           | ux_schema_migrations_migration_id             | migration_id                           | yes                               | no  | Idempotency                                              |
| schema_migrations           | ix_schema_migrations_applied_at               | applied_at                             | no                                | no  | History                                                  |

## Operational risks

- Conflicting index options with the same name fail loudly (`OperationFailure`)
- TTL requires a BSON date field; null `expires_at` documents are not removed by TTL until set
- Partial unique email index depends on `is_deleted` semantics remaining consistent
- Unique `ux_medication_logs_med_scheduled` prevents duplicate logs for the same occurrence; AS_NEEDED logs must supply an explicit `scheduled_for` chosen by the client
- `knowledge_review_records` is append-only (Phase 12) — its indexes are read/history-only; there is no update/delete path, so no soft-delete index is defined for it
- `ux_knowledge_versions_document_number` enforces sequential, non-duplicate `version_number` values per `document_id`; do not backfill or renumber versions in place
