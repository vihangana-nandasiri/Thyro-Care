"""Supporting persistence documents (feedback, emergency, resources, etc.)."""

from __future__ import annotations

from datetime import date, datetime

from pydantic import Field

from app.models.base import DocumentBase, SoftDeletableDocument, TimestampFields
from app.models.enums import EmergencyEventStatus, FeedbackType
from app.models.object_id import PyObjectId
from app.utils.datetime import utc_now


class UserFeedbackDocument(DocumentBase, TimestampFields):
    user_id: PyObjectId
    message_id: PyObjectId
    feedback_type: FeedbackType
    comment: str | None = Field(default=None, max_length=1000)


class EmergencyEventDocument(DocumentBase, TimestampFields):
    user_id: PyObjectId
    source_type: str = Field(min_length=1, max_length=64)
    source_reference_id: PyObjectId | None = None
    matched_rule_ids: list[str] = Field(default_factory=list, max_length=50)
    event_status: EmergencyEventStatus = EmergencyEventStatus.DETECTED
    acknowledged_at: datetime | None = None
    reviewed_by_user_id: PyObjectId | None = None
    reviewed_at: datetime | None = None


class ResourceDocument(SoftDeletableDocument):
    title: str = Field(min_length=1, max_length=300)
    resource_type: str = Field(min_length=1, max_length=64)
    category: str = Field(min_length=1, max_length=100)
    summary: str = Field(default="", max_length=2000)
    source_reference: str | None = Field(default=None, max_length=500)
    publication_date: date | None = None
    active: bool = True


class NotificationDocument(DocumentBase, TimestampFields):
    user_id: PyObjectId
    notification_type: str = Field(min_length=1, max_length=64)
    title: str = Field(min_length=1, max_length=200)
    message: str = Field(min_length=1, max_length=2000)
    read_at: datetime | None = None
    expires_at: datetime | None = None


class AuditLogDocument(DocumentBase):
    """Immutable audit entry — no medical free text or secrets."""

    actor_user_id: PyObjectId | None = None
    action: str = Field(min_length=1, max_length=100)
    entity_type: str = Field(min_length=1, max_length=100)
    entity_id: PyObjectId | None = None
    changes_summary: str = Field(default="", max_length=500)
    request_id: str | None = Field(default=None, max_length=128)
    created_at: datetime = Field(default_factory=utc_now)


class RefreshTokenDocument(DocumentBase, TimestampFields):
    """Refresh-token persistence foundation for Phase 6 — store hashes only."""

    user_id: PyObjectId
    token_hash: str = Field(min_length=32, max_length=128)
    family_id: str = Field(min_length=8, max_length=64)
    issued_at: datetime = Field(default_factory=utc_now)
    expires_at: datetime
    revoked_at: datetime | None = None
    replaced_by_token_id: PyObjectId | None = None
    user_agent_hash: str | None = Field(default=None, max_length=128)


class SchemaMigrationDocument(DocumentBase):
    migration_id: str = Field(min_length=1, max_length=128)
    description: str = Field(default="", max_length=500)
    checksum: str | None = Field(default=None, max_length=128)
    applied_at: datetime = Field(default_factory=utc_now)
