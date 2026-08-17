"""Deterministic profile-completion percentage (non-clinical)."""

from __future__ import annotations

from app.models.patient_profile import PatientProfileDocument

_COMPLETION_FIELDS: tuple[str, ...] = (
    "age_range",
    "preferred_language",
    "surgery_date",
    "rai_treatment_status",
    "treatment_stage",
    "emergency_contact_name",
    "emergency_contact_phone",
    "current_medication_summary",
)


def calculate_profile_completion(profile: PatientProfileDocument) -> int:
    """Return an integer 0–100 from optional support fields only.

    Consent and disclaimer are intentionally excluded. The score has no medical meaning.
    """
    total = len(_COMPLETION_FIELDS)
    filled = 0
    for name in _COMPLETION_FIELDS:
        value = getattr(profile, name, None)
        if value is None:
            continue
        if isinstance(value, str) and not value.strip():
            continue
        filled += 1
    return int(round((filled / total) * 100)) if total else 0
