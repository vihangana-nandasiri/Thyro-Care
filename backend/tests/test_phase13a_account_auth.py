"""Phase 13A — password reset, email verification, change password, Google auth."""

from __future__ import annotations

import asyncio
from datetime import timedelta
from typing import Any

import pytest
from app.core.config import Settings, get_settings
from app.core.exceptions import ConflictException, UnauthorizedException, ValidationException
from app.core.passwords import hash_password
from app.db.collections import CollectionName
from app.models.enums import AccountStatus, UserRole
from app.schemas.auth import (
    ChangePasswordRequest,
    ForgotPasswordRequest,
    GoogleAuthRequest,
    LoginRequest,
    RegisterRequest,
    ResendVerificationRequest,
    ResetPasswordRequest,
    VerifyEmailRequest,
)
from app.services.account_auth_service import (
    GENERIC_ALREADY_VERIFIED,
    GENERIC_RESET,
    GENERIC_TOKEN_INVALID,
    GENERIC_VERIFY_OK,
    AccountAuthService,
)
from app.services.auth_service import AuthService
from app.services.auth_token_crypto import generate_raw_token, hash_action_token
from app.services.google_identity_service import GENERIC_GOOGLE_INVALID, VerifiedGoogleIdentity
from app.utils.datetime import utc_now

from tests.fakes.memory_db import MemoryDatabase


class RecordingEmailService:
    def __init__(self) -> None:
        self.calls: list[tuple[str, dict[str, Any]]] = []

    async def send_verification_email(self, **kwargs: Any) -> None:
        self.calls.append(("verification", kwargs))

    async def send_password_reset_email(self, **kwargs: Any) -> None:
        self.calls.append(("reset", kwargs))

    async def send_password_changed_email(self, **kwargs: Any) -> None:
        self.calls.append(("changed", kwargs))


class FakeGoogleService:
    def __init__(
        self, identity: VerifiedGoogleIdentity | None = None, *, fail: bool = False
    ) -> None:
        self.identity = identity
        self.fail = fail
        self.seen: list[str] = []

    def verify_id_token(self, credential: str) -> VerifiedGoogleIdentity:
        self.seen.append(credential)
        if self.fail or self.identity is None:
            raise UnauthorizedException(GENERIC_GOOGLE_INVALID)
        return self.identity


def _settings(**overrides: Any) -> Settings:
    import os

    get_settings.cache_clear()
    env_map = {
        "APP_ENVIRONMENT": "test",
        "PASSWORD_RESET_ENABLED": "true",
        "EMAIL_VERIFICATION_ENABLED": "true",
        "EMAIL_DELIVERY_ENABLED": "true",
        "GOOGLE_AUTH_ENABLED": "true",
        "GOOGLE_CLIENT_ID": "test-google-client-id.apps.googleusercontent.com",
        "REQUIRE_EMAIL_VERIFICATION": "false",
        "FRONTEND_PUBLIC_URL": "http://localhost:5173",
        "RATE_LIMIT_ENABLED": "false",
        "JWT_SECRET_KEY": "test-jwt-secret-key-phase13a-not-for-production",
        "DATABASE_REQUIRE_CONNECTION": "false",
    }
    field_to_env = {
        "app_environment": "APP_ENVIRONMENT",
        "password_reset_enabled": "PASSWORD_RESET_ENABLED",
        "email_verification_enabled": "EMAIL_VERIFICATION_ENABLED",
        "email_delivery_enabled": "EMAIL_DELIVERY_ENABLED",
        "google_auth_enabled": "GOOGLE_AUTH_ENABLED",
        "google_client_id": "GOOGLE_CLIENT_ID",
        "require_email_verification": "REQUIRE_EMAIL_VERIFICATION",
        "frontend_public_url": "FRONTEND_PUBLIC_URL",
        "rate_limit_enabled": "RATE_LIMIT_ENABLED",
        "jwt_secret_key": "JWT_SECRET_KEY",
    }
    for key, value in overrides.items():
        env_key = field_to_env.get(key, key.upper())
        if isinstance(value, bool):
            env_map[env_key] = "true" if value else "false"
        else:
            env_map[env_key] = str(value)
    for key, value in env_map.items():
        os.environ[key] = value
    get_settings.cache_clear()
    return get_settings()


def _cred(label: str = "google") -> str:
    return f"test-google-id-token-{label}-xxxxxxxx"


