"""Password hashing tests."""

from __future__ import annotations

import pytest
from app.core.exceptions import ValidationException
from app.core.passwords import (
    hash_password,
    validate_password_policy,
    verify_and_update_password,
    verify_password,
)


def test_hash_not_plaintext() -> None:
    hashed = hash_password("correct-horse-battery")
    assert hashed != "correct-horse-battery"
    assert hashed.startswith("$argon2")


def test_correct_password_verifies() -> None:
    hashed = hash_password("correct-horse-battery")
    assert verify_password("correct-horse-battery", hashed) is True


def test_wrong_password_fails() -> None:
    hashed = hash_password("correct-horse-battery")
    assert verify_password("wrong-password-xx", hashed) is False


def test_password_max_length_enforced() -> None:
    with pytest.raises(ValidationException):
        validate_password_policy("x" * 200)


def test_whitespace_only_rejected() -> None:
    with pytest.raises(ValidationException):
        validate_password_policy("   ")


def test_rehash_detection_returns_tuple() -> None:
    hashed = hash_password("correct-horse-battery")
    ok, updated = verify_and_update_password("correct-horse-battery", hashed)
    assert ok is True
    # recommended hasher may not require update for fresh hashes
    assert updated is None or isinstance(updated, str)
