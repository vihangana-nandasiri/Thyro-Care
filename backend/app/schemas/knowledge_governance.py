"""Knowledge governance request/response schemas (Phase 12).

Clients never supply actor identity, statuses, or approval timestamps — those are
always derived server-side from the authenticated user and workflow transitions.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any
from urllib.parse import urlparse

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.enums import (
    KnowledgeLanguage,
    KnowledgeReviewDecision,
    KnowledgeStatus,
    KnowledgeTopic,
)
from app.models.knowledge import KNOWLEDGE_BODY_MAX, REVIEW_COMMENTS_MAX

_TITLE_MAX = 300
_SOURCE_NAME_MAX = 200
_URL_MAX = 500
_DISCLAIMER_MAX = 1000
_SLUG_MAX = 200
_REASON_MAX = 1000


def _empty_to_none(value: Any) -> Any:
    if isinstance(value, str) and value.strip() == "":
        return None
    return value


def _validate_url(value: str | None) -> str | None:
    if value is None:
        return None
    cleaned = value.strip()
    if not cleaned:
        return None
    parsed = urlparse(cleaned)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise ValueError("source_url must be an http or https URL")
    return cleaned


def _strip_required(value: str) -> str:
    cleaned = value.strip()
    if not cleaned:
        raise ValueError("This field is required")
    return cleaned


class KnowledgeDraftCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    slug: str = Field(min_length=1, max_length=_SLUG_MAX)
    title: str = Field(min_length=1, max_length=_TITLE_MAX)
    source_name: str = Field(min_length=1, max_length=_SOURCE_NAME_MAX)
    source_url: str | None = Field(default=None, max_length=_URL_MAX)
    topic: KnowledgeTopic
    language: KnowledgeLanguage = KnowledgeLanguage.ENGLISH
    body: str = Field(min_length=1, max_length=KNOWLEDGE_BODY_MAX)
    medical_disclaimer: str = Field(default="", max_length=_DISCLAIMER_MAX)

    @field_validator("slug", "title", "source_name", "body")
    @classmethod
    def _strip(cls, value: str) -> str:
        return _strip_required(value)

    @field_validator("source_url", mode="before")
    @classmethod
    def _blank_url(cls, value: Any) -> Any:
        return _empty_to_none(value)

    @field_validator("source_url")
    @classmethod
    def _check_url(cls, value: str | None) -> str | None:
        return _validate_url(value)


class KnowledgeDraftUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str | None = Field(default=None, min_length=1, max_length=_TITLE_MAX)
    source_name: str | None = Field(default=None, min_length=1, max_length=_SOURCE_NAME_MAX)
    source_url: str | None = Field(default=None, max_length=_URL_MAX)
    topic: KnowledgeTopic | None = None
    language: KnowledgeLanguage | None = None
    body: str | None = Field(default=None, min_length=1, max_length=KNOWLEDGE_BODY_MAX)
    medical_disclaimer: str | None = Field(default=None, max_length=_DISCLAIMER_MAX)
    expected_version: int = Field(ge=1)

    @field_validator("title", "source_name", "body")
    @classmethod
    def _strip_optional(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return _strip_required(value)

    @field_validator("source_url", mode="before")
    @classmethod
    def _blank_url(cls, value: Any) -> Any:
        return _empty_to_none(value)

    @field_validator("source_url")
    @classmethod
    def _check_url(cls, value: str | None) -> str | None:
        return _validate_url(value)

    def editable_payload(self) -> dict[str, Any]:
        return self.model_dump(exclude_unset=True, exclude={"expected_version"})


class KnowledgeSubmitRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    expected_version: int = Field(ge=1)
    submission_note: str | None = Field(default=None, max_length=REVIEW_COMMENTS_MAX)


class KnowledgeReviewDecisionRequest(BaseModel):
    """Unified medical-expert decision payload (approve / request changes / reject)."""

    model_config = ConfigDict(extra="forbid")

    decision: KnowledgeReviewDecision
    expected_version: int = Field(ge=1)
    expected_content_hash: str = Field(min_length=1, max_length=128)
    comments: str | None = Field(default=None, max_length=REVIEW_COMMENTS_MAX)

    @field_validator("comments", mode="before")
    @classmethod
    def _blank_comments(cls, value: Any) -> Any:
        return _empty_to_none(value)


class KnowledgeApproveRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    expected_version: int = Field(ge=1)
    expected_content_hash: str = Field(min_length=1, max_length=128)
    review_summary: str | None = Field(default=None, max_length=REVIEW_COMMENTS_MAX)


class KnowledgeRequestChangesRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    expected_version: int = Field(ge=1)
    expected_content_hash: str = Field(min_length=1, max_length=128)
    comments: str = Field(min_length=1, max_length=REVIEW_COMMENTS_MAX)


class KnowledgeRejectRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    expected_version: int = Field(ge=1)
    expected_content_hash: str = Field(min_length=1, max_length=128)
    comments: str = Field(min_length=1, max_length=REVIEW_COMMENTS_MAX)


class KnowledgeNewVersionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    expected_version: int = Field(ge=1)
    title: str | None = Field(default=None, min_length=1, max_length=_TITLE_MAX)
    source_name: str | None = Field(default=None, min_length=1, max_length=_SOURCE_NAME_MAX)
    source_url: str | None = Field(default=None, max_length=_URL_MAX)
    topic: KnowledgeTopic | None = None
    language: KnowledgeLanguage | None = None
    body: str | None = Field(default=None, min_length=1, max_length=KNOWLEDGE_BODY_MAX)
    medical_disclaimer: str | None = Field(default=None, max_length=_DISCLAIMER_MAX)

    @field_validator("source_url", mode="before")
    @classmethod
    def _blank_url(cls, value: Any) -> Any:
        return _empty_to_none(value)

    @field_validator("source_url")
    @classmethod
    def _check_url(cls, value: str | None) -> str | None:
        return _validate_url(value)

    def overrides(self) -> dict[str, Any]:
        return self.model_dump(exclude_unset=True, exclude={"expected_version"})


class KnowledgeRetireRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    expected_version: int = Field(ge=1)
    reason: str = Field(min_length=1, max_length=_REASON_MAX)


class KnowledgeRestoreRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    expected_version: int = Field(ge=1)
    expected_content_hash: str = Field(min_length=1, max_length=128)


class KnowledgeRetryIngestRequest(BaseModel):
    """Retry publication for an already-approved version without re-approving."""

    model_config = ConfigDict(extra="forbid")

    expected_content_hash: str = Field(min_length=1, max_length=128)


# ---- Responses --------------------------------------------------------------------


class KnowledgeVersionPublic(BaseModel):
    model_config = ConfigDict(extra="forbid")

    version_id: str
    version_number: int
    title: str
    source_name: str
    source_url: str | None = None
    topic: str
    language: str
    body: str
    medical_disclaimer: str
    content_hash: str
    review_status: KnowledgeStatus
    created_by_user_id: str | None = None
    created_at: datetime
    submitted_for_review_at: datetime | None = None
    submitted_by_user_id: str | None = None
    approved_at: datetime | None = None
    approved_by_user_id: str | None = None
    rejected_at: datetime | None = None
    rejected_by_user_id: str | None = None
    retired_at: datetime | None = None
    retired_by_user_id: str | None = None
    review_summary: str | None = None
    supersedes_version_id: str | None = None
    version: int


class KnowledgeDocumentPublic(BaseModel):
    model_config = ConfigDict(extra="forbid")

    document_id: str
    slug: str
    title: str = ""
    current_version_id: str | None = None
    current_version_number: int | None = None
    current_status: KnowledgeStatus
    topic: str
    language: str
    created_by_user_id: str | None = None
    version: int
    created_at: datetime
    updated_at: datetime


class KnowledgeDocumentDetail(BaseModel):
    model_config = ConfigDict(extra="forbid")

    document: KnowledgeDocumentPublic
    current_version: KnowledgeVersionPublic | None = None
    versions: list[KnowledgeVersionPublic] = Field(default_factory=list)


class KnowledgeDocumentListResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    items: list[KnowledgeDocumentPublic]
    total: int
    page: int
    page_size: int


class KnowledgeReviewQueueItem(BaseModel):
    model_config = ConfigDict(extra="forbid")

    document_id: str
    version_id: str
    version_number: int
    title: str
    topic: str
    language: str
    content_hash: str
    submitted_for_review_at: datetime | None = None
    submitted_by_user_id: str | None = None


class KnowledgeReviewQueueResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    items: list[KnowledgeReviewQueueItem]
    total: int
    page: int
    page_size: int


class KnowledgeReviewRecordPublic(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    document_id: str
    version_id: str
    reviewer_user_id: str
    reviewer_role: str
    decision: KnowledgeReviewDecision
    reviewed_content_hash: str
    comments: str | None = None
    created_at: datetime


class KnowledgeApprovalResult(BaseModel):
    model_config = ConfigDict(extra="forbid")

    document: KnowledgeDocumentPublic
    version: KnowledgeVersionPublic
    ingestion_status: str
    ingestion_message: str | None = None


class KnowledgeDiffLine(BaseModel):
    model_config = ConfigDict(extra="forbid")

    op: str
    from_line: str | None = None
    to_line: str | None = None


class KnowledgeCompareResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    document_id: str
    from_version_id: str | None = None
    to_version_id: str
    lines: list[KnowledgeDiffLine] = Field(default_factory=list)
    truncated: bool = False


class MessageResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    message: str
