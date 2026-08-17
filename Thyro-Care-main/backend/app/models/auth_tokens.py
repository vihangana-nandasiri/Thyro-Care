"""Authentication action tokens and external identity documents."""

from __future__ import annotations

from datetime import datetime

from pydantic import Field

from app.models.base import DocumentBase, TimestampFields
from app.models.enums import AuthActionPurpose, AuthIdentityProvider
from app.models.object_id import PyObjectId
from app.utils.datetime import utc_now


class AuthActionTokenDocument(DocumentBase, TimestampFields):
    """Single-use hashed tokens for email verification and password reset."""

    user_id: PyObjectId
    purpose: AuthActionPurpose
    token_hash: str = Field(min_length=32, max_length=128)
    expires_at: datetime
    consumed_at: datetime | None = None
    request_fingerprint: str | None = Field(default=None, max_length=128)
    version: int = Field(default=1, ge=1)


class AuthIdentityDocument(DocumentBase, TimestampFields):
    """External identity link (Google). Does not store ID tokens."""

    user_id: PyObjectId
    provider: AuthIdentityProvider
    provider_subject: str = Field(min_length=1, max_length=255)
    provider_email_at_link: str = Field(min_length=3, max_length=320)
    email_verified: bool = False
    last_login_at: datetime | None = None
    version: int = Field(default=1, ge=1)

    def touch_login(self) -> None:
        self.last_login_at = utc_now()
        self.updated_at = utc_now()
