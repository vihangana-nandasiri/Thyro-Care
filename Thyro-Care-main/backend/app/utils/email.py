"""Email normalization helpers."""

from __future__ import annotations


def normalize_email(email: str) -> str:
    """Trim and lowercase the full address (conservative normalization).

    Does not apply provider-specific transforms (e.g. Gmail-dot removal).
    """
    return email.strip().lower()


def split_display_email(email: str) -> tuple[str, str]:
    """Return (normalized, display) preserving original casing for display."""
    display = email.strip()
    return normalize_email(display), display
