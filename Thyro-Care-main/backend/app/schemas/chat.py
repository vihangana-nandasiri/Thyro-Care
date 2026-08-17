"""Chat and knowledge API schemas."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.content.assistant_policy import ASSISTANT_DISCLAIMER
from app.models.chat import CHAT_CONTENT_MAX_LENGTH
from app.models.enums import (
    ChatMessageRole,
    ChatResponseMode,
    ChatSessionStatus,
    FeedbackRating,
    FeedbackReasonCode,
)


class ChatSessionCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str | None = Field(default=None, max_length=200)


class ChatSessionUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str = Field(min_length=1, max_length=200)


class ChatSessionPublic(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    title: str
    status: ChatSessionStatus
    created_at: datetime
    updated_at: datetime
    last_message_at: datetime | None = None
    version: int


class ChatCitationPublic(BaseModel):
    model_config = ConfigDict(extra="forbid")

    citation_id: str
    document_id: str
    title: str
    source_name: str
    source_url: str | None = None
    document_version: str
    excerpt: str = ""


class ChatMessageCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    content: str = Field(min_length=1, max_length=CHAT_CONTENT_MAX_LENGTH)


class ChatMessagePublic(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    role: ChatMessageRole
    content: str
    response_mode: ChatResponseMode | None = None
    citations: list[ChatCitationPublic] = Field(default_factory=list)
    safety_notice: str | None = None
    created_at: datetime


class ChatSessionDetail(BaseModel):
    model_config = ConfigDict(extra="forbid")

    session: ChatSessionPublic
    messages: list[ChatMessagePublic]


class ChatSessionListResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    items: list[ChatSessionPublic]
    page: int
    page_size: int
    total: int


class ChatAssistantResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    user_message: ChatMessagePublic
    assistant_message: ChatMessagePublic
    response_mode: ChatResponseMode
    citations: list[ChatCitationPublic] = Field(default_factory=list)
    safety_notice: str | None = None
    safety_check_url: str | None = "/symptoms"
    emergency_page_url: str | None = "/emergency"
    disclaimer: str = ASSISTANT_DISCLAIMER
    evidence_coverage: str | None = None
    follow_up_suggestions: list[str] = Field(default_factory=list)
    retrieval_mode: str | None = None


class ChatFeedbackRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    rating: FeedbackRating
    reason_code: FeedbackReasonCode | None = None
    comment: str | None = Field(default=None, max_length=500)


class ChatFeedbackPublic(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    assistant_message_id: str
    rating: FeedbackRating
    reason_code: FeedbackReasonCode | None = None
    comment: str | None = None
    created_at: datetime
    updated_at: datetime


class ChatExportResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    exported_at: datetime
    sessions: list[ChatSessionDetail]


class MessageResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    message: str


class KnowledgeSourcePublic(BaseModel):
    model_config = ConfigDict(extra="forbid")

    document_id: str
    title: str
    source_name: str
    source_url: str | None = None
    topic: str
    language: str
    version: str
    medical_disclaimer: str
