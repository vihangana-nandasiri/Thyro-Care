"""Explicit, named, idempotent MongoDB index definitions."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from pymongo import ASCENDING, DESCENDING
from pymongo.asynchronous.database import AsyncDatabase
from pymongo.errors import OperationFailure

from app.core.logging import get_logger
from app.db.collections import CollectionName

logger = get_logger(__name__)


@dataclass(frozen=True, slots=True)
class IndexSpec:
    collection: str
    name: str
    keys: list[tuple[str, int]]
    unique: bool = False
    expire_after_seconds: int | None = None
    partial_filter: dict[str, Any] | None = None
    rationale: str = ""


INDEX_SPECS: tuple[IndexSpec, ...] = (
    # users
    IndexSpec(
        CollectionName.USERS.value,
        "ux_users_email_normalized_active",
        [("email_normalized", ASCENDING)],
        unique=True,
        partial_filter={"is_deleted": False},
        rationale="Unique login email for non-deleted users",
    ),
    IndexSpec(
        CollectionName.USERS.value,
        "ix_users_role",
        [("role", ASCENDING)],
        rationale="Role-based admin queries",
    ),
    IndexSpec(
        CollectionName.USERS.value,
        "ix_users_account_status",
        [("account_status", ASCENDING)],
        rationale="Account lifecycle filtering",
    ),
    # patient_profiles
    IndexSpec(
        CollectionName.PATIENT_PROFILES.value,
        "ux_patient_profiles_user_id",
        [("user_id", ASCENDING)],
        unique=True,
        rationale="One profile per user",
    ),
    IndexSpec(
        CollectionName.PATIENT_PROFILES.value,
        "ix_patient_profiles_is_deleted",
        [("is_deleted", ASCENDING)],
        rationale="Soft-delete filtering",
    ),
    # refresh_tokens
    IndexSpec(
        CollectionName.REFRESH_TOKENS.value,
        "ux_refresh_tokens_token_hash",
        [("token_hash", ASCENDING)],
        unique=True,
        rationale="Lookup hashed refresh tokens",
    ),
    IndexSpec(
        CollectionName.REFRESH_TOKENS.value,
        "ix_refresh_tokens_user_id",
        [("user_id", ASCENDING)],
        rationale="Revoke tokens for a user",
    ),
    IndexSpec(
        CollectionName.REFRESH_TOKENS.value,
        "ix_refresh_tokens_family_id",
        [("family_id", ASCENDING)],
        rationale="Refresh token family rotation",
    ),
    IndexSpec(
        CollectionName.REFRESH_TOKENS.value,
        "ttl_refresh_tokens_expires_at",
        [("expires_at", ASCENDING)],
        expire_after_seconds=0,
        rationale="TTL cleanup of expired refresh tokens",
    ),
    # auth_action_tokens
    IndexSpec(
        CollectionName.AUTH_ACTION_TOKENS.value,
        "ux_auth_action_tokens_token_hash",
        [("token_hash", ASCENDING)],
        unique=True,
        rationale="Lookup hashed email-verification / password-reset tokens",
    ),
    IndexSpec(
        CollectionName.AUTH_ACTION_TOKENS.value,
        "ix_auth_action_tokens_user_purpose",
        [("user_id", ASCENDING), ("purpose", ASCENDING)],
        rationale="Invalidate prior active tokens per user and purpose",
    ),
    IndexSpec(
        CollectionName.AUTH_ACTION_TOKENS.value,
        "ttl_auth_action_tokens_expires_at",
        [("expires_at", ASCENDING)],
        expire_after_seconds=0,
        rationale="TTL cleanup for expired auth action tokens",
    ),
    # auth_identities
    IndexSpec(
        CollectionName.AUTH_IDENTITIES.value,
        "ux_auth_identities_provider_subject",
        [("provider", ASCENDING), ("provider_subject", ASCENDING)],
        unique=True,
        rationale="One Google subject maps to one identity",
    ),
    IndexSpec(
        CollectionName.AUTH_IDENTITIES.value,
        "ux_auth_identities_user_provider",
        [("user_id", ASCENDING), ("provider", ASCENDING)],
        unique=True,
        rationale="At most one Google identity per user",
    ),
    # knowledge_chunk_embeddings (Phase 13B)
    IndexSpec(
        CollectionName.KNOWLEDGE_CHUNK_EMBEDDINGS.value,
        "ux_chunk_embeddings_chunk_hash_model",
        [
            ("chunk_id", ASCENDING),
            ("content_hash", ASCENDING),
            ("embedding_model", ASCENDING),
        ],
        unique=True,
        rationale="Idempotent embedding identity per chunk content and model",
    ),
    IndexSpec(
        CollectionName.KNOWLEDGE_CHUNK_EMBEDDINGS.value,
        "ix_chunk_embeddings_active_status",
        [("active", ASCENDING), ("review_status", ASCENDING)],
        rationale="Active approved embedding filtering",
    ),
    IndexSpec(
        CollectionName.KNOWLEDGE_CHUNK_EMBEDDINGS.value,
        "ix_chunk_embeddings_lang_topic",
        [("language", ASCENDING), ("topic", ASCENDING)],
        rationale="Language/topic filtered semantic retrieval",
    ),
    IndexSpec(
        CollectionName.KNOWLEDGE_CHUNK_EMBEDDINGS.value,
        "ix_chunk_embeddings_document",
        [("document_id", ASCENDING)],
        rationale="Document lifecycle embedding deactivation",
    ),
    IndexSpec(
        CollectionName.CHAT_RESPONSE_FEEDBACK.value,
        "ux_chat_feedback_user_message",
        [("user_id", ASCENDING), ("assistant_message_id", ASCENDING)],
        unique=True,
        rationale="One active feedback record per user/message",
    ),
    # medications
    IndexSpec(
        CollectionName.MEDICATIONS.value,
        "ix_medications_user_status",
        [("user_id", ASCENDING), ("status", ASCENDING)],
        rationale="List medications by status for owner",
    ),
    IndexSpec(
        CollectionName.MEDICATIONS.value,
        "ix_medications_user_deleted",
        [("user_id", ASCENDING), ("is_deleted", ASCENDING)],
        rationale="Owner soft-delete filtering",
    ),
    IndexSpec(
        CollectionName.MEDICATIONS.value,
        "ix_medications_user_created",
        [("user_id", ASCENDING), ("created_at", DESCENDING)],
        rationale="Recent medications for owner",
    ),
    IndexSpec(
        CollectionName.MEDICATIONS.value,
        "ix_medications_user_start",
        [("user_id", ASCENDING), ("start_date", ASCENDING)],
        rationale="Owner medications by start date",
    ),
    # medication_logs
    IndexSpec(
        CollectionName.MEDICATION_LOGS.value,
        "ix_medication_logs_user_scheduled",
        [("user_id", ASCENDING), ("scheduled_for", ASCENDING)],
        rationale="Owner schedule history",
    ),
    IndexSpec(
        CollectionName.MEDICATION_LOGS.value,
        "ux_medication_logs_med_scheduled",
        [("medication_id", ASCENDING), ("scheduled_for", ASCENDING)],
        unique=True,
        rationale="One log per medication occurrence (AS_NEEDED uses explicit scheduled_for)",
    ),
    IndexSpec(
        CollectionName.MEDICATION_LOGS.value,
        "ix_medication_logs_user_status",
        [("user_id", ASCENDING), ("status", ASCENDING)],
        rationale="Filter logs by adherence status",
    ),
    IndexSpec(
        CollectionName.MEDICATION_LOGS.value,
        "ix_medication_logs_user_med_recorded",
        [("user_id", ASCENDING), ("medication_id", ASCENDING), ("recorded_at", DESCENDING)],
        rationale="Owner medication log history by recorded time",
    ),
    # appointments
    IndexSpec(
        CollectionName.APPOINTMENTS.value,
        "ix_appointments_user_start",
        [("user_id", ASCENDING), ("scheduled_start", ASCENDING)],
        rationale="Upcoming schedule for owner",
    ),
    IndexSpec(
        CollectionName.APPOINTMENTS.value,
        "ix_appointments_user_status_start",
        [("user_id", ASCENDING), ("status", ASCENDING), ("scheduled_start", ASCENDING)],
        rationale="Status-filtered appointment lists",
    ),
    IndexSpec(
        CollectionName.APPOINTMENTS.value,
        "ix_appointments_user_deleted_start",
        [("user_id", ASCENDING), ("is_deleted", ASCENDING), ("scheduled_start", ASCENDING)],
        rationale="Owner soft-delete filtering with schedule order",
    ),
    IndexSpec(
        CollectionName.APPOINTMENTS.value,
        "ix_appointments_user_type_start",
        [
            ("user_id", ASCENDING),
            ("appointment_type", ASCENDING),
            ("scheduled_start", ASCENDING),
        ],
        rationale="Filter appointments by type for owner",
    ),
    IndexSpec(
        CollectionName.APPOINTMENTS.value,
        "ix_appointments_user_created",
        [("user_id", ASCENDING), ("created_at", DESCENDING)],
        rationale="Recent appointments for owner",
    ),
    # symptoms (Phase 10)
    IndexSpec(
        CollectionName.SYMPTOMS.value,
        "ix_symptoms_user_started",
        [("user_id", ASCENDING), ("started_at", DESCENDING)],
        rationale="Owner symptom timeline by start time",
    ),
    IndexSpec(
        CollectionName.SYMPTOMS.value,
        "ix_symptoms_user_status_started",
        [("user_id", ASCENDING), ("status", ASCENDING), ("started_at", DESCENDING)],
        rationale="Filter by status for owner",
    ),
    IndexSpec(
        CollectionName.SYMPTOMS.value,
        "ix_symptoms_user_type_started",
        [("user_id", ASCENDING), ("symptom_type", ASCENDING), ("started_at", DESCENDING)],
        rationale="Filter by symptom type for owner",
    ),
    IndexSpec(
        CollectionName.SYMPTOMS.value,
        "ix_symptoms_user_severity_started",
        [("user_id", ASCENDING), ("severity", ASCENDING), ("started_at", DESCENDING)],
        rationale="Filter by severity for owner",
    ),
    IndexSpec(
        CollectionName.SYMPTOMS.value,
        "ix_symptoms_user_deleted_started",
        [("user_id", ASCENDING), ("is_deleted", ASCENDING), ("started_at", DESCENDING)],
        rationale="Soft-delete aware owner timeline",
    ),
    IndexSpec(
        CollectionName.SYMPTOMS.value,
        "ix_symptoms_user_created",
        [("user_id", ASCENDING), ("created_at", DESCENDING)],
        rationale="Recent symptoms for owner",
    ),
    # symptom_logs (legacy foundation)
    IndexSpec(
        CollectionName.SYMPTOM_LOGS.value,
        "ix_symptom_logs_user_created",
        [("user_id", ASCENDING), ("created_at", DESCENDING)],
        rationale="Owner symptom history",
    ),
    IndexSpec(
        CollectionName.SYMPTOM_LOGS.value,
        "ix_symptom_logs_emergency_created",
        [("emergency_detected", ASCENDING), ("created_at", DESCENDING)],
        rationale="Operational emergency review",
    ),
    # chat
    IndexSpec(
        CollectionName.CHAT_SESSIONS.value,
        "ix_chat_sessions_user_last_message",
        [("user_id", ASCENDING), ("last_message_at", DESCENDING)],
        rationale="Recent conversations for owner",
    ),
    IndexSpec(
        CollectionName.CHAT_SESSIONS.value,
        "ix_chat_sessions_user_updated",
        [("user_id", ASCENDING), ("updated_at", DESCENDING)],
        rationale="Owner session list by update time",
    ),
    IndexSpec(
        CollectionName.CHAT_SESSIONS.value,
        "ix_chat_sessions_user_deleted_updated",
        [("user_id", ASCENDING), ("is_deleted", ASCENDING), ("updated_at", DESCENDING)],
        rationale="Soft-delete aware session list",
    ),
    IndexSpec(
        CollectionName.CHAT_SESSIONS.value,
        "ix_chat_sessions_user_archived",
        [("user_id", ASCENDING), ("archived_at", ASCENDING)],
        rationale="Archive filtering",
    ),
    IndexSpec(
        CollectionName.CHAT_MESSAGES.value,
        "ix_chat_messages_session_created",
        [("session_id", ASCENDING), ("created_at", ASCENDING)],
        rationale="Ordered messages in a session",
    ),
    IndexSpec(
        CollectionName.CHAT_MESSAGES.value,
        "ix_chat_messages_user_session_created",
        [("user_id", ASCENDING), ("session_id", ASCENDING), ("created_at", ASCENDING)],
        rationale="Owner-scoped session transcript",
    ),
    IndexSpec(
        CollectionName.CHAT_MESSAGES.value,
        "ix_chat_messages_user_created",
        [("user_id", ASCENDING), ("created_at", DESCENDING)],
        rationale="Owner message history",
    ),
    IndexSpec(
        CollectionName.CHAT_MESSAGES.value,
        "ix_chat_messages_user_deleted",
        [("user_id", ASCENDING), ("is_deleted", ASCENDING)],
        rationale="Soft-delete filtering for messages",
    ),
    IndexSpec(
        CollectionName.CHAT_MESSAGES.value,
        "ix_chat_messages_emergency_created",
        [("emergency_detected", ASCENDING), ("created_at", DESCENDING)],
        rationale="Emergency chat review",
    ),
    # knowledge
    IndexSpec(
        CollectionName.KNOWLEDGE_DOCUMENTS.value,
        "ux_knowledge_docs_document_id",
        [("document_id", ASCENDING)],
        unique=True,
        rationale="Stable knowledge document identifier",
    ),
    IndexSpec(
        CollectionName.KNOWLEDGE_DOCUMENTS.value,
        "ix_knowledge_docs_slug_language",
        [("slug", ASCENDING), ("language", ASCENDING)],
        rationale="Slug lookup by language",
    ),
    IndexSpec(
        CollectionName.KNOWLEDGE_DOCUMENTS.value,
        "ix_knowledge_docs_review_language",
        [("review_status", ASCENDING), ("language", ASCENDING)],
        rationale="Review workflow filtering",
    ),
    IndexSpec(
        CollectionName.KNOWLEDGE_DOCUMENTS.value,
        "ix_knowledge_docs_content_hash",
        [("content_hash", ASCENDING)],
        rationale="Content integrity / idempotent ingest",
    ),
    IndexSpec(
        CollectionName.KNOWLEDGE_DOCUMENTS.value,
        "ix_knowledge_docs_status_active",
        [("status", ASCENDING), ("active", ASCENDING)],
        rationale="Approved active retrieval set",
    ),
    IndexSpec(
        CollectionName.KNOWLEDGE_DOCUMENTS.value,
        "ix_knowledge_docs_category_status",
        [("category", ASCENDING), ("status", ASCENDING)],
        rationale="Category browsing for reviewers",
    ),
    IndexSpec(
        CollectionName.KNOWLEDGE_DOCUMENTS.value,
        "ix_knowledge_docs_source_reference",
        [("source_reference", ASCENDING)],
        rationale="Deduplicate source references",
    ),
    IndexSpec(
        CollectionName.KNOWLEDGE_DOCUMENTS.value,
        "ix_knowledge_docs_current_status",
        [("current_status", ASCENDING)],
        rationale="Governance lifecycle filtering",
    ),
    IndexSpec(
        CollectionName.KNOWLEDGE_DOCUMENTS.value,
        "ix_knowledge_docs_current_version",
        [("current_version_id", ASCENDING)],
        rationale="Lookup parent by current version",
    ),
    # knowledge_document_versions (Phase 12)
    IndexSpec(
        CollectionName.KNOWLEDGE_DOCUMENT_VERSIONS.value,
        "ux_knowledge_versions_version_id",
        [("version_id", ASCENDING)],
        unique=True,
        rationale="Stable version identifier",
    ),
    IndexSpec(
        CollectionName.KNOWLEDGE_DOCUMENT_VERSIONS.value,
        "ux_knowledge_versions_document_number",
        [("document_id", ASCENDING), ("version_number", ASCENDING)],
        unique=True,
        rationale="Unique sequential version numbering per document",
    ),
    IndexSpec(
        CollectionName.KNOWLEDGE_DOCUMENT_VERSIONS.value,
        "ix_knowledge_versions_review_status_submitted",
        [("review_status", ASCENDING), ("submitted_for_review_at", ASCENDING)],
        rationale="Medical-expert review queue ordering",
    ),
    IndexSpec(
        CollectionName.KNOWLEDGE_DOCUMENT_VERSIONS.value,
        "ix_knowledge_versions_content_hash",
        [("content_hash", ASCENDING)],
        rationale="Content integrity checks",
    ),
    # knowledge_review_records (Phase 12, append-only)
    IndexSpec(
        CollectionName.KNOWLEDGE_REVIEW_RECORDS.value,
        "ix_knowledge_reviews_version_created",
        [("version_id", ASCENDING), ("created_at", DESCENDING)],
        rationale="Review history for a version",
    ),
    IndexSpec(
        CollectionName.KNOWLEDGE_REVIEW_RECORDS.value,
        "ix_knowledge_reviews_document_created",
        [("document_id", ASCENDING), ("created_at", DESCENDING)],
        rationale="Review history for a document",
    ),
    IndexSpec(
        CollectionName.KNOWLEDGE_REVIEW_RECORDS.value,
        "ix_knowledge_reviews_reviewer_created",
        [("reviewer_user_id", ASCENDING), ("created_at", DESCENDING)],
        rationale="Reviewer activity timeline",
    ),
    IndexSpec(
        CollectionName.KNOWLEDGE_CHUNKS.value,
        "ux_knowledge_chunks_chunk_id",
        [("chunk_id", ASCENDING)],
        unique=True,
        rationale="Stable chunk identifier",
    ),
    IndexSpec(
        CollectionName.KNOWLEDGE_CHUNKS.value,
        "ix_knowledge_chunks_doc_version",
        [("document_id", ASCENDING), ("document_version", ASCENDING)],
        rationale="Version-aware chunk sets",
    ),
    IndexSpec(
        CollectionName.KNOWLEDGE_CHUNKS.value,
        "ix_knowledge_chunks_review_lang_topic",
        [("review_status", ASCENDING), ("language", ASCENDING), ("topic", ASCENDING)],
        rationale="Approved retrieval filters",
    ),
    IndexSpec(
        CollectionName.KNOWLEDGE_CHUNKS.value,
        "ix_knowledge_chunks_content_hash",
        [("content_hash", ASCENDING)],
        rationale="Chunk integrity",
    ),
    IndexSpec(
        CollectionName.KNOWLEDGE_CHUNKS.value,
        "ux_knowledge_chunks_document_index",
        [("document_id", ASCENDING), ("chunk_index", ASCENDING)],
        unique=True,
        rationale="Unique chunk order per document",
    ),
    IndexSpec(
        CollectionName.KNOWLEDGE_CHUNKS.value,
        "ix_knowledge_chunks_active",
        [("active", ASCENDING)],
        rationale="Active chunk filtering",
    ),
    IndexSpec(
        CollectionName.KNOWLEDGE_CHUNKS.value,
        "ix_knowledge_chunks_version_id",
        [("version_id", ASCENDING)],
        rationale="Trace chunks back to originating governance version",
    ),
    # feedback / emergency / notifications / audit / migrations
    IndexSpec(
        CollectionName.USER_FEEDBACK.value,
        "ix_feedback_message_user",
        [("message_id", ASCENDING), ("user_id", ASCENDING)],
        rationale="One feedback path per user/message",
    ),
    IndexSpec(
        CollectionName.USER_FEEDBACK.value,
        "ix_feedback_type_created",
        [("feedback_type", ASCENDING), ("created_at", DESCENDING)],
        rationale="Feedback analytics",
    ),
    IndexSpec(
        CollectionName.EMERGENCY_EVENTS.value,
        "ix_emergency_status_created",
        [("event_status", ASCENDING), ("created_at", DESCENDING)],
        rationale="Triage queue",
    ),
    IndexSpec(
        CollectionName.EMERGENCY_EVENTS.value,
        "ix_emergency_user_created",
        [("user_id", ASCENDING), ("created_at", DESCENDING)],
        rationale="Per-user emergency history",
    ),
    IndexSpec(
        CollectionName.NOTIFICATIONS.value,
        "ix_notifications_user_read_created",
        [("user_id", ASCENDING), ("read_at", ASCENDING), ("created_at", DESCENDING)],
        rationale="Unread notification lists",
    ),
    IndexSpec(
        CollectionName.NOTIFICATIONS.value,
        "ttl_notifications_expires_at",
        [("expires_at", ASCENDING)],
        expire_after_seconds=0,
        rationale="TTL cleanup of expired notifications",
    ),
    IndexSpec(
        CollectionName.AUDIT_LOGS.value,
        "ix_audit_actor_created",
        [("actor_user_id", ASCENDING), ("created_at", DESCENDING)],
        rationale="Actor activity timeline",
    ),
    IndexSpec(
        CollectionName.AUDIT_LOGS.value,
        "ix_audit_entity_created",
        [("entity_type", ASCENDING), ("entity_id", ASCENDING), ("created_at", DESCENDING)],
        rationale="Entity change history",
    ),
    IndexSpec(
        CollectionName.AUDIT_LOGS.value,
        "ix_audit_request_id",
        [("request_id", ASCENDING)],
        rationale="Correlate audit entries to request ID",
    ),
    IndexSpec(
        CollectionName.SCHEMA_MIGRATIONS.value,
        "ux_schema_migrations_migration_id",
        [("migration_id", ASCENDING)],
        unique=True,
        rationale="Idempotent migration registry",
    ),
    IndexSpec(
        CollectionName.SCHEMA_MIGRATIONS.value,
        "ix_schema_migrations_applied_at",
        [("applied_at", DESCENDING)],
        rationale="Migration history ordering",
    ),
)


def list_index_names() -> list[str]:
    return [spec.name for spec in INDEX_SPECS]


def list_ttl_indexes() -> list[IndexSpec]:
    return [spec for spec in INDEX_SPECS if spec.expire_after_seconds is not None]


def assert_index_names_unique() -> None:
    names = list_index_names()
    if len(names) != len(set(names)):
        raise RuntimeError("Duplicate index names in INDEX_SPECS")


async def ensure_indexes(database: AsyncDatabase | None = None) -> int:
    """Create all defined indexes idempotently. Returns count created/ensured."""
    from app.db.mongodb import get_database, mongo_state

    assert_index_names_unique()
    db = get_database() if database is None else database
    if db is None:
        logger.info("ensure_indexes(): skipped — database unavailable")
        return 0

    created = 0
    for spec in INDEX_SPECS:
        kwargs: dict[str, Any] = {"name": spec.name, "unique": spec.unique}
        if spec.expire_after_seconds is not None:
            kwargs["expireAfterSeconds"] = spec.expire_after_seconds
        if spec.partial_filter is not None:
            kwargs["partialFilterExpression"] = spec.partial_filter
        try:
            await db[spec.collection].create_index(spec.keys, **kwargs)
            created += 1
            logger.info("Index ensured: %s.%s", spec.collection, spec.name)
        except OperationFailure as exc:
            # IndexOptionsConflict / IndexKeySpecsConflict: drop by name and recreate
            # so Atlas can replace an incompatible prior definition (e.g. $ne partial).
            code = getattr(exc, "code", None)
            if code in {85, 86}:
                logger.warning(
                    "Recreating incompatible index %s.%s (code=%s)",
                    spec.collection,
                    spec.name,
                    code,
                )
                await db[spec.collection].drop_index(spec.name)
                await db[spec.collection].create_index(spec.keys, **kwargs)
                created += 1
                logger.info("Index recreated: %s.%s", spec.collection, spec.name)
                continue
            logger.error(
                "Index conflict or failure for %s.%s (code=%s)",
                spec.collection,
                spec.name,
                code,
            )
            raise
    mongo_state.initialized = True
    return created


def assert_partial_filters_atlas_compatible() -> None:
    """Reject Atlas-unsupported operators in partialFilterExpression definitions."""
    forbidden_ops = {"$ne", "$not", "$nin", "$exists"}
    for spec in INDEX_SPECS:
        if not spec.partial_filter:
            continue
        _assert_partial_filter_node(spec.name, spec.partial_filter, forbidden_ops)


def _assert_partial_filter_node(index_name: str, node: Any, forbidden_ops: set[str]) -> None:
    if isinstance(node, dict):
        for key, value in node.items():
            if key in forbidden_ops:
                # Atlas allows {"field": {"$exists": True}} in some versions, but
                # "$exists: false" and $ne/$not/$nin are unsafe for this project.
                if key == "$exists" and value is True:
                    continue
                raise RuntimeError(
                    f"Unsupported partial filter operator {key} on index {index_name}"
                )
            _assert_partial_filter_node(index_name, value, forbidden_ops)
    elif isinstance(node, list):
        for item in node:
            _assert_partial_filter_node(index_name, item, forbidden_ops)
