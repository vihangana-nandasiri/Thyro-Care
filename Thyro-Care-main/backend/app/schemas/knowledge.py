"""Public knowledge schemas."""

from __future__ import annotations

from datetime import date, datetime

from app.models.enums import KnowledgeStatus
from app.schemas.base import PublicIdSchema, PublicSoftDeleteSchema, PublicTimestampSchema


class KnowledgeDocumentPublic(PublicIdSchema, PublicTimestampSchema, PublicSoftDeleteSchema):
    title: str
    category: str
    content: str
    source_organization: str | None = None
    source_reference: str | None = None
    publication_date: date | None = None
    guideline_date: date | None = None
    status: KnowledgeStatus
    version: int
    reviewed_by_user_id: str | None = None
    reviewed_at: datetime | None = None
    review_comment: str | None = None
    active: bool = False
    created_by_user_id: str | None = None
    updated_by_user_id: str | None = None


class KnowledgeChunkPublic(PublicIdSchema, PublicTimestampSchema, PublicSoftDeleteSchema):
    document_id: str
    chunk_index: int
    content: str
    metadata: dict[str, str | None] = {}
    embedding_provider: str | None = None
    embedding_model: str | None = None
    embedding_dimension: int | None = None
    embedding_reference: str | None = None
    active: bool = False
