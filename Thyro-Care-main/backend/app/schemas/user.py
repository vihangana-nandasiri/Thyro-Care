"""Public user schemas — never expose password_hash."""

from __future__ import annotations

from datetime import datetime

from pydantic import Field

from app.models.enums import AccountStatus, UserRole
from app.schemas.base import PublicIdSchema, PublicSoftDeleteSchema, PublicTimestampSchema


class UserPublic(PublicIdSchema, PublicTimestampSchema, PublicSoftDeleteSchema):
    email_display: str
    full_name: str
    role: UserRole
    account_status: AccountStatus
    email_verified: bool
    last_login_at: datetime | None = None


class UserInternal(UserPublic):
    """Internal representation still excludes password_hash."""

    email_normalized: str
    failed_login_count: int = Field(default=0, ge=0)
    locked_until: datetime | None = None
