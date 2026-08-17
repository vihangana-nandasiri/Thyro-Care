"""Auth service + HTTP route tests using in-memory database."""

from __future__ import annotations

import pytest
from app.api.dependencies import get_database
from app.core.config import get_settings
from app.core.exceptions import ConflictException, ForbiddenException, UnauthorizedException
from app.main import create_application
from app.models.enums import AccountStatus, UserRole
from app.schemas.auth import LoginRequest, RegisterRequest
from app.services.auth_service import GENERIC_INVALID, AuthService
from app.services.refresh_token_crypto import hash_refresh_token
from httpx import ASGITransport, AsyncClient

from tests.fakes.memory_db import MemoryDatabase


@pytest.fixture
def memory_db() -> MemoryDatabase:
    return MemoryDatabase()


@pytest.fixture
def auth_service(memory_db: MemoryDatabase) -> AuthService:
    get_settings.cache_clear()
    return AuthService(memory_db)  # type: ignore[arg-type]


def _register_payload(email: str = "Patient@Example.com") -> RegisterRequest:
    return RegisterRequest(
        full_name="Test Patient",
        email=email,  # type: ignore[arg-type]
        password="secure-pass-1",
        confirm_password="secure-pass-1",
        consent_accepted=True,
        disclaimer_accepted=True,
    )


def _csrf_from_response(response: object) -> str:
    cookies = getattr(response, "cookies", None)
    if cookies is not None:
        for cookie in cookies.jar:
            if cookie.name == "thyrocare_csrf":
                return str(cookie.value)
    headers = getattr(response, "headers", None)
    if headers is not None:
        for part in headers.get_list("set-cookie"):
            if part.startswith("thyrocare_csrf="):
                return part.split(";", 1)[0].split("=", 1)[1]
    raise AssertionError("CSRF cookie missing")


@pytest.mark.asyncio
async def test_register_forces_patient_role(auth_service: AuthService) -> None:
    session = await auth_service.register(_register_payload())
    assert session.response.user.role == UserRole.PATIENT
    assert "password" not in session.response.model_dump()


@pytest.mark.asyncio
async def test_register_stores_password_hash_only(
    auth_service: AuthService, memory_db: MemoryDatabase
) -> None:
    await auth_service.register(_register_payload())
    users = memory_db["users"].docs
    assert len(users) == 1
    assert users[0]["password_hash"].startswith("$argon2")
    assert users[0]["password_hash"] != "secure-pass-1"
    assert users[0]["email_normalized"] == "patient@example.com"


@pytest.mark.asyncio
async def test_register_creates_consent_profile(
    auth_service: AuthService, memory_db: MemoryDatabase
) -> None:
    await auth_service.register(_register_payload("consent@example.com"))
    profiles = memory_db["patient_profiles"].docs
    assert len(profiles) == 1
    assert profiles[0]["consent_accepted_at"] is not None
    assert profiles[0]["disclaimer_accepted_at"] is not None


@pytest.mark.asyncio
async def test_register_duplicate_email(auth_service: AuthService) -> None:
    await auth_service.register(_register_payload())
    with pytest.raises(ConflictException):
        await auth_service.register(_register_payload("patient@example.com"))


@pytest.mark.asyncio
async def test_register_rejects_false_consent() -> None:
    from pydantic import ValidationError

    with pytest.raises(ValidationError):
        RegisterRequest(
            full_name="Test",
            email="x@example.com",  # type: ignore[arg-type]
            password="secure-pass-1",
            confirm_password="secure-pass-1",
            consent_accepted=False,
            disclaimer_accepted=True,
        )


@pytest.mark.asyncio
async def test_login_wrong_password_generic(auth_service: AuthService) -> None:
    await auth_service.register(_register_payload())
    with pytest.raises(UnauthorizedException) as exc:
        await auth_service.login(
            LoginRequest(email="patient@example.com", password="wrong-password")  # type: ignore[arg-type]
        )
    assert GENERIC_INVALID in str(exc.value)


@pytest.mark.asyncio
async def test_login_unknown_email_generic(auth_service: AuthService) -> None:
    with pytest.raises(UnauthorizedException) as exc:
        await auth_service.login(
            LoginRequest(email="missing@example.com", password="secure-pass-1")  # type: ignore[arg-type]
        )
    assert GENERIC_INVALID in str(exc.value)


@pytest.mark.asyncio
async def test_login_lockout(auth_service: AuthService, memory_db: MemoryDatabase) -> None:
    await auth_service.register(_register_payload("lock@example.com"))
    settings = get_settings()
    for _ in range(settings.login_max_failed_attempts):
        with pytest.raises(UnauthorizedException):
            await auth_service.login(
                LoginRequest(email="lock@example.com", password="wrong-password")  # type: ignore[arg-type]
            )
    user = memory_db["users"].docs[0]
    assert user.get("locked_until") is not None
    with pytest.raises(UnauthorizedException):
        await auth_service.login(
            LoginRequest(email="lock@example.com", password="secure-pass-1")  # type: ignore[arg-type]
        )


@pytest.mark.asyncio
async def test_suspended_user_cannot_login(
    auth_service: AuthService, memory_db: MemoryDatabase
) -> None:
    await auth_service.register(_register_payload("sus@example.com"))
    memory_db["users"].docs[0]["account_status"] = AccountStatus.SUSPENDED.value
    with pytest.raises(ForbiddenException):
        await auth_service.login(
            LoginRequest(email="sus@example.com", password="secure-pass-1")  # type: ignore[arg-type]
        )


