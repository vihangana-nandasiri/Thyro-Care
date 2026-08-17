"""Cryptographic helpers for single-use auth action tokens."""

from __future__ import annotations

import hashlib
import hmac
import secrets

from app.core.config import get_settings


def generate_raw_token(*, nbytes: int = 32) -> str:
    return secrets.token_urlsafe(nbytes)


def hash_action_token(raw_token: str) -> str:
    """HMAC-SHA256 using JWT secret so hashes are app-bound."""
    secret = get_settings().jwt_secret_key.encode("utf-8")
    return hmac.new(secret, raw_token.encode("utf-8"), hashlib.sha256).hexdigest()


def tokens_match(raw_token: str, token_hash: str) -> bool:
    expected = hash_action_token(raw_token)
    return hmac.compare_digest(expected, token_hash)


def fingerprint_request(*, ip: str | None, user_agent: str | None) -> str:
    material = f"{(ip or '').strip()}|{(user_agent or '')[:200]}".encode()
    return hashlib.sha256(material).hexdigest()[:32]
