"""Deterministic symptom safety assessment (structured answers only)."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime

from app.content.symptom_safety_rules import (
    ALL_RULES,
    MEDICAL_SAFETY_DISCLAIMER,
    SAFETY_MESSAGING,
    SAFETY_QUESTION_KEYS,
    SAFETY_RULE_VERSION,
    safety_level_rank,
)
from app.core.exceptions import ValidationException
from app.models.enums import SafetyLevel
from app.utils.datetime import utc_now


@dataclass(frozen=True, slots=True)
class SafetyAssessmentResult:
    safety_level: SafetyLevel
    matched_rule_codes: tuple[str, ...]
    headline: str
    user_message: str
    recommended_action: str
    emergency_page_required: bool
    rule_version: str
    evaluated_at: datetime
    disclaimer: str


def _require_bool(answers: dict[str, object], key: str) -> bool:
    if key not in answers:
        raise ValidationException(f"Missing safety answer: {key}")
    value = answers[key]
    if not isinstance(value, bool):
        raise ValidationException(f"Safety answer '{key}' must be true or false")
    return value


def evaluate_safety_answers(
    answers: dict[str, object],
    *,
    now: datetime | None = None,
) -> SafetyAssessmentResult:
    """Evaluate versioned rules. Never inspects free-text."""
    normalized: dict[str, bool] = {}
    for key in SAFETY_QUESTION_KEYS:
        normalized[key] = _require_bool(answers, key)

    matched: list[str] = []
    selected = SafetyLevel.ROUTINE_TRACKING
    for rule in ALL_RULES:
        if normalized.get(rule.field) is True:
            matched.append(rule.rule_code)
            if safety_level_rank(rule.safety_level) > safety_level_rank(selected):
                selected = rule.safety_level

    # Deterministic ordering of matched codes for audits/tests
    matched_sorted = tuple(sorted(matched))
    messaging = SAFETY_MESSAGING[selected]
    evaluated_at = now or utc_now()
    return SafetyAssessmentResult(
        safety_level=selected,
        matched_rule_codes=matched_sorted,
        headline=messaging.headline,
        user_message=messaging.user_message,
        recommended_action=messaging.recommended_action,
        emergency_page_required=selected == SafetyLevel.EMERGENCY,
        rule_version=SAFETY_RULE_VERSION,
        evaluated_at=evaluated_at,
        disclaimer=MEDICAL_SAFETY_DISCLAIMER,
    )


class SymptomSafetyService:
    """Thin service wrapper for dependency injection."""

    def assess(self, answers: dict[str, object]) -> SafetyAssessmentResult:
        return evaluate_safety_answers(answers)