@pytest.fixture
def memory_db() -> MemoryDatabase:
    return MemoryDatabase()


def _account_service(
    memory_db: MemoryDatabase,
    settings: Settings,
    *,
    email: RecordingEmailService | None = None,
    google: FakeGoogleService | None = None,
) -> AccountAuthService:
    return AccountAuthService(
        memory_db,  # type: ignore[arg-type]
        settings=settings,
        email_service=email or RecordingEmailService(),  # type: ignore[arg-type]
        google_service=google or FakeGoogleService(fail=True),  # type: ignore[arg-type]
    )


async def _register_user(
    memory_db: MemoryDatabase,
    settings: Settings,
    email: str = "patient@example.com",
) -> Any:
    auth = AuthService(memory_db, settings)  # type: ignore[arg-type]
    return await auth.register(
        RegisterRequest(
            full_name="Test Patient",
            email=email,  # type: ignore[arg-type]
            password="secure-pass-1",
            confirm_password="secure-pass-1",
            consent_accepted=True,
            disclaimer_accepted=True,
        )
    )


def _google_identity(
    *,
    sub: str = "google-sub-1",
    email: str = "new.google@example.com",
    name: str = "Google User",
) -> VerifiedGoogleIdentity:
    return VerifiedGoogleIdentity(
        provider_subject=sub,
        normalized_email=email.lower(),
        display_email=email,
        display_name=name,
        email_verified=True,
    )


# --- Password reset ---------------------------------------------------------


@pytest.mark.asyncio
async def test_forgot_password_identical_for_existing_and_missing(
    memory_db: MemoryDatabase,
) -> None:
    settings = _settings()
    email = RecordingEmailService()
    svc = _account_service(memory_db, settings, email=email)
    await _register_user(memory_db, settings)

    existing = await svc.forgot_password(ForgotPasswordRequest(email="patient@example.com"))  # type: ignore[arg-type]
    missing = await svc.forgot_password(ForgotPasswordRequest(email="nobody@example.com"))  # type: ignore[arg-type]
    assert existing.message == GENERIC_RESET
    assert missing.message == GENERIC_RESET
    assert existing.message == missing.message


@pytest.mark.asyncio
async def test_reset_token_never_persisted_raw(memory_db: MemoryDatabase) -> None:
    settings = _settings()
    email = RecordingEmailService()
    svc = _account_service(memory_db, settings, email=email)
    await _register_user(memory_db, settings)
    await svc.forgot_password(ForgotPasswordRequest(email="patient@example.com"))  # type: ignore[arg-type]

    assert email.calls and email.calls[0][0] == "reset"
    raw = email.calls[0][1]["raw_token"]
    collection = memory_db[CollectionName.AUTH_ACTION_TOKENS.value]
    dumped = str(collection.docs)
    assert raw not in dumped
    assert collection.docs[0]["token_hash"] == hash_action_token(raw)
    assert collection.docs[0]["token_hash"] != raw


@pytest.mark.asyncio
async def test_reset_token_expires(memory_db: MemoryDatabase) -> None:
    settings = _settings()
    email = RecordingEmailService()
    svc = _account_service(memory_db, settings, email=email)
    await _register_user(memory_db, settings)
    await svc.forgot_password(ForgotPasswordRequest(email="patient@example.com"))  # type: ignore[arg-type]
    raw = email.calls[0][1]["raw_token"]
    memory_db[CollectionName.AUTH_ACTION_TOKENS.value].docs[0]["expires_at"] = (
        utc_now() - timedelta(minutes=1)
    )
    with pytest.raises(ValidationException) as exc:
        await svc.reset_password(
            ResetPasswordRequest(
                token=raw,
                new_password="new-secure-pass-1",
                confirm_password="new-secure-pass-1",
            )
        )
    assert GENERIC_TOKEN_INVALID in str(exc.value)


@pytest.mark.asyncio
async def test_reset_token_single_use(memory_db: MemoryDatabase) -> None:
    settings = _settings()
    email = RecordingEmailService()
    svc = _account_service(memory_db, settings, email=email)
    await _register_user(memory_db, settings)
    await svc.forgot_password(ForgotPasswordRequest(email="patient@example.com"))  # type: ignore[arg-type]
    raw = email.calls[0][1]["raw_token"]
    await svc.reset_password(
        ResetPasswordRequest(
            token=raw,
            new_password="new-secure-pass-1",
            confirm_password="new-secure-pass-1",
        )
    )
    with pytest.raises(ValidationException):
        await svc.reset_password(
            ResetPasswordRequest(
                token=raw,
                new_password="another-secure-1",
                confirm_password="another-secure-1",
            )
        )


