"""Centralized MongoDB collection names (snake_case).

Declaring a name does not create the collection; MongoDB creates
collections on first write or via explicit initialization.
"""

from __future__ import annotations

from enum import StrEnum


class CollectionName(StrEnum):
    USERS = "users"
    PATIENT_PROFILES = "patient_profiles"
    REFRESH_TOKENS = "refresh_tokens"
    MEDICATIONS = "medications"
    MEDICATION_LOGS = "medication_logs"
    APPOINTMENTS = "appointments"
    SYMPTOMS = "symptoms"
    SYMPTOM_LOGS = "symptom_logs"
    CHAT_SESSIONS = "chat_sessions"
    CHAT_MESSAGES = "chat_messages"
    KNOWLEDGE_DOCUMENTS = "knowledge_documents"
    KNOWLEDGE_DOCUMENT_VERSIONS = "knowledge_document_versions"
    KNOWLEDGE_REVIEW_RECORDS = "knowledge_review_records"
    KNOWLEDGE_CHUNKS = "knowledge_chunks"
    USER_FEEDBACK = "user_feedback"
    EMERGENCY_EVENTS = "emergency_events"
    RESOURCES = "resources"
    NOTIFICATIONS = "notifications"
    AUDIT_LOGS = "audit_logs"
    AUTH_ACTION_TOKENS = "auth_action_tokens"
    AUTH_IDENTITIES = "auth_identities"
    KNOWLEDGE_CHUNK_EMBEDDINGS = "knowledge_chunk_embeddings"
    CHAT_RESPONSE_FEEDBACK = "chat_response_feedback"
    CHAT_USAGE_METRICS = "chat_usage_metrics"
    SCHEMA_MIGRATIONS = "schema_migrations"


ALL_COLLECTION_NAMES: tuple[str, ...] = tuple(c.value for c in CollectionName)
