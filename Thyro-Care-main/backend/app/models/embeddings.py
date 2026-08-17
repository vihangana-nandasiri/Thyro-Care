"""Knowledge chunk embedding persistence (Phase 13B)."""

from __future__ import annotations

from datetime import datetime

from pydantic import Field

from app.models.base import SoftDeletableDocument
from app.models.enums import KnowledgeStatus
from app.models.object_id import PyObjectId
from app.utils.datetime import utc_now


class KnowledgeChunkEmbeddingDocument(SoftDeletableDocument):
    chunk_id: str = Field(min_length=1, max_length=160)
    document_id: str = Field(min_length=1, max_length=120)
    document_version: str = Field(min_length=1, max_length=64)
    content_hash: str = Field(min_length=8, max_length=128)
    embedding: list[float] = Field(default_factory=list, max_length=4096)
    embedding_model: str = Field(min_length=1, max_length=128)
    embedding_dimensions: int = Field(ge=1, le=4096)
    language: str = Field(default="en", max_length=16)
    topic: str = Field(default="general", max_length=100)
    review_status: KnowledgeStatus = KnowledgeStatus.APPROVED
    active: bool = True
    embedded_at: datetime = Field(default_factory=utc_now)
    mongo_chunk_id: PyObjectId | None = None
    version: int = Field(default=1, ge=1)
