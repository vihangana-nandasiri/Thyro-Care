"""Appointment request/response schemas."""

from __future__ import annotations

from datetime import date, datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.models.enums import AppointmentLocationType, AppointmentStatus, AppointmentType
from app.schemas.base import PublicIdSchema
from app.utils.timezone import ensure_utc, validate_timezone

MAX_REMINDER_OFFSET = 43200  # 30 days in minutes
MAX_REMINDER_COUNT = 10


def _empty_to_none(value: Any) -> Any:
    if isinstance(value, str) and value.strip() == "":
        return None
    return value


def _normalize_offsets(value: Any) -> list[int]:
    if value is None:
        return []
    if not isinstance(value, list):
        raise ValueError("reminder_offsets_minutes must be a list")
    offsets: list[int] = []
    for item in value:
        if isinstance(item, bool) or not isinstance(item, int):
            raise ValueError("reminder offsets must be integers")
        if item < 0:
            raise ValueError("reminder offsets must be non-negative")
        if item > MAX_REMINDER_OFFSET:
            raise ValueError("reminder offset exceeds maximum")
        offsets.append(item)
    unique = sorted(set(offsets))
    if len(unique) > MAX_REMINDER_COUNT:
        raise ValueError("too many reminder offsets")
    return unique


class AppointmentCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    appointment_type: AppointmentType
    title: str = Field(min_length=1, max_length=200)
    scheduled_start: datetime
    scheduled_end: datetime | None = None
    timezone: str = Field(min_length=1, max_length=64)
    location: str | None = Field(default=None, max_length=300)
    location_type: AppointmentLocationType | None = None
    provider_name: str | None = Field(default=None, max_length=200)
    notes: str | None = Field(default=None, max_length=1000)
    status: AppointmentStatus = AppointmentStatus.UPCOMING
    reminder_offsets_minutes: list[int] = Field(default_factory=list, max_length=MAX_REMINDER_COUNT)

    @field_validator("title")
    @classmethod
    def strip_title(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Title is required")
        return cleaned

    @field_validator("location", "provider_name", "notes", mode="before")
    @classmethod
    def blank_optional(cls, value: Any) -> Any:
        return _empty_to_none(value)

    @field_validator("location", "provider_name", "notes")
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

    @field_validator("reminder_offsets_minutes", mode="before")
    @classmethod
    def parse_offsets(cls, value: Any) -> list[int]:
        return _normalize_offsets(value)

    @field_validator("scheduled_start", "scheduled_end")
    @classmethod
    def to_utc(cls, value: datetime | None) -> datetime | None:
        if value is None:
            return None
        return ensure_utc(value)

    @model_validator(mode="after")
    def validate_window(self) -> AppointmentCreate:
        if self.scheduled_end is not None and self.scheduled_end <= self.scheduled_start:
            raise ValueError("scheduled_end must be after scheduled_start")
        if self.status not in {
            AppointmentStatus.UPCOMING,
            AppointmentStatus.COMPLETED,
            AppointmentStatus.MISSED,
            AppointmentStatus.CANCELLED,
        }:
            raise ValueError("Invalid status")
        return self


class AppointmentUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    appointment_type: AppointmentType | None = None
    title: str | None = Field(default=None, min_length=1, max_length=200)
    scheduled_start: datetime | None = None
    scheduled_end: datetime | None = None
    timezone: str | None = Field(default=None, min_length=1, max_length=64)
    location: str | None = Field(default=None, max_length=300)
    location_type: AppointmentLocationType | None = None
    provider_name: str | None = Field(default=None, max_length=200)
    notes: str | None = Field(default=None, max_length=1000)
    status: AppointmentStatus | None = None
    reminder_offsets_minutes: list[int] | None = Field(default=None, max_length=MAX_REMINDER_COUNT)
    expected_version: int = Field(ge=1)

    @field_validator("title")
    @classmethod
    def strip_title(cls, value: str | None) -> str | None:
        if value is None:
            return None
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Title is required")
        return cleaned

    @field_validator("location", "provider_name", "notes", mode="before")
    @classmethod
    def blank_optional(cls, value: Any) -> Any:
        return _empty_to_none(value)

    @field_validator("timezone")
    @classmethod
    def check_tz(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return validate_timezone(value)

    @field_validator("reminder_offsets_minutes", mode="before")
    @classmethod
    def parse_offsets(cls, value: Any) -> list[int] | None:
        if value is None:
            return None
        return _normalize_offsets(value)

    @field_validator("scheduled_start", "scheduled_end")
    @classmethod
    def to_utc(cls, value: datetime | None) -> datetime | None:
        if value is None:
            return None
        return ensure_utc(value)

    def editable_payload(self) -> dict[str, Any]:
        data = self.model_dump(exclude_unset=True, exclude={"expected_version"})
        return data


class AppointmentStatusUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: AppointmentStatus
    expected_version: int = Field(ge=1)


class AppointmentPublic(PublicIdSchema):
    appointment_type: AppointmentType
    title: str
    scheduled_start: datetime
    scheduled_end: datetime | None = None
    timezone: str
    location: str | None = None
    location_type: AppointmentLocationType | None = None
    provider_name: str | None = None
    notes: str | None = None
    status: AppointmentStatus
    completed_at: datetime | None = None
    cancelled_at: datetime | None = None
    reminder_offsets_minutes: list[int] = []
    created_at: datetime
    updated_at: datetime
    version: int


class AppointmentListResponse(BaseModel):
    items: list[AppointmentPublic]
    page: int
    page_size: int
    total: int


class AppointmentCalendarItem(BaseModel):
    appointment_id: str
    appointment_type: AppointmentType
    title: str
    scheduled_start: datetime
    scheduled_end: datetime | None = None
    local_date: date
    local_start_time: str
    local_end_time: str | None = None
    timezone: str
    status: AppointmentStatus
    location: str | None = None
    provider_name: str | None = None


class MessageResponse(BaseModel):
    message: str
