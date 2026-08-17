"""Versioned deterministic symptom safety rules (structured answers only).

Content status: REVIEW_REQUIRED for medical-expert sign-off.
Questions align with existing Emergency page warning themes.
No free-text matching. No diagnosis. No treatment advice.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Final

from app.models.enums import SafetyLevel

SAFETY_RULE_VERSION: Final[str] = "safety-rules-v1"

MEDICAL_SAFETY_DISCLAIMER: Final[str] = (
    "This tool supports symptom tracking and safety awareness only. "
    "It does not provide a diagnosis or replace professional medical advice. "
    "If you believe you are experiencing a medical emergency, "
    "contact local emergency services immediately."
)

# REVIEW_REQUIRED: question labels for structured safety check UX / OpenAPI.
SAFETY_QUESTION_KEYS: Final[tuple[str, ...]] = (
    "breathing_emergency",
    "severe_chest_discomfort",
    "loss_of_consciousness",
    "severe_or_rapid_neck_swelling",
    "unable_to_swallow",
    "uncontrolled_bleeding",
    "severe_new_confusion",
    "rapidly_worsening_condition",
    "feels_immediately_unsafe",
)


@dataclass(frozen=True, slots=True)
class SafetyRule:
    rule_code: str
    field: str
    safety_level: SafetyLevel
    # Content status for each message block
    content_status: str = "REVIEW_REQUIRED"


# Highest severity first within level groups; evaluation still takes max level.
EMERGENCY_RULES: Final[tuple[SafetyRule, ...]] = (
    SafetyRule("SR-E-BREATHING", "breathing_emergency", SafetyLevel.EMERGENCY),
    SafetyRule("SR-E-CHEST", "severe_chest_discomfort", SafetyLevel.EMERGENCY),
    SafetyRule("SR-E-LOC", "loss_of_consciousness", SafetyLevel.EMERGENCY),
    SafetyRule("SR-E-NECK", "severe_or_rapid_neck_swelling", SafetyLevel.EMERGENCY),
    SafetyRule("SR-E-SWALLOW", "unable_to_swallow", SafetyLevel.EMERGENCY),
    SafetyRule("SR-E-BLEED", "uncontrolled_bleeding", SafetyLevel.EMERGENCY),
    SafetyRule("SR-E-CONFUSION", "severe_new_confusion", SafetyLevel.EMERGENCY),
    SafetyRule("SR-E-UNSAFE", "feels_immediately_unsafe", SafetyLevel.EMERGENCY),
)

URGENT_RULES: Final[tuple[SafetyRule, ...]] = (
    SafetyRule(
        "SR-U-WORSENING",
        "rapidly_worsening_condition",
        SafetyLevel.URGENT_MEDICAL_REVIEW,
    ),
)

CONTACT_RULES: Final[tuple[SafetyRule, ...]] = ()

ALL_RULES: Final[tuple[SafetyRule, ...]] = EMERGENCY_RULES + URGENT_RULES + CONTACT_RULES

_LEVEL_RANK: Final[dict[SafetyLevel, int]] = {
    SafetyLevel.ROUTINE_TRACKING: 0,
    SafetyLevel.CONTACT_HEALTHCARE_TEAM: 1,
    SafetyLevel.URGENT_MEDICAL_REVIEW: 2,
    SafetyLevel.EMERGENCY: 3,
}


def safety_level_rank(level: SafetyLevel) -> int:
    return _LEVEL_RANK[level]


@dataclass(frozen=True, slots=True)
class SafetyMessaging:
    headline: str
    user_message: str
    recommended_action: str


# REVIEW_REQUIRED: user-facing copy pending medical-expert review.
SAFETY_MESSAGING: Final[dict[SafetyLevel, SafetyMessaging]] = {
    SafetyLevel.EMERGENCY: SafetyMessaging(
        headline="Emergency safety guidance",
        user_message=(
            "Based on your answers, seek immediate emergency help now. "
            "Use the Emergency Support page for guidance. "
            "Do not wait for an application response. "
            "This application cannot contact emergency services for you."
        ),
        recommended_action=(
            "Contact local emergency services immediately and open the Emergency Support page."
        ),
    ),
    SafetyLevel.URGENT_MEDICAL_REVIEW: SafetyMessaging(
        headline="Urgent medical review suggested",
        user_message=(
            "Based on your answers, contact your healthcare team promptly "
            "for medical review. This is not a diagnosis."
        ),
        recommended_action="Contact your healthcare team promptly for further assessment.",
    ),
    SafetyLevel.CONTACT_HEALTHCARE_TEAM: SafetyMessaging(
        headline="Healthcare team follow-up suggested",
        user_message=(
            "Based on your answers, consider contacting your healthcare team "
            "to discuss your symptoms. This is not a diagnosis."
        ),
        recommended_action="Follow up with your healthcare team as appropriate.",
    ),
    SafetyLevel.ROUTINE_TRACKING: SafetyMessaging(
        headline="Continue symptom tracking",
        user_message=(
            "No emergency safety rule was triggered by the answers provided. "
            "Continue tracking your symptoms and follow your healthcare team’s instructions."
        ),
        recommended_action="Continue tracking and follow your care plan.",
    ),
}
