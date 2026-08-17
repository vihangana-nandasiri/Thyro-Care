"""Optional emergency-contact phone normalization (no country-code guessing)."""

from __future__ import annotations

_MIN_DIGITS = 7
_MAX_DIGITS = 15


def normalize_optional_phone(value: str | None) -> str | None:
    """Normalize an optional phone string.

    - Trims surrounding whitespace.
    - Preserves a single leading ``+``.
    - Removes spaces, hyphens, and parentheses.
    - Rejects letters and other symbols.
    - Enforces a reasonable digit-count range.
    - Does not invent a country code (e.g. does not add +94).
    """
    if value is None:
        return None
    raw = value.strip()
    if not raw:
        return None

    has_plus = raw.startswith("+")
    body = raw[1:] if has_plus else raw
    cleaned_chars: list[str] = []
    for ch in body:
        if ch.isdigit():
            cleaned_chars.append(ch)
        elif ch in {" ", "-", "(", ")"}:
            continue
        else:
            raise ValueError(
                "Phone number may only contain digits, spaces, hyphens, "
                "parentheses, and an optional leading +"
            )

    digits = "".join(cleaned_chars)
    if len(digits) < _MIN_DIGITS or len(digits) > _MAX_DIGITS:
        raise ValueError(
            f"Phone number must contain between {_MIN_DIGITS} and {_MAX_DIGITS} digits"
        )

    return f"+{digits}" if has_plus else digits
