"""Medication request/response schemas."""

from __future__ import annotations

from datetime import date, datetime, time
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.models.enums import MedicationFrequency, MedicationLogStatus, MedicationStatus
from app.schemas.base import PublicIdSchema
from app.utils.timezone import validate_timezone

_HHMM = __import__("re").compile(r"^([01]\d|2[0-3]):([0-5]\d)$")


def _empty_to_none(value: Any) -> Any:
    if isinstance(value, str) and value.strip() == "":
        return None
    return value


def _parse_reminder_times(value: Any) -> list[time]:
    if value is None:
        return []
    if not isinstance(value, list):
        raise ValueError("reminder_times must be a list")
    parsed: list[time] = []
    for item in value:
        if isinstance(item, time):
            parsed.append(time(item.hour, item.minute))
            continue
        if isinstance(item, str):
            match = _HHMM.match(item.strip())
            if not match:
                raise ValueError("reminder_times must use HH:mm format")
            parsed.append(time(int(match.group(1)), int(match.group(2))))
            continue
        raise ValueError("Invalid reminder time")
    unique = sorted(set(parsed))
    if len(unique) != len(parsed):
        # Normalize duplicates by uniquing + sorting
        parsed = unique
    else:
        parsed = unique
    return parsed


class MedicationCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1, max_length=200)
    dosage_text: str = Field(min_length=1, max_length=200)
    frequency: MedicationFrequency
    reminder_times: list[time] = Field(default_factory=list, max_length=12)
    instructions: str | None = Field(default=None, max_length=1000)
    start_date: date
    end_date: date | None = None
    status: MedicationStatus = MedicationStatus.ACTIVE
    prescribed_by_text: str | None = Field(default=None, max_length=200)
    notes: str | None = Field(default=None, max_length=1000)
    timezone: str = Field(min_length=1, max_length=64)

    @field_validator("name", "dosage_text")
    @classmethod
    def strip_required(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("This field is required")
        return cleaned

    @field_validator("instructions", "prescribed_by_text", "notes", mode="before")
    @classmethod
    def blank_optional(cls, value: Any) -> Any:
        return _empty_to_none(value)

    @field_validator("instructions", "prescribed_by_text", "notes")
    @classmethod
    def strip_optional(cls, value: str | None) -> str | None:
        if value is None:
            return None
        cleaned = value.strip()
        return cleaned or None

    @field_validator("reminder_times", mode="before")
    @classmethod
    def parse_times(cls, value: Any) -> list[time]:
        return _parse_reminder_times(value)

    @field_validator("timezone")
    @classmethod
    def check_tz(cls, value: str) -> str:
        return validate_timezone(value)

    @model_validator(mode="after")
    def validate_dates_and_custom(self) -> MedicationCreate:
        if self.end_date is not None and self.end_date < self.start_date:
            raise ValueError("end_date cannot precede start_date")
        if self.frequency == MedicationFrequency.CUSTOM and not self.reminder_times:
            raise ValueError("CUSTOM frequency requires reminder_times")
        return self


class MedicationUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str | None = Field(default=None, min_length=1, max_length=200)
    dosage_text: str | None = Field(default=None, min_length=1, max_length=200)
    frequency: MedicationFrequency | None = None
    reminder_times: list[time] | None = Field(default=None, max_length=12)
    instructions: str | None = Field(default=None, max_length=1000)
    start_date: date | None = None
    end_date: date | None = None
    status: MedicationStatus | None = None
    prescribed_by_text: str | None = Field(default=None, max_length=200)
    notes: str | None = Field(default=None, max_length=1000)
    timezone: str | None = Field(default=None, min_length=1, max_length=64)
    expected_version: int = Field(ge=1)

    @field_validator("name", "dosage_text")
    @classmethod
    def strip_optional_required(cls, value: str | None) -> str | None:
        if value is None:
            return None
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("This field cannot be blank")
        return cleaned

    @field_validator("instructions", "prescribed_by_text", "notes", mode="before")
    @classmethod
    def blank_optional(cls, value: Any) -> Any:
        return _empty_to_none(value)

    @field_validator("reminder_times", mode="before")
    @classmethod
    def parse_times(cls, value: Any) -> list[time] | None:
        if value is None:
            return None
        return _parse_reminder_times(value)

    @field_validator("timezone")
    @classmethod
    def check_tz(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return validate_timezone(value)

    def editable_payload(self) -> dict[str, Any]:
        return self.model_dump(exclude_unset=True, exclude={"expected_version"})


class MedicationLogCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    scheduled_for: datetime
    status: MedicationLogStatus
    note: str | None = Field(default=None, max_length=500)

    @field_validator("note", mode="before")
    @classmethod
    def blank_note(cls, value: Any) -> Any:
        return _empty_to_none(value)


class MedicationPublic(PublicIdSchema):
    name: str
    dosage_text: str
    frequency: MedicationFrequency
    reminder_times: list[str] = []
    instructions: str | None = None
    start_date: date
    end_date: date | None = None
    status: MedicationStatus
    prescribed_by_text: str | None = None
    notes: str | None = None
    timezone: str
    created_at: datetime
    updated_at: datetime
    version: int


class MedicationLogPublic(PublicIdSchema):
    medication_id: str
    scheduled_for: datetime
    recorded_at: datetime
    status: MedicationLogStatus
    note: str | None = None
    created_at: datetime


class MedicationListResponse(BaseModel):
    items: list[MedicationPublic]
    total: int
    page: int
    page_size: int


class MedicationScheduleItem(BaseModel):
    medication_id: str
    medication_name: str
    dosage_text: str
    scheduled_for: datetime
    scheduled_local_time: str
    timezone: str
    log_status: MedicationLogStatus | None = None
    log_id: str | None = None


class MedicationAdherence(BaseModel):
    adherence_percentage: float | None
    total_eligible: int
    taken_count: int
    missed_count: int
    skipped_count: int
    unlogged_count: int
    date_from: date
    date_to: date


class MessageResponse(BaseModel):
    success: bool = True
    message: str
