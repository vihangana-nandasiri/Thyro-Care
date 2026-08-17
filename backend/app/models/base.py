"""Shared MongoDB document model conventions."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.object_id import PyObjectId, new_object_id
from app.utils.datetime import utc_now


class DocumentBase(BaseModel):
    """Base persistence document with Mongo `_id` alias."""

    model_config = ConfigDict(
        populate_by_name=True,
        arbitrary_types_allowed=True,
        extra="forbid",
    )

    id: PyObjectId = Field(default_factory=new_object_id, alias="_id")
    schema_version: int = Field(default=1, ge=1)


class TimestampFields(BaseModel):
    model_config = ConfigDict(extra="forbid", arbitrary_types_allowed=True)

    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)


class SoftDeleteFields(BaseModel):
    model_config = ConfigDict(extra="forbid", arbitrary_types_allowed=True)

    is_deleted: bool = False
    deleted_at: datetime | None = None
    deleted_by: PyObjectId | None = None


class AuditActorFields(BaseModel):
    model_config = ConfigDict(extra="forbid", arbitrary_types_allowed=True)

    created_by: PyObjectId | None = None
    updated_by: PyObjectId | None = None


class SoftDeletableDocument(DocumentBase, TimestampFields, SoftDeleteFields):
    """Documents that support soft delete + timestamps."""


class AuditedDocument(SoftDeletableDocument, AuditActorFields):
    """Soft-deletable documents with optional actor tracking."""
