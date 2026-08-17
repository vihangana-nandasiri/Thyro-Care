"""Multilingual boundary messages (require medical-expert review for production)."""

from __future__ import annotations

from typing import Final

# Marked for MEDICAL_EXPERT review before treating as production acceptance evidence.
REQUIRES_MEDICAL_EXPERT_REVIEW: Final[bool] = True

SINHALA_MESSAGES: Final[dict[str, str]] = {
    "insufficient_evidence": (
        "මට එම ප්‍රශ්නයට විශ්වාසනීයව පිළිතුරු දීමට ප්‍රමාණවත් අනුමත තොරතුරු නොමැත. කරුණාකර ඔබේ සෞඛ්‍ය කණ්ඩායම සමඟ සාකච්ඡා කරන්න."
    ),
    "provider_unavailable": (
        "අධ්‍යාපන සහායකයා තාවකාලිකව ලබා ගත නොහැක. අනුමත සම්පත් සහ රෝග ලක්ෂණ ආරක්ෂණ පරීක්ෂාව තවමත් ලබා ගත හැක."
    ),
    "policy_refusal": ("මට එම ඉල්ලීමට උදව් කළ නොහැක. මම අනුමත මූලාශ්‍රවලින් සාමාන්‍ය අධ්‍යාපන තොරතුරු බෙදා ගත හැක."),
    "diagnosis": (
        "මම රෝග විනිශ්චයක් හෝ පුනරාවර්තනය තහවුරු කිරීමක් ලබා නොදෙමි. කරුණාකර ඔබේ වෛද්‍ය කණ්ඩායම සමඟ සාකච්ඡා කරන්න."
    ),
    "dosage": ("මම ඖෂධ මාත්‍රාව වෙනස් කිරීම් හෝ ඖෂධ නිර්දේශ ලබා නොදෙමි. ඖෂධ පිළිබඳව ඔබේ වෛද්‍ය කණ්ඩායම අමතන්න."),
    "lab": ("මම රසායනාගාර ප්‍රතිඵල අර්ථකථනය නොකරමි. ප්‍රතිඵල ගැන ඔබේ සෞඛ්‍ය කණ්ඩායමෙන් විමසන්න."),
    "emergency": (
        "මම කතාබස් පෙළෙන් හදිසි අවස්ථා බරපතලකම තීරණය නොකරමි. "
        "හදිසි අවස්ථාවක් යැයි සිතන්නේ නම් දේශීය හදිසි සේවා අමතන්න. "
        "ව්‍යුහගත රෝග ලක්ෂණ පරීක්ෂාව සහ හදිසි සහාය පිටුව භාවිතා කරන්න."
    ),
}


def detect_dominant_language(text: str) -> str:
    """Heuristic language detection for UI message selection (not medical evidence)."""
    sinhala = sum(1 for ch in text if "\u0d80" <= ch <= "\u0dff")
    latin = sum(1 for ch in text if ("a" <= ch.lower() <= "z"))
    if sinhala > latin and sinhala >= 3:
        return "si"
    return "en"


def localized_message(key: str, *, language: str, english_fallback: str) -> str:
    if language == "si":
        return SINHALA_MESSAGES.get(key, english_fallback)
    return english_fallback
