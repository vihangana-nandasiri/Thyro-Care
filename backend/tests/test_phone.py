"""Phone normalization unit tests."""

from __future__ import annotations

import pytest
from app.utils.phone import normalize_optional_phone


def test_normalize_optional_phone_none_and_blank() -> None:
    assert normalize_optional_phone(None) is None
    assert normalize_optional_phone("   ") is None


def test_normalize_strips_and_keeps_plus() -> None:
    assert normalize_optional_phone(" +1 (555) 234-5678 ") == "+15552345678"
    assert normalize_optional_phone("077-123-4567") == "0771234567"


def test_normalize_rejects_letters() -> None:
    with pytest.raises(ValueError):
        normalize_optional_phone("555-ABCD-1234")


def test_normalize_rejects_too_short() -> None:
    with pytest.raises(ValueError):
        normalize_optional_phone("12345")
