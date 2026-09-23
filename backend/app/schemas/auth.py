"""Authentication request/response schemas."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator, model_validator

from app.models.enums import AccountStatus, UserRole
from app.schemas.base import PublicIdSchema
from app.utils.phone import normalize_sri_lankan_phone


class RegisterRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    full_name: str = Field(min_length=2, max_length=200)
    email: EmailStr
    phone_number: str | None = Field(default=None, max_length=16)
    password: str = Field(min_length=1, max_length=128)
    confirm_password: str = Field(min_length=1, max_length=128)
    consent_accepted: bool
    disclaimer_accepted: bool

    @field_validator("full_name")
    @classmethod
    def strip_name(cls, value: str) -> str:
        cleaned = value.strip()
        if len(cleaned) < 2:
            raise ValueError("Enter your full name")
        return cleaned

    @field_validator("phone_number")
    @classmethod
    def validate_phone(cls, value: str | None) -> str | None:
        return normalize_sri_lankan_phone(value) if value is not None else None

    @model_validator(mode="after")
    def passwords_and_consent(self) -> RegisterRequest:
        if self.password != self.confirm_password:
            raise ValueError("Passwords do not match")
        if not self.consent_accepted:
            raise ValueError("Consent must be accepted")
        if not self.disclaimer_accepted:
            raise ValueError("Medical disclaimer must be accepted")
        return self


class LoginRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class OtpRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    phone_number: str = Field(min_length=12, max_length=16)

    @field_validator("phone_number")
    @classmethod
    def validate_phone(cls, value: str) -> str:
        return normalize_sri_lankan_phone(value)


class OtpVerifyRequest(OtpRequest):
    otp: str = Field(pattern=r"^\d{6}$")


class OtpRequestResponse(BaseModel):
    success: bool = True
    message: str
    demo_otp: str | None = None
    retry_after_seconds: int | None = None


class ForgotPasswordRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    email: EmailStr


class ResetPasswordRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    token: str = Field(min_length=20, max_length=512)
    new_password: str = Field(min_length=1, max_length=128)
    confirm_password: str = Field(min_length=1, max_length=128)

    @model_validator(mode="after")
    def passwords_match(self) -> ResetPasswordRequest:
        if self.new_password != self.confirm_password:
            raise ValueError("Passwords do not match")
        from app.core.passwords import validate_password_policy

        validate_password_policy(self.new_password)
        return self


class VerifyEmailRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    token: str = Field(min_length=20, max_length=512)


class ResendVerificationRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    email: EmailStr | None = None


class ChangePasswordRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    current_password: str = Field(min_length=1, max_length=128)
    new_password: str = Field(min_length=1, max_length=128)
    confirm_password: str = Field(min_length=1, max_length=128)

    @model_validator(mode="after")
    def passwords_match(self) -> ChangePasswordRequest:
        if self.new_password != self.confirm_password:
            raise ValueError("Passwords do not match")
        from app.core.passwords import validate_password_policy

        validate_password_policy(self.new_password)
        return self


class GoogleAuthRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    credential: str = Field(min_length=20, max_length=8192)


class AuthUserPublic(PublicIdSchema):
    full_name: str
    email: str
    role: UserRole
    account_status: AccountStatus
    email_verified: bool
    created_at: datetime


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: AuthUserPublic


class MessageResponse(BaseModel):
    success: bool = True
    message: str