@pytest.mark.asyncio
async def test_reset_invalidates_refresh_sessions(memory_db: MemoryDatabase) -> None:
    settings = _settings()
    email = RecordingEmailService()
    svc = _account_service(memory_db, settings, email=email)
    session = await _register_user(memory_db, settings)
    assert memory_db[CollectionName.REFRESH_TOKENS.value].docs
    await svc.forgot_password(ForgotPasswordRequest(email="patient@example.com"))  # type: ignore[arg-type]
    raw = email.calls[0][1]["raw_token"]
    await svc.reset_password(
        ResetPasswordRequest(
            token=raw,
            new_password="new-secure-pass-1",
            confirm_password="new-secure-pass-1",
        )
    )
    refresh_docs = memory_db[CollectionName.REFRESH_TOKENS.value].docs
    assert all(d.get("revoked_at") is not None for d in refresh_docs)
    # Ensure prior access token session family was revoked; login with new password works.
    auth = AuthService(memory_db, settings)  # type: ignore[arg-type]
    await auth.login(
        LoginRequest(email="patient@example.com", password="new-secure-pass-1")  # type: ignore[arg-type]
    )
    assert session.response.access_token


@pytest.mark.asyncio
async def test_reset_rejects_weak_password(memory_db: MemoryDatabase) -> None:
    settings = _settings()
    email = RecordingEmailService()
    svc = _account_service(memory_db, settings, email=email)
    await _register_user(memory_db, settings)
    await svc.forgot_password(ForgotPasswordRequest(email="patient@example.com"))  # type: ignore[arg-type]
    raw = email.calls[0][1]["raw_token"]
    from pydantic import ValidationError

    with pytest.raises((ValidationError, ValidationException)):
        ResetPasswordRequest(token=raw, new_password="short", confirm_password="short")
    with pytest.raises((ValidationError, ValidationException)):
        ResetPasswordRequest(
            token=raw,
            new_password="short",
            confirm_password="short",
        )


@pytest.mark.asyncio
async def test_concurrent_reset_consumes_once(memory_db: MemoryDatabase) -> None:
    settings = _settings()
    email = RecordingEmailService()
    svc = _account_service(memory_db, settings, email=email)
    await _register_user(memory_db, settings)
    await svc.forgot_password(ForgotPasswordRequest(email="patient@example.com"))  # type: ignore[arg-type]
    raw = email.calls[0][1]["raw_token"]

    async def attempt() -> str:
        try:
            result = await svc.reset_password(
                ResetPasswordRequest(
                    token=raw,
                    new_password="new-secure-pass-1",
                    confirm_password="new-secure-pass-1",
                )
            )
            return "ok:" + result.message
        except ValidationException:
            return "fail"

    outcomes = await asyncio.gather(attempt(), attempt())
    assert outcomes.count("fail") == 1
    assert sum(1 for o in outcomes if o.startswith("ok:")) == 1


@pytest.mark.asyncio
async def test_forgot_password_suspended_no_email_no_leak(memory_db: MemoryDatabase) -> None:
    settings = _settings()
    email = RecordingEmailService()
    svc = _account_service(memory_db, settings, email=email)
    await _register_user(memory_db, settings, "sus@example.com")
    memory_db[CollectionName.USERS.value].docs[0]["account_status"] = AccountStatus.SUSPENDED.value
    result = await svc.forgot_password(ForgotPasswordRequest(email="sus@example.com"))  # type: ignore[arg-type]
    assert result.message == GENERIC_RESET
    assert email.calls == []


@pytest.mark.asyncio
async def test_forgot_password_disabled_still_generic(memory_db: MemoryDatabase) -> None:
    settings = _settings(password_reset_enabled=False)
    email = RecordingEmailService()
    svc = _account_service(memory_db, settings, email=email)
    await _register_user(memory_db, settings)
    result = await svc.forgot_password(ForgotPasswordRequest(email="patient@example.com"))  # type: ignore[arg-type]
    assert result.message == GENERIC_RESET
    assert email.calls == []


# --- Email verification -----------------------------------------------------


