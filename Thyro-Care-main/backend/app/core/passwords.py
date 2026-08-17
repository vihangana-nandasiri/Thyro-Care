"""Password hashing and policy (pwdlib + Argon2)."""

from __future__ import annotations

from pwdlib import PasswordHash

from app.core.config import get_settings
from app.core.exceptions import ValidationException

_password_hash = PasswordHash.recommended()


def validate_password_policy(password: str) -> None:
    settings = get_settings()
    if password != password.strip() and not password.strip():
        raise ValidationException("Password cannot be empty")
    if not password or password.strip() == "":
        raise ValidationException("Password cannot be empty")
    if len(password) < settings.password_min_length:
        raise ValidationException(
            f"Password must be at least {settings.password_min_length} characters",
        )
    if len(password) > settings.password_max_length:
        raise ValidationException(
            f"Password must be at most {settings.password_max_length} characters",
        )


def hash_password(password: str) -> str:
    validate_password_policy(password)
    return _password_hash.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    if not password or not password_hash:
        return False
    if len(password) > get_settings().password_max_length:
        return False
    try:
        return _password_hash.verify(password, password_hash)
    except Exception:  # noqa: BLE001 — treat malformed hashes as failed verification
        return False


def verify_and_update_password(password: str, password_hash: str) -> tuple[bool, str | None]:
    """Return (ok, new_hash_or_none_if_no_update)."""
    if len(password) > get_settings().password_max_length:
        return False, None
    try:
        ok, updated = _password_hash.verify_and_update(password, password_hash)
    except Exception:  # noqa: BLE001
        return False, None
    return bool(ok), updated
