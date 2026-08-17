"""Patient symptom persistence document (Phase 10)."""

from __future__ import annotations

from datetime import datetime

from pydantic import Field, field_validator, model_validator

from app.models.base import SoftDeletableDocument
from app.models.enums import (
    SafetyLevel,
    SymptomFrequency,
    SymptomSeverity,
    SymptomStatus,
    SymptomType,
)
from app.models.object_id import PyObjectId
from app.utils.timezone import validate_timezone


class SymptomDocument(SoftDeletableDocument):
    user_id: PyObjectId
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
    safety_level: SafetyLevel = SafetyLevel.ROUTINE_TRACKING
    safety_rule_version: str = Field(default="safety-rules-v1", max_length=64)
    safety_checked_at: datetime | None = None
    version: int = Field(default=1, ge=1)

    @field_validator("timezone")
    @classmethod
    def _check_timezone(cls, value: str) -> str:
        return validate_timezone(value)

    @field_validator("custom_symptom_name", "description", "notes", mode="before")
    @classmethod
    def _blank_to_none(cls, value: object) -> object:
        if isinstance(value, str) and value.strip() == "":
            return None
        return value

    @model_validator(mode="after")
    def _validate_symptom_rules(self) -> SymptomDocument:
        if self.symptom_type == SymptomType.OTHER:
            if not self.custom_symptom_name or not self.custom_symptom_name.strip():
                raise ValueError("custom_symptom_name is required when symptom_type is OTHER")
        elif self.custom_symptom_name is not None:
            raise ValueError("custom_symptom_name is only allowed when symptom_type is OTHER")
        if self.ended_at is not None and self.ended_at < self.started_at:
            raise ValueError("ended_at cannot precede started_at")
        return self