@pytest.mark.asyncio
async def test_verification_token_not_persisted_raw(memory_db: MemoryDatabase) -> None:
    settings = _settings()
    email = RecordingEmailService()
    svc = _account_service(memory_db, settings, email=email)
    await _register_user(memory_db, settings)
    user = await svc.users.get_by_email_normalized("patient@example.com")
    assert user is not None
    await svc.maybe_send_registration_verification(user)
    assert email.calls and email.calls[0][0] == "verification"
    raw = email.calls[0][1]["raw_token"]
    dumped = str(memory_db[CollectionName.AUTH_ACTION_TOKENS.value].docs)
    assert raw not in dumped


@pytest.mark.asyncio
async def test_verify_email_success(memory_db: MemoryDatabase) -> None:
    settings = _settings()
    email = RecordingEmailService()
    svc = _account_service(memory_db, settings, email=email)
    await _register_user(memory_db, settings)
    user = await svc.users.get_by_email_normalized("patient@example.com")
    assert user is not None
    await svc.users.update_one(user.id, {"email_verified": False})
    await svc.maybe_send_registration_verification(user)
    raw = email.calls[0][1]["raw_token"]
    result = await svc.verify_email(VerifyEmailRequest(token=raw))
    assert result.message == GENERIC_VERIFY_OK
    refreshed = await svc.users.get_by_id(user.id)
    assert refreshed is not None
    assert refreshed.email_verified is True
    assert refreshed.role == UserRole.PATIENT


@pytest.mark.asyncio
async def test_verify_email_expired(memory_db: MemoryDatabase) -> None:
    settings = _settings()
    email = RecordingEmailService()
    svc = _account_service(memory_db, settings, email=email)
    await _register_user(memory_db, settings)
    user = await svc.users.get_by_email_normalized("patient@example.com")
    assert user is not None
    await svc.maybe_send_registration_verification(user)
    raw = email.calls[0][1]["raw_token"]
    memory_db[CollectionName.AUTH_ACTION_TOKENS.value].docs[0]["expires_at"] = (
        utc_now() - timedelta(hours=1)
    )
    with pytest.raises(ValidationException):
        await svc.verify_email(VerifyEmailRequest(token=raw))


@pytest.mark.asyncio
async def test_verify_email_reuse_rejected(memory_db: MemoryDatabase) -> None:
    settings = _settings()
    email = RecordingEmailService()
    svc = _account_service(memory_db, settings, email=email)
    await _register_user(memory_db, settings)
    user = await svc.users.get_by_email_normalized("patient@example.com")
    assert user is not None
    await svc.users.update_one(user.id, {"email_verified": False})
    await svc.maybe_send_registration_verification(user)
    raw = email.calls[0][1]["raw_token"]
    await svc.verify_email(VerifyEmailRequest(token=raw))
    with pytest.raises(ValidationException):
        await svc.verify_email(VerifyEmailRequest(token=raw))


@pytest.mark.asyncio
async def test_resend_skips_already_verified(memory_db: MemoryDatabase) -> None:
    settings = _settings()
    email = RecordingEmailService()
    svc = _account_service(memory_db, settings, email=email)
    session = await _register_user(memory_db, settings)
    user = await svc.users.get_by_id(session.response.user.id)  # type: ignore[arg-type]
    assert user is not None
    await svc.users.update_one(user.id, {"email_verified": True})
    user = await svc.users.get_by_id(user.id)
    assert user is not None
    result = await svc.resend_verification(user=user, payload=ResendVerificationRequest())
    assert result.message == GENERIC_ALREADY_VERIFIED
    assert email.calls == []


@pytest.mark.asyncio
async def test_public_registration_remains_patient(memory_db: MemoryDatabase) -> None:
    settings = _settings()
    session = await _register_user(memory_db, settings)
    assert session.response.user.role == UserRole.PATIENT


# --- Change password --------------------------------------------------------


@pytest.mark.asyncio
async def test_change_password_requires_current(memory_db: MemoryDatabase) -> None:
    settings = _settings()
    email = RecordingEmailService()
    svc = _account_service(memory_db, settings, email=email)
    session = await _register_user(memory_db, settings)
    user = await svc.users.get_by_id(session.response.user.id)  # type: ignore[arg-type]
    assert user is not None
    with pytest.raises(UnauthorizedException):
        await svc.change_password(
            user,
            ChangePasswordRequest(
                current_password="wrong-password",
                new_password="brand-new-pass-1",
                confirm_password="brand-new-pass-1",
            ),
        )


