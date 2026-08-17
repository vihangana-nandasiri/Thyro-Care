"""Opaque refresh-token generation and hashing."""

from __future__ import annotations

import hashlib
import hmac
import secrets
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from app.core.config import Settings, get_settings


@dataclass(frozen=True, slots=True)
class IssuedRefreshToken:
    raw_token: str
    token_hash: str
    family_id: str
    issued_at: datetime
    expires_at: datetime
    max_age_seconds: int


def hash_refresh_token(raw_token: str) -> str:
    return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()


def tokens_equal(left_hash: str, right_hash: str) -> bool:
    return hmac.compare_digest(left_hash, right_hash)


def issue_refresh_token(
    *,
    family_id: str | None = None,
    settings: Settings | None = None,
) -> IssuedRefreshToken:
    cfg = settings or get_settings()
    raw = secrets.token_urlsafe(48)
    now = datetime.now(UTC)
    expires = now + timedelta(days=cfg.refresh_token_expire_days)
    return IssuedRefreshToken(
        raw_token=raw,
        token_hash=hash_refresh_token(raw),
        family_id=family_id or str(uuid.uuid4()),
        issued_at=now,
        expires_at=expires,
        max_age_seconds=cfg.refresh_token_expire_days * 24 * 60 * 60,
    )


def hash_user_agent(user_agent: str | None) -> str | None:
    if not user_agent:
        return None
    return hashlib.sha256(user_agent.encode("utf-8")).hexdigest()
