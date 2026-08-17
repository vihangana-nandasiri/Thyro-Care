"""Profile completion unit tests."""

from __future__ import annotations

from datetime import date

from app.models.enums import AgeRange, PreferredLanguage, RAITreatmentStatus, TreatmentStage
from app.models.object_id import new_object_id
from app.models.patient_profile import PatientProfileDocument
from app.services.profile_completion_service import calculate_profile_completion
from app.utils.datetime import utc_now


def test_empty_profile_completion_zero() -> None:
    profile = PatientProfileDocument(user_id=new_object_id())
    assert calculate_profile_completion(profile) == 0


def test_consent_does_not_affect_completion() -> None:
    now = utc_now()
    profile = PatientProfileDocument(
        user_id=new_object_id(),
        consent_accepted=True,
        consent_accepted_at=now,
        disclaimer_accepted=True,
        disclaimer_accepted_at=now,
    )
    assert calculate_profile_completion(profile) == 0


def test_partial_completion() -> None:
    profile = PatientProfileDocument(
        user_id=new_object_id(),
        age_range=AgeRange.AGE_30_39,
        preferred_language=PreferredLanguage.ENGLISH,
        surgery_date=date(2024, 1, 1),
        rai_treatment_status=RAITreatmentStatus.COMPLETED,
    )
    assert calculate_profile_completion(profile) == 50


def test_full_completion_equals_100() -> None:
    profile = PatientProfileDocument(
        user_id=new_object_id(),
        age_range=AgeRange.AGE_30_39,
        preferred_language=PreferredLanguage.ENGLISH,
        surgery_date=date(2024, 1, 1),
        rai_treatment_status=RAITreatmentStatus.COMPLETED,
        treatment_stage=TreatmentStage.FOLLOW_UP,
        emergency_contact_name="Alex Example",
        emergency_contact_phone="+15551234567",
        current_medication_summary="Levothyroxine as prescribed",
    )
    assert calculate_profile_completion(profile) == 100
