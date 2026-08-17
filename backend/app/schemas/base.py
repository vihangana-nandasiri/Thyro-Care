"""Public API-safe base schemas (string ids, no internal-only fields by default)."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.utils.datetime import utc_isoformat


class PublicModel(BaseModel):
    model_config = ConfigDict(from_attributes=True, extra="forbid")


class PublicTimestampSchema(PublicModel):
    created_at: datetime
    updated_at: datetime


class PublicIdSchema(PublicModel):
    id: str = Field(description="Document identifier as a string")


class PublicSoftDeleteSchema(PublicModel):
    is_deleted: bool = False


def serialize_timestamp(value: datetime) -> str:
    return utc_isoformat(value)