@pytest.mark.asyncio
async def test_refresh_rotates_and_reuses_family(
    auth_service: AuthService, memory_db: MemoryDatabase
) -> None:
    session = await auth_service.register(_register_payload("rotate@example.com"))
    first_raw = session.raw_refresh_token
    rotated = await auth_service.refresh(first_raw)
    assert rotated.raw_refresh_token != first_raw
    with pytest.raises(UnauthorizedException):
        await auth_service.refresh(first_raw)
    tokens = memory_db["refresh_tokens"].docs
    # Reuse detection revokes the entire family, including the rotated token.
    assert all(t.get("revoked_at") is not None for t in tokens)
    assert any(t["token_hash"] == hash_refresh_token(rotated.raw_refresh_token) for t in tokens)


@pytest.mark.asyncio
async def test_auth_http_flow(memory_db: MemoryDatabase, monkeypatch: pytest.MonkeyPatch) -> None:
    get_settings.cache_clear()
    monkeypatch.setenv("JWT_SECRET_KEY", "unit-test-secret-key-32-characters!!")
    get_settings.cache_clear()

    async def fake_connect(_settings: object) -> None:
        return None

    async def fake_close() -> None:
        return None

    async def fake_initialize(_settings: object) -> None:
        return None

    async def fake_ping() -> dict[str, object]:
        return {"connected": False, "status": "disconnected", "error": "test"}

    from app.db import mongodb as mongodb_module

    monkeypatch.setattr(mongodb_module, "connect_to_mongo", fake_connect)
    monkeypatch.setattr(mongodb_module, "close_mongo_connection", fake_close)
    monkeypatch.setattr(mongodb_module, "ping_mongo", fake_ping)
    monkeypatch.setattr("app.main.initialize_database", fake_initialize)

    app = create_application()
    app.dependency_overrides[get_database] = lambda: memory_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        reg = await client.post(
            "/api/v1/auth/register",
            json={
                "full_name": "HTTP Patient",
                "email": "http.patient@example.com",
                "password": "secure-pass-1",
                "confirm_password": "secure-pass-1",
                "consent_accepted": True,
                "disclaimer_accepted": True,
            },
        )
        assert reg.status_code == 201, reg.text
        body = reg.json()
        assert body["token_type"] == "bearer"
        assert body["user"]["role"] == "patient"
        assert "password_hash" not in body["user"]
        assert "thyrocare_refresh" in reg.cookies

        me = await client.get(
            "/api/v1/auth/me",
            headers={"Authorization": f"Bearer {body['access_token']}"},
        )
        assert me.status_code == 200
        assert me.json()["email"] == "http.patient@example.com"

        csrf_cookie = _csrf_from_response(reg)

        missing_csrf = await client.post("/api/v1/auth/refresh")
        assert missing_csrf.status_code == 403

        bad_csrf = await client.post(
            "/api/v1/auth/refresh",
            headers={"X-CSRF-Token": "not-the-real-token"},
        )
        assert bad_csrf.status_code == 403

        refresh = await client.post(
            "/api/v1/auth/refresh",
            headers={"X-CSRF-Token": csrf_cookie},
        )
        assert refresh.status_code == 200, refresh.text

        logout_csrf = _csrf_from_response(refresh)

        logout = await client.post(
            "/api/v1/auth/logout",
            headers={"X-CSRF-Token": logout_csrf},
        )
        assert logout.status_code == 200

        me_after = await client.get(
            "/api/v1/auth/me",
            headers={"Authorization": f"Bearer {body['access_token']}"},
        )
        # access token may still be valid until expiry; refresh cookie cleared
        assert me_after.status_code in {200, 401}

        no_token = await client.get("/api/v1/auth/me")
        assert no_token.status_code == 401

    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_cors_credentials_for_configured_origin(
    memory_db: MemoryDatabase, monkeypatch: pytest.MonkeyPatch
) -> None:
    get_settings.cache_clear()
    monkeypatch.setenv("JWT_SECRET_KEY", "unit-test-secret-key-32-characters!!")
    get_settings.cache_clear()

    async def fake_connect(_settings: object) -> None:
        return None

    async def fake_close() -> None:
        return None

    async def fake_initialize(_settings: object) -> None:
        return None

    async def fake_ping() -> dict[str, object]:
        return {"connected": False, "status": "disconnected", "error": "test"}

    from app.db import mongodb as mongodb_module

    monkeypatch.setattr(mongodb_module, "connect_to_mongo", fake_connect)
    monkeypatch.setattr(mongodb_module, "close_mongo_connection", fake_close)
    monkeypatch.setattr(mongodb_module, "ping_mongo", fake_ping)
    monkeypatch.setattr("app.main.initialize_database", fake_initialize)

    app = create_application()
    app.dependency_overrides[get_database] = lambda: memory_db
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        ok = await client.options(
            "/api/v1/auth/login",
            headers={
                "Origin": "http://localhost:5173",
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "content-type,authorization,x-csrf-token",
            },
        )
        assert ok.status_code in {200, 204}
        assert ok.headers.get("access-control-allow-origin") == "http://localhost:5173"
        assert ok.headers.get("access-control-allow-credentials") == "true"

        bad = await client.options(
            "/api/v1/auth/login",
            headers={
                "Origin": "https://evil.example",
                "Access-Control-Request-Method": "POST",
            },
        )
        assert bad.headers.get("access-control-allow-origin") != "https://evil.example"

    app.dependency_overrides.clear()
