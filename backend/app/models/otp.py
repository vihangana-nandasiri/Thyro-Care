"""One-time password challenge persistence."""

from __future__ import annotations

from datetime import UTC, datetime

from pydantic import Field, field_validator

from app.models.base import DocumentBase
from app.utils.datetime import utc_now


class OtpCodeDocument(DocumentBase):
    phone_number: str = Field(min_length=12, max_length=16)
    otp_hash: str = Field(min_length=64, max_length=64)
    created_at: datetime = Field(default_factory=utc_now)
    expires_at: datetime
    attempts: int = Field(default=0, ge=0)
    used_at: datetime | None = None

    @field_validator("created_at", "expires_at", "used_at", mode="after")
    @classmethod
    def normalize_datetime(cls, value: datetime | None) -> datetime | None:
        if value is not None and value.tzinfo is None:
            return value.replace(tzinfo=UTC)
        return value