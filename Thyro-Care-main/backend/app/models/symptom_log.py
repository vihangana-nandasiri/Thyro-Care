"""Symptom log persistence — no diagnosis fields."""

from __future__ import annotations

from pydantic import Field

from app.models.base import DocumentBase, TimestampFields
from app.models.enums import AssessmentSource, SymptomGuidanceLevel
from app.models.object_id import PyObjectId

FREE_TEXT_MAX_LENGTH = 1000


class SymptomLogDocument(DocumentBase, TimestampFields):
    """Append-oriented symptom assessment log; no soft-delete."""

    user_id: PyObjectId
    symptom_codes: list[str] = Field(default_factory=list, max_length=50)
    free_text_summary: str | None = Field(default=None, max_length=FREE_TEXT_MAX_LENGTH)
    user_selected_severity: int | None = Field(default=None, ge=1, le=10)
    guidance_level: SymptomGuidanceLevel
    emergency_detected: bool = False
    emergency_rule_ids: list[str] = Field(default_factory=list, max_length=50)
    assessment_source: AssessmentSource = AssessmentSource.USER_FORM
