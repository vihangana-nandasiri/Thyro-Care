"""Public schemas for supporting collections."""

from __future__ import annotations

from datetime import date, datetime

from app.models.enums import EmergencyEventStatus, FeedbackType
from app.schemas.base import PublicIdSchema, PublicSoftDeleteSchema, PublicTimestampSchema


class UserFeedbackPublic(PublicIdSchema, PublicTimestampSchema):
    user_id: str
    message_id: str
    feedback_type: FeedbackType
    comment: str | None = None


class EmergencyEventPublic(PublicIdSchema, PublicTimestampSchema):
    user_id: str
    source_type: str
    source_reference_id: str | None = None
    matched_rule_ids: list[str] = []
    event_status: EmergencyEventStatus
    acknowledged_at: datetime | None = None
    reviewed_by_user_id: str | None = None
    reviewed_at: datetime | None = None


class ResourcePublic(PublicIdSchema, PublicTimestampSchema, PublicSoftDeleteSchema):
    title: str
    resource_type: str
    category: str
    summary: str = ""
    source_reference: str | None = None
    publication_date: date | None = None
    active: bool = True


class NotificationPublic(PublicIdSchema, PublicTimestampSchema):
    user_id: str
    notification_type: str
    title: str
    message: str
    read_at: datetime | None = None
    expires_at: datetime | None = None