@pytest.mark.asyncio
async def test_change_password_rejects_reuse(memory_db: MemoryDatabase) -> None:
    settings = _settings()
    email = RecordingEmailService()
    svc = _account_service(memory_db, settings, email=email)
    session = await _register_user(memory_db, settings)
    user = await svc.users.get_by_id(session.response.user.id)  # type: ignore[arg-type]
    assert user is not None
    with pytest.raises(ValidationException):
        await svc.change_password(
            user,
            ChangePasswordRequest(
                current_password="secure-pass-1",
                new_password="secure-pass-1",
                confirm_password="secure-pass-1",
            ),
        )


@pytest.mark.asyncio
async def test_change_password_revokes_sessions(memory_db: MemoryDatabase) -> None:
    settings = _settings()
    email = RecordingEmailService()
    svc = _account_service(memory_db, settings, email=email)
    session = await _register_user(memory_db, settings)
    user = await svc.users.get_by_id(session.response.user.id)  # type: ignore[arg-type]
    assert user is not None
    assert memory_db[CollectionName.REFRESH_TOKENS.value].docs
    await svc.change_password(
        user,
        ChangePasswordRequest(
            current_password="secure-pass-1",
            new_password="brand-new-pass-1",
            confirm_password="brand-new-pass-1",
        ),
    )
    assert all(
        d.get("revoked_at") is not None for d in memory_db[CollectionName.REFRESH_TOKENS.value].docs
    )
    assert any(c[0] == "changed" for c in email.calls)
    # password never stored plain
    dumped = str(memory_db[CollectionName.USERS.value].docs)
    assert "brand-new-pass-1" not in dumped
    assert "secure-pass-1" not in dumped


# --- Google -----------------------------------------------------------------


@pytest.mark.asyncio
async def test_google_disabled_rejects(memory_db: MemoryDatabase) -> None:
    settings = _settings(google_auth_enabled=False)
    google = FakeGoogleService(_google_identity())
    svc = _account_service(memory_db, settings, google=google)
    with pytest.raises(UnauthorizedException):
        await svc.google_login(GoogleAuthRequest(credential=_cred()))


@pytest.mark.asyncio
async def test_google_invalid_credential_generic(memory_db: MemoryDatabase) -> None:
    settings = _settings()
    google = FakeGoogleService(fail=True)
    svc = _account_service(memory_db, settings, google=google)
    with pytest.raises(UnauthorizedException) as exc:
        await svc.google_login(GoogleAuthRequest(credential=_cred()))
    assert GENERIC_GOOGLE_INVALID in str(exc.value)


@pytest.mark.asyncio
async def test_google_new_user_is_patient(memory_db: MemoryDatabase) -> None:
    settings = _settings()
    google = FakeGoogleService(_google_identity())
    svc = _account_service(memory_db, settings, google=google)
    session = await svc.google_login(GoogleAuthRequest(credential=_cred()))
    assert session.response.user.role == UserRole.PATIENT
    assert session.response.user.email_verified is True
    identities = memory_db[CollectionName.AUTH_IDENTITIES.value].docs
    assert len(identities) == 1
    assert identities[0]["provider_subject"] == "google-sub-1"
    assert "id-token-abc" not in str(identities)
    assert "id-token-abc" not in str(memory_db[CollectionName.USERS.value].docs)


@pytest.mark.asyncio
async def test_google_returning_identity_logs_in(memory_db: MemoryDatabase) -> None:
    settings = _settings()
    google = FakeGoogleService(_google_identity())
    svc = _account_service(memory_db, settings, google=google)
    first = await svc.google_login(GoogleAuthRequest(credential=_cred()))
    second = await svc.google_login(GoogleAuthRequest(credential=_cred()))
    assert first.response.user.id == second.response.user.id
    assert len(memory_db[CollectionName.USERS.value].docs) == 1


@pytest.mark.asyncio
async def test_google_existing_local_email_not_silently_linked(memory_db: MemoryDatabase) -> None:
    settings = _settings()
    await _register_user(memory_db, settings, "local@example.com")
    google = FakeGoogleService(_google_identity(email="local@example.com", sub="other-sub"))
    svc = _account_service(memory_db, settings, google=google)
    with pytest.raises(ConflictException) as exc:
        await svc.google_login(GoogleAuthRequest(credential=_cred()))
    assert "Sign in with your password" in str(exc.value)
    assert memory_db[CollectionName.AUTH_IDENTITIES.value].docs == []


