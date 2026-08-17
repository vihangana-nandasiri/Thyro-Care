"""Patient profile persistence — data-minimized fields only."""

from __future__ import annotations

from datetime import date, datetime

from pydantic import Field

from app.models.base import SoftDeletableDocument
from app.models.enums import AgeRange, PreferredLanguage, RAITreatmentStatus, TreatmentStage
from app.models.object_id import PyObjectId


class PatientProfileDocument(SoftDeletableDocument):
    user_id: PyObjectId
    age_range: AgeRange | None = None
    preferred_language: PreferredLanguage | None = None
    surgery_date: date | None = None
    rai_treatment_status: RAITreatmentStatus | None = None
    treatment_stage: TreatmentStage | None = None
    emergency_contact_name: str | None = Field(default=None, max_length=120)
    emergency_contact_phone: str | None = Field(default=None, max_length=32)
    current_medication_summary: str | None = Field(default=None, max_length=500)
    consent_accepted: bool = False
    consent_accepted_at: datetime | None = None
    disclaimer_accepted: bool = False
    disclaimer_accepted_at: datetime | None = None
    version: int = Field(default=1, ge=1)
