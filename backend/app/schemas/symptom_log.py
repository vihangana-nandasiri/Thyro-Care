"""Public symptom log schemas."""

from __future__ import annotations

from app.models.enums import AssessmentSource, SymptomGuidanceLevel
from app.schemas.base import PublicIdSchema, PublicTimestampSchema


class SymptomLogPublic(PublicIdSchema, PublicTimestampSchema):
    user_id: str
    symptom_codes: list[str] = []
    free_text_summary: str | None = None
    user_selected_severity: int | None = None
    guidance_level: SymptomGuidanceLevel
    emergency_detected: bool = False
    emergency_rule_ids: list[str] = []
    assessment_source: AssessmentSource