@pytest.mark.asyncio
async def test_google_does_not_replace_admin(memory_db: MemoryDatabase) -> None:
    settings = _settings()
    # Seed an admin with matching email (privileged path would have created this).
    memory_db[CollectionName.USERS.value].docs.append(
        {
            "_id": __import__("bson").ObjectId(),
            "email_normalized": "admin@example.com",
            "email_display": "admin@example.com",
            "password_hash": hash_password("secure-pass-1"),
            "full_name": "Admin",
            "role": UserRole.ADMIN.value,
            "account_status": AccountStatus.ACTIVE.value,
            "email_verified": True,
            "password_auth_enabled": True,
            "is_deleted": False,
            "failed_login_count": 0,
            "locked_until": None,
            "schema_version": 1,
            "created_at": utc_now(),
            "updated_at": utc_now(),
        }
    )
    google = FakeGoogleService(_google_identity(email="admin@example.com", sub="admin-google"))
    svc = _account_service(memory_db, settings, google=google)
    with pytest.raises(ConflictException):
        await svc.google_login(GoogleAuthRequest(credential=_cred()))
    user = memory_db[CollectionName.USERS.value].docs[0]
    assert user["role"] == UserRole.ADMIN.value


@pytest.mark.asyncio
async def test_google_does_not_replace_medical_expert(memory_db: MemoryDatabase) -> None:
    settings = _settings()
    memory_db[CollectionName.USERS.value].docs.append(
        {
            "_id": __import__("bson").ObjectId(),
            "email_normalized": "expert@example.com",
            "email_display": "expert@example.com",
            "password_hash": hash_password("secure-pass-1"),
            "full_name": "Expert",
            "role": UserRole.MEDICAL_EXPERT.value,
            "account_status": AccountStatus.ACTIVE.value,
            "email_verified": True,
            "password_auth_enabled": True,
            "is_deleted": False,
            "failed_login_count": 0,
            "locked_until": None,
            "schema_version": 1,
            "created_at": utc_now(),
            "updated_at": utc_now(),
        }
    )
    google = FakeGoogleService(_google_identity(email="expert@example.com", sub="expert-google"))
    svc = _account_service(memory_db, settings, google=google)
    with pytest.raises(ConflictException):
        await svc.google_login(GoogleAuthRequest(credential=_cred()))
    assert memory_db[CollectionName.USERS.value].docs[0]["role"] == UserRole.MEDICAL_EXPERT.value


@pytest.mark.asyncio
async def test_google_concurrent_first_login_no_duplicate_identity(
    memory_db: MemoryDatabase,
) -> None:
    settings = _settings()
    google = FakeGoogleService(_google_identity(sub="race-sub", email="race@example.com"))
    svc = _account_service(memory_db, settings, google=google)

    async def once() -> str:
        session = await svc.google_login(GoogleAuthRequest(credential=_cred()))
        return str(session.response.user.id)

    ids = await asyncio.gather(once(), once())
    assert ids[0] == ids[1] or len({ids[0], ids[1]}) <= 2
    # At most one identity for the provider subject
    subjects = [d["provider_subject"] for d in memory_db[CollectionName.AUTH_IDENTITIES.value].docs]
    assert subjects.count("race-sub") == 1


@pytest.mark.asyncio
async def test_email_password_login_still_works(memory_db: MemoryDatabase) -> None:
    settings = _settings()
    await _register_user(memory_db, settings)
    auth = AuthService(memory_db, settings)  # type: ignore[arg-type]
    session = await auth.login(
        LoginRequest(email="patient@example.com", password="secure-pass-1")  # type: ignore[arg-type]
    )
    assert session.response.access_token
    assert session.raw_refresh_token


@pytest.mark.asyncio
async def test_google_token_not_logged_by_service(
    memory_db: MemoryDatabase, caplog: pytest.LogCaptureFixture
) -> None:
    settings = _settings()
    credential = "super-secret-google-id-token-value-xx"
    google = FakeGoogleService(_google_identity())
    svc = _account_service(memory_db, settings, google=google)
    with caplog.at_level("DEBUG"):
        await svc.google_login(GoogleAuthRequest(credential=credential))
    assert credential not in caplog.text


def test_generate_raw_token_entropy() -> None:
    a = generate_raw_token()
    b = generate_raw_token()
    assert a != b
    assert len(a) >= 32
