"""Chat session and message persistence (Phase 11)."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from app.models.base import SoftDeletableDocument
from app.models.enums import ChatMessageRole, ChatResponseMode, ChatSessionStatus
from app.models.object_id import PyObjectId
from app.utils.datetime import utc_now

CHAT_CONTENT_MAX_LENGTH = 4000


class ChatCitation(BaseModel):
    model_config = ConfigDict(extra="forbid")

    citation_id: str = Field(min_length=1, max_length=160)
    document_id: str = Field(min_length=1, max_length=120)
    title: str = Field(min_length=1, max_length=300)
    source_name: str = Field(min_length=1, max_length=200)
    source_url: str | None = Field(default=None, max_length=500)
    document_version: str = Field(default="1", max_length=64)
    excerpt: str = Field(default="", max_length=500)


class ChatSourceReference(BaseModel):
    """Legacy citation shape retained for compatibility."""

    model_config = ConfigDict(extra="forbid", arbitrary_types_allowed=True)

    label: str = Field(min_length=1, max_length=200)
    source_organization: str | None = Field(default=None, max_length=200)
    document_id: PyObjectId | None = None
    chunk_id: PyObjectId | None = None


class ChatSessionDocument(SoftDeletableDocument):
    user_id: PyObjectId
    title: str = Field(default="Conversation", min_length=1, max_length=200)
    status: ChatSessionStatus = ChatSessionStatus.ACTIVE
    started_at: datetime = Field(default_factory=utc_now)
    last_message_at: datetime | None = None
    message_count: int = Field(default=0, ge=0)
    archived_at: datetime | None = None
    version: int = Field(default=1, ge=1)


class ChatMessageDocument(SoftDeletableDocument):
    session_id: PyObjectId
    user_id: PyObjectId
    role: ChatMessageRole
    content: str = Field(min_length=1, max_length=CHAT_CONTENT_MAX_LENGTH)
    response_mode: ChatResponseMode | None = None
    source_citations: list[dict[str, Any]] = Field(default_factory=list, max_length=20)
    safety_notice: str | None = Field(default=None, max_length=1000)
    model_provider: str | None = Field(default=None, max_length=64)
    model_name: str | None = Field(default=None, max_length=128)
    prompt_version: str | None = Field(default=None, max_length=64)
    retrieval_version: str | None = Field(default=None, max_length=64)
    # Legacy fields
    category: str | None = Field(default=None, max_length=64)
    confidence_band: str | None = Field(default=None, max_length=32)
    source_references: list[ChatSourceReference] = Field(default_factory=list, max_length=20)
    emergency_detected: bool = False
    fallback_used: bool = False
