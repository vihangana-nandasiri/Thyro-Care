"""Appointment persistence document."""

from __future__ import annotations

from datetime import datetime

from pydantic import Field, field_validator, model_validator

from app.models.base import SoftDeletableDocument
from app.models.enums import AppointmentLocationType, AppointmentStatus, AppointmentType
from app.models.object_id import PyObjectId


class AppointmentDocument(SoftDeletableDocument):
    user_id: PyObjectId
    appointment_type: AppointmentType
    title: str = Field(min_length=1, max_length=200)
    scheduled_start: datetime
    scheduled_end: datetime | None = None
    timezone: str = Field(default="UTC", min_length=1, max_length=64)
    location: str | None = Field(default=None, max_length=300)
    location_type: AppointmentLocationType | None = None
    provider_name: str | None = Field(default=None, max_length=200)
    notes: str | None = Field(default=None, max_length=1000)
    status: AppointmentStatus = AppointmentStatus.UPCOMING
    completed_at: datetime | None = None
    cancelled_at: datetime | None = None
    reminder_offsets_minutes: list[int] = Field(default_factory=list, max_length=10)
    version: int = Field(default=1, ge=1)

    @field_validator("reminder_offsets_minutes", mode="before")
    @classmethod
    def _normalize_offsets(cls, value: object) -> list[int]:
        if value is None:
            return []
        if not isinstance(value, list):
            raise ValueError("reminder_offsets_minutes must be a list")
        offsets = sorted({int(v) for v in value})
        for offset in offsets:
            if offset < 0:
                raise ValueError("reminder_offsets_minutes must be non-negative")
            if offset > 43200:
                raise ValueError("reminder_offsets_minutes exceeds maximum")
        return offsets

    @model_validator(mode="after")
    def _validate_window(self) -> AppointmentDocument:
        if self.scheduled_end is not None and self.scheduled_end <= self.scheduled_start:
            raise ValueError("scheduled_end must be after scheduled_start")
        return self
