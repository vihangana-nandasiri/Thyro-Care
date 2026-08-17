"""Medical-safety response policy for chat (pre/post generation)."""

from __future__ import annotations

import re

from app.content.assistant_policy import (
    ASSISTANT_DISCLAIMER,
    POLICY_REFUSAL_MESSAGE,
    SAFETY_REDIRECT_MESSAGE,
)
from app.models.enums import ChatResponseMode

_EMERGENCY_HINTS = (
    r"\b(emergency|can't breathe|cannot breathe|chest pain|suicid|overdose|"
    r"unconscious|severe bleeding|call 911|heart attack|stroke)\b",
)

_DOSAGE_HINTS = (
    r"\b(increase|decrease|change|adjust|stop|start|skip)\b.+\b(dose|dosage|medication|levothyroxine|synthroid)\b",
    r"\b(dose|dosage)\b.+\b(increase|decrease|change|adjust)\b",
    r"\bstop\s+(taking\s+)?(my\s+)?(medication|levothyroxine|pills?)\b",
    r"ඖෂධ\s*මාත්‍රාව",
    r"මාත්‍රාව\s*වෙනස්",
)

_LAB_HINTS = (
    r"\b(interpret|what does|mean)\b.+\b(tsh|thyroglobulin|lab|blood\s+test|results?)\b",
    r"\b(tsh|thyroglobulin)\b.+\b(high|low|normal|mean|interpret)\b",
)

_DIAGNOSIS_HINTS = (
    r"\b(do i have|diagnose|is it cancer|recurrence probability|chance of recurrence|"
    r"am i cancer[- ]free|prognosis)\b",
)

_UNSAFE_OUTPUT = (
    r"\byou (are|seem) (medically )?safe\b",
    r"\bnothing to worry about\b",
    r"\b(take|increase|decrease|stop)\s+\d+\s*(mcg|mg|µg)\b",
    r"\bi diagnose\b",
    r"\byour (cancer|disease) (is|has)\b",
)


def _matches(patterns: tuple[str, ...], text: str) -> bool:
    lowered = text.lower()
    return any(re.search(p, lowered, flags=re.IGNORECASE) for p in patterns)


class ChatSafetyPolicyService:
    def pre_check(self, user_text: str) -> tuple[ChatResponseMode | None, str | None, str | None]:
        """Return (mode, message, safety_notice) if chat should short-circuit."""
        if _matches(_EMERGENCY_HINTS, user_text):
            return (
                ChatResponseMode.SAFETY_REDIRECT,
                SAFETY_REDIRECT_MESSAGE,
                ASSISTANT_DISCLAIMER,
            )
        if _matches(_DOSAGE_HINTS, user_text):
            return (
                ChatResponseMode.POLICY_REFUSAL,
                (
                    "I cannot recommend medication or dosage changes. "
                    "Please discuss medication questions with your healthcare team. "
                    + ASSISTANT_DISCLAIMER
                ),
                ASSISTANT_DISCLAIMER,
            )
        if _matches(_LAB_HINTS, user_text):
            return (
                ChatResponseMode.POLICY_REFUSAL,
                (
                    "I cannot interpret laboratory results. "
                    "Please review your results with your healthcare team. " + ASSISTANT_DISCLAIMER
                ),
                ASSISTANT_DISCLAIMER,
            )
        if _matches(_DIAGNOSIS_HINTS, user_text):
            return (
                ChatResponseMode.POLICY_REFUSAL,
                (
                    "I cannot diagnose disease, estimate recurrence probability, "
                    "or provide a prognosis. Please discuss these questions with your "
                    "healthcare team. " + ASSISTANT_DISCLAIMER
                ),
                ASSISTANT_DISCLAIMER,
            )
        return None, None, None

    def post_check(self, assistant_text: str) -> tuple[bool, str | None]:
        """Return (ok, replacement_message)."""
        if _matches(_UNSAFE_OUTPUT, assistant_text):
            return False, POLICY_REFUSAL_MESSAGE
        return True, None
