"""User persistence document (password hashing implemented in auth services)."""

from __future__ import annotations

from datetime import datetime

from pydantic import Field, field_validator

from app.models.base import SoftDeletableDocument
from app.models.enums import AccountStatus, UserRole
from app.utils.email import normalize_email
from app.utils.phone import normalize_sri_lankan_phone

__all__ = ["UserDocument", "normalize_email"]


class UserDocument(SoftDeletableDocument):
    email_normalized: str = Field(min_length=3, max_length=320)
    email_display: str = Field(min_length=3, max_length=320)
    phone_number: str | None = Field(default=None, max_length=16)
    password_hash: str = Field(min_length=1, max_length=512)
    full_name: str = Field(min_length=1, max_length=200)
    role: UserRole = UserRole.PATIENT
    account_status: AccountStatus = AccountStatus.PENDING
    email_verified: bool = False
    password_auth_enabled: bool = True
    last_login_at: datetime | None = None
    failed_login_count: int = Field(default=0, ge=0)
    locked_until: datetime | None = None

    @field_validator("email_normalized")
    @classmethod
    def _normalize(cls, value: str) -> str:
        return normalize_email(value)

    @field_validator("phone_number")
    @classmethod
    def _normalize_phone(cls, value: str | None) -> str | None:
        return normalize_sri_lankan_phone(value) if value is not None else None
