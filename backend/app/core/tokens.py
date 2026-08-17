"""JWT access-token create/validate (PyJWT)."""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Any

import jwt
from bson import ObjectId

from app.core.config import Settings, get_settings
from app.core.exceptions import UnauthorizedException
from app.models.enums import UserRole
from app.models.object_id import object_id_to_string, to_object_id

ALLOWED_ALGORITHMS = ("HS256",)


@dataclass(frozen=True, slots=True)
class AccessTokenClaims:
    subject: str
    role: UserRole
    jti: str
    issuer: str
    audience: str
    issued_at: datetime
    not_before: datetime
    expires_at: datetime

    @property
    def user_id(self) -> ObjectId:
        return to_object_id(self.subject)


def create_access_token(
    *,
    user_id: ObjectId | str,
    role: UserRole | str,
    settings: Settings | None = None,
) -> tuple[str, int]:
    """Return (token, expires_in_seconds)."""
    cfg = settings or get_settings()
    now = datetime.now(UTC)
    expires = now + timedelta(minutes=cfg.access_token_expire_minutes)
    payload: dict[str, Any] = {
        "sub": object_id_to_string(user_id),
        "type": "access",
        "role": str(role),
        "jti": str(uuid.uuid4()),
        "iss": cfg.jwt_issuer,
        "aud": cfg.jwt_audience,
        "iat": int(now.timestamp()),
        "nbf": int(now.timestamp()),
        "exp": int(expires.timestamp()),
    }
    token = jwt.encode(payload, cfg.jwt_secret_key, algorithm=cfg.jwt_algorithm)
    return token, cfg.access_token_expire_seconds


def decode_access_token(token: str, *, settings: Settings | None = None) -> AccessTokenClaims:
    cfg = settings or get_settings()
    try:
        payload = jwt.decode(
            token,
            cfg.jwt_secret_key,
            algorithms=list(ALLOWED_ALGORITHMS),
            audience=cfg.jwt_audience,
            issuer=cfg.jwt_issuer,
            leeway=cfg.jwt_clock_skew_seconds,
            options={
                "require": ["sub", "type", "role", "jti", "iss", "aud", "iat", "nbf", "exp"],
            },
        )
    except jwt.PyJWTError as exc:
        raise UnauthorizedException("Invalid or expired access token") from exc

    if payload.get("type") != "access":
        raise UnauthorizedException("Invalid or expired access token")
    subject = payload.get("sub")
    if not isinstance(subject, str):
        raise UnauthorizedException("Invalid or expired access token")
    try:
        to_object_id(subject)
    except Exception as exc:
        raise UnauthorizedException("Invalid or expired access token") from exc

    role_raw = payload.get("role")
    try:
        role = UserRole(str(role_raw))
    except ValueError as exc:
        raise UnauthorizedException("Invalid or expired access token") from exc

    return AccessTokenClaims(
        subject=subject,
        role=role,
        jti=str(payload["jti"]),
        issuer=str(payload["iss"]),
        audience=str(payload["aud"]),
        issued_at=datetime.fromtimestamp(int(payload["iat"]), tz=UTC),
        not_before=datetime.fromtimestamp(int(payload["nbf"]), tz=UTC),
        expires_at=datetime.fromtimestamp(int(payload["exp"]), tz=UTC),
    )
