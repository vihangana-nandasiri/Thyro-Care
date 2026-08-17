"""Knowledge document, version, review, and chunk persistence (Phase 11 + Phase 12)."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.base import DocumentBase, SoftDeletableDocument
from app.models.enums import KnowledgeReviewDecision, KnowledgeStatus
from app.models.object_id import PyObjectId
from app.utils.datetime import utc_now

KNOWLEDGE_BODY_MAX = 200_000
CHUNK_TEXT_MAX = 4_000
REVIEW_COMMENTS_MAX = 2_000


class KnowledgeDocumentDocument(SoftDeletableDocument):
    """Parent governance record. Denormalized fields serve patient retrieval and are
    only ever updated when a version is APPROVED (or retired/restored)."""

    document_id: str = Field(min_length=1, max_length=120)
    slug: str = Field(min_length=1, max_length=200)
    current_version_id: str | None = Field(default=None, max_length=120)
    current_status: KnowledgeStatus = KnowledgeStatus.DRAFT
    topic: str = Field(min_length=1, max_length=100)
    language: str = Field(default="english", min_length=1, max_length=32)
    created_by_user_id: PyObjectId | None = None
    version: int = Field(default=1, ge=1)

    # Denormalized for patient API compat — valid only when current_status == APPROVED.
    title: str = Field(default="", max_length=300)
    source_name: str = Field(default="", max_length=200)
    source_url: str | None = Field(default=None, max_length=500)
    body: str = Field(default="", max_length=KNOWLEDGE_BODY_MAX)
    medical_disclaimer: str = Field(default="", max_length=1000)
    content_hash: str = Field(default="", max_length=128)
    review_status: KnowledgeStatus = KnowledgeStatus.DRAFT
    status: KnowledgeStatus = KnowledgeStatus.DRAFT
    active: bool = False
    content_version: str = Field(default="1", min_length=1, max_length=64)

    # Legacy Phase 5 compatibility fields
    category: str = Field(default="general", max_length=100)
    content: str = Field(default="", max_length=KNOWLEDGE_BODY_MAX)
    source_organization: str | None = Field(default=None, max_length=200)
    source_reference: str | None = Field(default=None, max_length=500)
    reviewed_at: datetime | None = None
    reviewed_by_role: str | None = Field(default=None, max_length=64)
    reviewed_by_user_id: PyObjectId | None = None
    review_comment: str | None = Field(default=None, max_length=1000)
    updated_by_user_id: PyObjectId | None = None


class KnowledgeDocumentVersionDocument(SoftDeletableDocument):
    """A single content revision. Approved version bodies are immutable."""

    document_id: str = Field(min_length=1, max_length=120)
    version_id: str = Field(min_length=1, max_length=120)
    version_number: int = Field(ge=1)
    title: str = Field(min_length=1, max_length=300)
    source_name: str = Field(min_length=1, max_length=200)
    source_url: str | None = Field(default=None, max_length=500)
    topic: str = Field(min_length=1, max_length=100)
    language: str = Field(default="english", min_length=1, max_length=32)
    body: str = Field(default="", max_length=KNOWLEDGE_BODY_MAX)
    medical_disclaimer: str = Field(default="", max_length=1000)
    content_hash: str = Field(default="", max_length=128)
    review_status: KnowledgeStatus = KnowledgeStatus.DRAFT
    created_by_user_id: PyObjectId | None = None
    submitted_for_review_at: datetime | None = None
    submitted_by_user_id: PyObjectId | None = None
    approved_at: datetime | None = None
    approved_by_user_id: PyObjectId | None = None
    rejected_at: datetime | None = None
    rejected_by_user_id: PyObjectId | None = None
    retired_at: datetime | None = None
    retired_by_user_id: PyObjectId | None = None
    review_summary: str | None = Field(default=None, max_length=REVIEW_COMMENTS_MAX)
    supersedes_version_id: str | None = Field(default=None, max_length=120)
    version: int = Field(default=1, ge=1)


class KnowledgeReviewRecordDocument(DocumentBase):
    """Append-only review decision record — never updated or deleted."""

    document_id: str = Field(min_length=1, max_length=120)
    version_id: str = Field(min_length=1, max_length=120)
    reviewer_user_id: PyObjectId
    reviewer_role: str = Field(min_length=1, max_length=64)
    decision: KnowledgeReviewDecision
    reviewed_content_hash: str = Field(min_length=1, max_length=128)
    comments: str | None = Field(default=None, max_length=REVIEW_COMMENTS_MAX)
    request_id: str | None = Field(default=None, max_length=128)
    created_at: datetime = Field(default_factory=utc_now)


class KnowledgeChunkMetadata(BaseModel):
    model_config = ConfigDict(extra="forbid")

    category: str | None = Field(default=None, max_length=100)
    language: str | None = Field(default=None, max_length=32)


class KnowledgeChunkDocument(SoftDeletableDocument):
    document_id: str = Field(min_length=1, max_length=120)
    mongo_document_id: PyObjectId | None = None
    version_id: str | None = Field(default=None, max_length=120)
    chunk_id: str = Field(min_length=1, max_length=160)
    chunk_index: int = Field(ge=0)
    text: str = Field(min_length=1, max_length=CHUNK_TEXT_MAX)
    topic: str = Field(default="general", max_length=100)
    language: str = Field(default="english", max_length=32)
    source_title: str = Field(default="", max_length=300)
    source_name: str = Field(default="", max_length=200)
    source_url: str | None = Field(default=None, max_length=500)
    document_version: str = Field(default="1", max_length=64)
    review_status: KnowledgeStatus = KnowledgeStatus.DRAFT
    content_hash: str = Field(default="", max_length=128)
    # Legacy
    content: str = Field(default="", max_length=20_000)
    metadata: KnowledgeChunkMetadata = Field(default_factory=KnowledgeChunkMetadata)
    embedding_provider: str | None = Field(default=None, max_length=64)
    embedding_model: str | None = Field(default=None, max_length=128)
    embedding_dimension: int | None = Field(default=None, ge=1)
    embedding_reference: str | None = Field(default=None, max_length=500)
    active: bool = False
