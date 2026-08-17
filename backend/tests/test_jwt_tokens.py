"""JWT access-token tests."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

import jwt
import pytest
from app.core.config import Settings
from app.core.exceptions import UnauthorizedException
from app.core.tokens import create_access_token, decode_access_token
from app.models.enums import UserRole
from bson import ObjectId


def _settings(**kwargs: object) -> Settings:
    base = {
        "APP_ENVIRONMENT": "test",
        "JWT_SECRET_KEY": "unit-test-secret-key-32-characters!!",
        "JWT_ISSUER": "thyrocare-ai-api",
        "JWT_AUDIENCE": "thyrocare-ai-web",
        "ACCESS_TOKEN_EXPIRE_MINUTES": 15,
    }
    base.update(kwargs)
    return Settings(**base)  # type: ignore[arg-type]


def test_valid_access_token() -> None:
    settings = _settings()
    user_id = ObjectId()
    token, expires_in = create_access_token(
        user_id=user_id, role=UserRole.PATIENT, settings=settings
    )
    assert expires_in == 15 * 60
    claims = decode_access_token(token, settings=settings)
    assert claims.subject == str(user_id)
    assert claims.role == UserRole.PATIENT


def test_expired_token_fails() -> None:
    settings = _settings(ACCESS_TOKEN_EXPIRE_MINUTES=0)
    # Force expired payload
    now = datetime.now(UTC) - timedelta(minutes=5)
    payload = {
        "sub": str(ObjectId()),
        "type": "access",
        "role": "patient",
        "jti": "x",
        "iss": settings.jwt_issuer,
        "aud": settings.jwt_audience,
        "iat": int(now.timestamp()),
        "nbf": int(now.timestamp()),
        "exp": int(now.timestamp()),
    }
    token = jwt.encode(payload, settings.jwt_secret_key, algorithm="HS256")
    with pytest.raises(UnauthorizedException):
        decode_access_token(token, settings=settings)


def test_wrong_signature_fails() -> None:
    settings = _settings()
    token, _ = create_access_token(user_id=ObjectId(), role=UserRole.PATIENT, settings=settings)
    other = _settings(JWT_SECRET_KEY="other-secret-key-32-characters-xxxx")
    with pytest.raises(UnauthorizedException):
        decode_access_token(token, settings=other)


def test_wrong_issuer_fails() -> None:
    settings = _settings()
    token, _ = create_access_token(user_id=ObjectId(), role=UserRole.PATIENT, settings=settings)
    bad = _settings(JWT_ISSUER="other-issuer")
    with pytest.raises(UnauthorizedException):
        decode_access_token(token, settings=bad)


def test_wrong_audience_fails() -> None:
    settings = _settings()
    token, _ = create_access_token(user_id=ObjectId(), role=UserRole.PATIENT, settings=settings)
    bad = _settings(JWT_AUDIENCE="other-aud")
    with pytest.raises(UnauthorizedException):
        decode_access_token(token, settings=bad)


def test_wrong_token_type_fails() -> None:
    settings = _settings()
    now = datetime.now(UTC)
    payload = {
        "sub": str(ObjectId()),
        "type": "refresh",
        "role": "patient",
        "jti": "x",
        "iss": settings.jwt_issuer,
        "aud": settings.jwt_audience,
        "iat": int(now.timestamp()),
        "nbf": int(now.timestamp()),
        "exp": int((now + timedelta(minutes=5)).timestamp()),
    }
    token = jwt.encode(payload, settings.jwt_secret_key, algorithm="HS256")
    with pytest.raises(UnauthorizedException):
        decode_access_token(token, settings=settings)


def test_malformed_subject_fails() -> None:
    settings = _settings()
    now = datetime.now(UTC)
    payload = {
        "sub": "not-an-object-id",
        "type": "access",
        "role": "patient",
        "jti": "x",
        "iss": settings.jwt_issuer,
        "aud": settings.jwt_audience,
        "iat": int(now.timestamp()),
        "nbf": int(now.timestamp()),
        "exp": int((now + timedelta(minutes=5)).timestamp()),
    }
    token = jwt.encode(payload, settings.jwt_secret_key, algorithm="HS256")
    with pytest.raises(UnauthorizedException):
        decode_access_token(token, settings=settings)
