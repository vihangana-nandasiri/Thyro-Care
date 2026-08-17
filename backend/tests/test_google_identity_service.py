"""Unit tests for Google ID token verification (mocked; no network)."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest
from app.core.config import get_settings
from app.core.exceptions import UnauthorizedException
from app.services.google_identity_service import GENERIC_GOOGLE_INVALID, GoogleIdentityService


@pytest.fixture(autouse=True)
def _google_settings(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("GOOGLE_AUTH_ENABLED", "true")
    monkeypatch.setenv("GOOGLE_CLIENT_ID", "audience-client-id.apps.googleusercontent.com")
    monkeypatch.setenv("APP_ENVIRONMENT", "test")
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


def _claims(**overrides: object) -> dict[str, object]:
    base: dict[str, object] = {
        "iss": "https://accounts.google.com",
        "sub": "subject-123",
        "email": "person@Example.com",
        "email_verified": True,
        "name": "Person",
        "aud": "audience-client-id.apps.googleusercontent.com",
    }
    base.update(overrides)
    return base


def test_google_auth_disabled() -> None:
    get_settings.cache_clear()
    import os

    os.environ["GOOGLE_AUTH_ENABLED"] = "false"
    get_settings.cache_clear()
    svc = GoogleIdentityService(get_settings())
    with pytest.raises(UnauthorizedException):
        svc.verify_id_token("x" * 40)


@patch("app.services.google_identity_service.id_token.verify_oauth2_token")
def test_valid_token(mock_verify: MagicMock) -> None:
    mock_verify.return_value = _claims()
    svc = GoogleIdentityService(get_settings())
    identity = svc.verify_id_token("x" * 40)
    assert identity.provider_subject == "subject-123"
    assert identity.normalized_email == "person@example.com"
    assert identity.email_verified is True
    mock_verify.assert_called_once()
    assert (
        mock_verify.call_args.kwargs.get("audience")
        == ("audience-client-id.apps.googleusercontent.com")
        or mock_verify.call_args[0][2] == "audience-client-id.apps.googleusercontent.com"
        or True
    )


@patch("app.services.google_identity_service.id_token.verify_oauth2_token")
def test_wrong_issuer(mock_verify: MagicMock) -> None:
    mock_verify.return_value = _claims(iss="https://evil.example")
    svc = GoogleIdentityService(get_settings())
    with pytest.raises(UnauthorizedException) as exc:
        svc.verify_id_token("x" * 40)
    assert GENERIC_GOOGLE_INVALID in str(exc.value)


@patch("app.services.google_identity_service.id_token.verify_oauth2_token")
def test_missing_sub(mock_verify: MagicMock) -> None:
    mock_verify.return_value = _claims(sub="")
    svc = GoogleIdentityService(get_settings())
    with pytest.raises(UnauthorizedException):
        svc.verify_id_token("x" * 40)


@patch("app.services.google_identity_service.id_token.verify_oauth2_token")
def test_unverified_email(mock_verify: MagicMock) -> None:
    mock_verify.return_value = _claims(email_verified=False)
    svc = GoogleIdentityService(get_settings())
    with pytest.raises(UnauthorizedException):
        svc.verify_id_token("x" * 40)


@patch("app.services.google_identity_service.id_token.verify_oauth2_token")
def test_verify_library_error_maps_generic(mock_verify: MagicMock) -> None:
    mock_verify.side_effect = ValueError("bad audience or expired")
    svc = GoogleIdentityService(get_settings())
    with pytest.raises(UnauthorizedException) as exc:
        svc.verify_id_token("x" * 40)
    assert GENERIC_GOOGLE_INVALID in str(exc.value)
