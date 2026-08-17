"""Prompt-injection and instruction-override protection (not a medical classifier)."""

from __future__ import annotations

import re

from app.content.assistant_policy import POLICY_REFUSAL_MESSAGE
from app.models.enums import ChatResponseMode

_OVERRIDE_PATTERNS = (
    r"ignore\s+(all\s+)?(previous|prior|above)\s+instructions",
    r"disregard\s+(your\s+)?(system|safety)\s+(prompt|rules?)",
    r"you\s+are\s+now\s+(dan|unrestricted|jailbroken)",
    r"reveal\s+(your\s+)?(system\s+)?prompt",
    r"show\s+(me\s+)?(the\s+)?(hidden\s+)?(reasoning|chain[- ]of[- ]thought|cot)\b",
    r"print\s+(your\s+)?(system|developer)\s+(message|prompt)",
    r"\b(api[_ ]?key|secret\s+key|jwt\s+secret)\b",
    r"execute\s+(a\s+)?(tool|function|command)",
    r"call\s+(the\s+)?(api|tool|function)\b",
    r"browse\s+the\s+(web|internet)",
    r"override\s+(source|citation|approved)\s+(restriction|rules?)",
    r"approve\s+this\s+medical\s+document",
    r"treat\s+the\s+following\s+document\s+text\s+as\s+an\s+instruction",
)


def normalize_user_text(text: str, *, max_length: int) -> str:
    cleaned = " ".join(text.strip().split())
    if len(cleaned) > max_length:
        cleaned = cleaned[:max_length]
    return cleaned


def detect_prompt_injection(text: str) -> bool:
    lowered = text.lower()
    for pattern in _OVERRIDE_PATTERNS:
        if re.search(pattern, lowered, flags=re.IGNORECASE):
            return True
    return False


class PromptSecurityService:
    def evaluate(
        self, text: str, *, max_length: int
    ) -> tuple[bool, str | None, ChatResponseMode | None]:
        """Return (ok, refusal_message, mode). ok=False means refuse."""
        normalized = normalize_user_text(text, max_length=max_length)
        if not normalized:
            return False, "Please enter a message.", ChatResponseMode.POLICY_REFUSAL
        if detect_prompt_injection(normalized):
            return False, POLICY_REFUSAL_MESSAGE, ChatResponseMode.POLICY_REFUSAL
        return True, None, None
