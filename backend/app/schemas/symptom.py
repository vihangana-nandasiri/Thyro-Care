"""Symptom request/response schemas."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.content.symptom_safety_rules import MEDICAL_SAFETY_DISCLAIMER
from app.models.enums import (
    SafetyLevel,
    SymptomFrequency,
    SymptomSeverity,
    SymptomStatus,
    SymptomType,
)
from app.schemas.base import PublicIdSchema
from app.utils.timezone import ensure_utc, validate_timezone


def _empty_to_none(value: Any) -> Any:
    if isinstance(value, str) and value.strip() == "":
        return None
    return value


class SymptomSafetyAnswers(BaseModel):
    model_config = ConfigDict(extra="forbid")

    breathing_emergency: bool
    severe_chest_discomfort: bool
    loss_of_consciousness: bool
    severe_or_rapid_neck_swelling: bool
    unable_to_swallow: bool
    uncontrolled_bleeding: bool
    severe_new_confusion: bool
    rapidly_worsening_condition: bool
    feels_immediately_unsafe: bool

    def as_dict(self) -> dict[str, bool]:
        return self.model_dump()


class SymptomSafetyCheckRequest(SymptomSafetyAnswers):
    """Standalone safety-check body (structured booleans only)."""


class SymptomSafetyCheckResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    safety_level: SafetyLevel
    matched_rule_codes: list[str]
    headline: str
    user_message: str
    recommended_action: str
    emergency_page_required: bool
    rule_version: str
    evaluated_at: datetime
    disclaimer: str = MEDICAL_SAFETY_DISCLAIMER


class SymptomCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    symptom_type: SymptomType
    custom_symptom_name: str | None = Field(default=None, max_length=120)
    severity: SymptomSeverity
    frequency: SymptomFrequency
    started_at: datetime
    ended_at: datetime | None = None
    timezone: str = Field(min_length=1, max_length=64)
    status: SymptomStatus = SymptomStatus.ACTIVE
    description: str | None = Field(default=None, max_length=1000)
    notes: str | None = Field(default=None, max_length=1000)
    safety_answers: SymptomSafetyAnswers

    @field_validator("custom_symptom_name", "description", "notes", mode="before")
    @classmethod
    def blank_optional(cls, value: Any) -> Any:
        return _empty_to_none(value)

    @field_validator("custom_symptom_name", "description", "notes")
    @classmethod
    def strip_optional(cls, value: str | None) -> str | None:
        if value is None:
            return None
        cleaned = value.strip()
        return cleaned or None

    @field_validator("timezone")
    @classmethod
    def check_tz(cls, value: str) -> str:
        return validate_timezone(value)

    @field_validator("started_at", "ended_at")
    @classmethod
    def to_utc(cls, value: datetime | None) -> datetime | None:
        if value is None:
            return None
        return ensure_utc(value)

    @model_validator(mode="after")
    def validate_create(self) -> SymptomCreate:
        if self.symptom_type == SymptomType.OTHER:
            if not self.custom_symptom_name:
                raise ValueError("custom_symptom_name is required when symptom_type is OTHER")
        elif self.custom_symptom_name is not None:
            raise ValueError("custom_symptom_name is only allowed when symptom_type is OTHER")
        if self.ended_at is not None and self.ended_at < self.started_at:
            raise ValueError("ended_at cannot precede started_at")
        if self.status == SymptomStatus.RESOLVED and self.ended_at is None:
            # ended_at may be filled by service
            pass
        return self


class SymptomUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    symptom_type: SymptomType | None = None
    custom_symptom_name: str | None = Field(default=None, max_length=120)
    severity: SymptomSeverity | None = None
    frequency: SymptomFrequency | None = None
    started_at: datetime | None = None
    ended_at: datetime | None = None
    timezone: str | None = Field(default=None, min_length=1, max_length=64)
    status: SymptomStatus | None = None
    description: str | None = Field(default=None, max_length=1000)
    notes: str | None = Field(default=None, max_length=1000)
    safety_answers: SymptomSafetyAnswers | None = None
    expected_version: int = Field(ge=1)

    @field_validator("custom_symptom_name", "description", "notes", mode="before")
    @classmethod
    def blank_optional(cls, value: Any) -> Any:
        return _empty_to_none(value)

    @field_validator("custom_symptom_name", "description", "notes")
    @classmethod
    def strip_optional(cls, value: str | None) -> str | None:
        if value is None:
            return None
        cleaned = value.strip()
        return cleaned or None

    @field_validator("timezone")
    @classmethod
    def check_tz(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return validate_timezone(value)

    @field_validator("started_at", "ended_at")
    @classmethod
    def to_utc(cls, value: datetime | None) -> datetime | None:
        if value is None:
            return None
        return ensure_utc(value)


class SymptomStatusUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: SymptomStatus
    ended_at: datetime | None = None
    expected_version: int = Field(ge=1)

    @field_validator("ended_at")
    @classmethod
    def to_utc(cls, value: datetime | None) -> datetime | None:
        if value is None:
            return None
        return ensure_utc(value)


class SymptomPublic(PublicIdSchema):
    model_config = ConfigDict(extra="forbid")

    symptom_type: SymptomType
    custom_symptom_name: str | None = None
    severity: SymptomSeverity
    frequency: SymptomFrequency
    started_at: datetime
    ended_at: datetime | None = None
    timezone: str
    status: SymptomStatus
    description: str | None = None
    notes: str | None = None
    safety_level: SafetyLevel
    safety_rule_version: str
    safety_checked_at: datetime | None = None
    created_at: datetime
    updated_at: datetime
    version: int


class SymptomCreateResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    symptom: SymptomPublic
    safety_assessment: SymptomSafetyCheckResponse


class SymptomListResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    items: list[SymptomPublic]
    page: int
    page_size: int
    total: int


class MessageResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    message: str
