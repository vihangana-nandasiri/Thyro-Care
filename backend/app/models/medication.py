"""Medication and medication-log persistence documents."""

from __future__ import annotations

from datetime import date, datetime, time

from pydantic import Field, field_validator, model_validator

from app.models.base import DocumentBase, SoftDeletableDocument, TimestampFields
from app.models.enums import MedicationFrequency, MedicationLogStatus, MedicationStatus
from app.models.object_id import PyObjectId
from app.utils.datetime import utc_now


class MedicationDocument(SoftDeletableDocument):
    user_id: PyObjectId
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
    timezone: str = Field(default="UTC", min_length=1, max_length=64)
    version: int = Field(default=1, ge=1)

    @field_validator("reminder_times", mode="before")
    @classmethod
    def _coerce_reminder_times(cls, value: object) -> object:
        if value is None:
            return []
        if not isinstance(value, list):
            return value
        coerced: list[time | str] = []
        for item in value:
            if isinstance(item, str) and len(item) >= 4:
                parts = item.strip().split(":")
                if len(parts) >= 2:
                    coerced.append(time(int(parts[0]), int(parts[1])))
                    continue
            coerced.append(item)  # type: ignore[arg-type]
        return coerced

    @field_validator("reminder_times")
    @classmethod
    def _unique_sorted_reminder_times(cls, value: list[time]) -> list[time]:
        if len(value) != len(set(value)):
            raise ValueError("reminder_times must be unique")
        return sorted(value)

    @model_validator(mode="after")
    def _validate_dates_and_frequency(self) -> MedicationDocument:
        if self.end_date is not None and self.end_date < self.start_date:
            raise ValueError("end_date must be on or after start_date")
        if self.frequency == MedicationFrequency.CUSTOM and not self.reminder_times:
            raise ValueError("CUSTOM frequency requires at least one reminder time")
        if (
            self.frequency
            not in {
                MedicationFrequency.AS_NEEDED,
                MedicationFrequency.WEEKLY,
                MedicationFrequency.CUSTOM,
            }
            and not self.reminder_times
            and self.status == MedicationStatus.ACTIVE
        ):
            # Daily frequencies should carry reminder times for schedule generation
            pass
        return self


class MedicationLogDocument(DocumentBase, TimestampFields):
    """Dose occurrence log; no soft-delete."""

    user_id: PyObjectId
    medication_id: PyObjectId
    scheduled_for: datetime
    recorded_at: datetime = Field(default_factory=utc_now)
    status: MedicationLogStatus
    note: str | None = Field(default=None, max_length=500)
    version: int = Field(default=1, ge=1)
