"""Public patient profile schemas."""

from __future__ import annotations

from datetime import date, datetime, timedelta
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.enums import AgeRange, PreferredLanguage, RAITreatmentStatus, TreatmentStage
from app.schemas.base import PublicIdSchema
from app.utils.datetime import utc_now
from app.utils.phone import normalize_optional_phone


def _empty_to_none(value: Any) -> Any:
    if isinstance(value, str) and value.strip() == "":
        return None
    return value


class PatientProfileUpdate(BaseModel):
    """Editable patient self-profile fields only."""

    model_config = ConfigDict(extra="forbid")

    age_range: AgeRange | None = None
    preferred_language: PreferredLanguage | None = None
    surgery_date: date | None = None
    rai_treatment_status: RAITreatmentStatus | None = None
    treatment_stage: TreatmentStage | None = None
    emergency_contact_name: str | None = Field(default=None, max_length=120)
    emergency_contact_phone: str | None = Field(default=None, max_length=32)
    current_medication_summary: str | None = Field(default=None, max_length=500)
    expected_version: int = Field(ge=1)

    @field_validator(
        "emergency_contact_name",
        "emergency_contact_phone",
        "current_medication_summary",
        mode="before",
    )
    @classmethod
    def blank_strings_to_none(cls, value: Any) -> Any:
        return _empty_to_none(value)

    @field_validator("emergency_contact_name")
    @classmethod
    def strip_name(cls, value: str | None) -> str | None:
        if value is None:
            return None
        cleaned = value.strip()
        return cleaned or None

    @field_validator("emergency_contact_phone")
    @classmethod
    def normalize_phone(cls, value: str | None) -> str | None:
        return normalize_optional_phone(value)

    @field_validator("current_medication_summary")
    @classmethod
    def strip_summary(cls, value: str | None) -> str | None:
        if value is None:
            return None
        cleaned = value.strip()
        return cleaned or None

    @field_validator("surgery_date")
    @classmethod
    def validate_surgery_date(cls, value: date | None) -> date | None:
        if value is None:
            return None
        # Allow today and past; reject unreasonably far future (more than 1 year ahead).
        max_future = utc_now().date() + timedelta(days=365)
        if value > max_future:
            raise ValueError("Surgery date cannot be more than one year in the future")
        # Reject extremely old dates that are likely data errors.
        if value.year < 1950:
            raise ValueError("Surgery date is out of the supported range")
        return value

    def editable_payload(self) -> dict[str, Any]:
        """Return only fields that were explicitly provided (excluding expected_version)."""
        data = self.model_dump(exclude_unset=True, exclude={"expected_version"})
        return data


class PatientAccountPublic(PublicIdSchema):
    full_name: str
    email: str
    role: str
    account_status: str
    email_verified: bool
    created_at: datetime


class PatientProfilePublic(PublicIdSchema):
    age_range: AgeRange | None = None
    preferred_language: PreferredLanguage | None = None
    surgery_date: date | None = None
    rai_treatment_status: RAITreatmentStatus | None = None
    treatment_stage: TreatmentStage | None = None
    emergency_contact_name: str | None = None
    emergency_contact_phone: str | None = None
    current_medication_summary: str | None = None
    consent_accepted: bool = False
    consent_accepted_at: datetime | None = None
    disclaimer_accepted: bool = False
    disclaimer_accepted_at: datetime | None = None
    profile_completion_percentage: int = Field(ge=0, le=100)
    created_at: datetime
    updated_at: datetime
    version: int


class PatientProfileWithAccount(BaseModel):
    model_config = ConfigDict(extra="forbid")

    profile: PatientProfilePublic
    account: PatientAccountPublic
