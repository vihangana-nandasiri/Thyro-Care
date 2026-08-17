"""Privileged user CLI provisioning — security and policy tests."""

from __future__ import annotations

import pytest
from app.api.dependencies import get_database
from app.core.config import get_settings
from app.core.exceptions import ConflictException, ValidationException
from app.core.passwords import verify_password
from app.core.tokens import create_access_token
from app.main import create_application
from app.models.enums import AccountStatus, UserRole
from app.models.user import UserDocument
from app.repositories.user_repository import UserRepository
from app.schemas.auth import RegisterRequest
from app.services.auth_service import AuthService
from app.services.privileged_user_service import PrivilegedUserService
from httpx import ASGITransport, AsyncClient

from tests.fakes.memory_db import MemoryDatabase


@pytest.fixture
def memory_db() -> MemoryDatabase:
    return MemoryDatabase()


@pytest.fixture
def privileged_service(memory_db: MemoryDatabase) -> PrivilegedUserService:
    get_settings.cache_clear()
    return PrivilegedUserService(memory_db)  # type: ignore[arg-type]


@pytest.mark.asyncio
async def test_only_admin_and_medical_expert_roles_accepted(
    privileged_service: PrivilegedUserService,
) -> None:
    admin = await privileged_service.create_privileged_user(
        role="admin",
        full_name="Temp Admin",
        email="temp.admin@example.com",
        password="strong-pass-1",
        confirm_password="strong-pass-1",
    )
    assert admin.role == UserRole.ADMIN
    assert admin.account_status == AccountStatus.ACTIVE
    assert admin.email_verified is True

    expert = await privileged_service.create_privileged_user(
        role="medical_expert",
        full_name="Temp Expert",
        email="temp.expert@example.com",
        password="strong-pass-1",
        confirm_password="strong-pass-1",
    )
    assert expert.role == UserRole.MEDICAL_EXPERT


@pytest.mark.asyncio
async def test_patient_role_rejected_by_privileged_cli(
    privileged_service: PrivilegedUserService,
) -> None:
    with pytest.raises(ValidationException, match="rejects patient"):
        await privileged_service.create_privileged_user(
            role="patient",
            full_name="Should Fail",
            email="patient.via.cli@example.com",
            password="strong-pass-1",
            confirm_password="strong-pass-1",
        )


@pytest.mark.asyncio
async def test_weak_password_rejected(privileged_service: PrivilegedUserService) -> None:
    with pytest.raises(ValidationException):
        await privileged_service.create_privileged_user(
            role=UserRole.ADMIN,
            full_name="Weak Password Admin",
            email="weak.admin@example.com",
            password="short",
            confirm_password="short",
        )


@pytest.mark.asyncio
async def test_password_is_hashed_and_plain_not_persisted(
    privileged_service: PrivilegedUserService,
    memory_db: MemoryDatabase,
) -> None:
    plain = "strong-pass-1"
    await privileged_service.create_privileged_user(
        role=UserRole.ADMIN,
        full_name="Hash Check Admin",
        email="hash.admin@example.com",
        password=plain,
        confirm_password=plain,
    )
    users = UserRepository(memory_db)  # type: ignore[arg-type]
    stored = await users.get_by_email_normalized("hash.admin@example.com")
    assert stored is not None
    assert stored.password_hash != plain
    assert plain not in stored.password_hash
    assert verify_password(plain, stored.password_hash) is True


@pytest.mark.asyncio
async def test_duplicate_email_rejected(
    privileged_service: PrivilegedUserService,
) -> None:
    await privileged_service.create_privileged_user(
        role=UserRole.ADMIN,
        full_name="First Admin",
        email="dup.admin@example.com",
        password="strong-pass-1",
        confirm_password="strong-pass-1",
    )
    with pytest.raises(ConflictException, match="already exists"):
        await privileged_service.create_privileged_user(
            role=UserRole.MEDICAL_EXPERT,
            full_name="Second Attempt",
            email="Dup.Admin@example.com",
            password="strong-pass-1",
            confirm_password="strong-pass-1",
        )


@pytest.mark.asyncio
async def test_existing_user_role_not_silently_changed(
    privileged_service: PrivilegedUserService,
    memory_db: MemoryDatabase,
) -> None:
    users = UserRepository(memory_db)  # type: ignore[arg-type]
    await users.create_user_document(
        UserDocument(
            email_normalized="patient.keep@example.com",
            email_display="patient.keep@example.com",
            password_hash="$argon2id$placeholder",
            full_name="Existing Patient",
            role=UserRole.PATIENT,
            account_status=AccountStatus.ACTIVE,
            email_verified=True,
        )
    )
    with pytest.raises(ConflictException):
        await privileged_service.create_privileged_user(
            role=UserRole.ADMIN,
            full_name="Promote Attempt",
            email="patient.keep@example.com",
            password="strong-pass-1",
            confirm_password="strong-pass-1",
        )
    kept = await users.get_by_email_normalized("patient.keep@example.com")
    assert kept is not None
    assert kept.role == UserRole.PATIENT


@pytest.mark.asyncio
async def test_no_public_endpoint_creates_privileged_users(
    memory_db: MemoryDatabase,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    get_settings.cache_clear()
    monkeypatch.setenv("AUTHENTICATION_ENABLED", "true")
    monkeypatch.setenv("COOKIE_SECURE", "false")
    monkeypatch.setenv("RATE_LIMIT_ENABLED", "false")
    get_settings.cache_clear()

    app = create_application()
    app.dependency_overrides[get_database] = lambda: memory_db
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post(
            "/api/v1/auth/register",
            json={
                "full_name": "Public Role Attempt",
                "email": "public.role@example.com",
                "password": "strong-pass-1",
                "confirm_password": "strong-pass-1",
                "consent_accepted": True,
                "disclaimer_accepted": True,
                "role": "admin",
            },
        )
        assert response.status_code == 422

        ok = await client.post(
            "/api/v1/auth/register",
            json={
                "full_name": "Public Patient",
                "email": "public.patient@example.com",
                "password": "strong-pass-1",
                "confirm_password": "strong-pass-1",
                "consent_accepted": True,
                "disclaimer_accepted": True,
            },
        )
        assert ok.status_code == 201
        assert ok.json()["user"]["role"] == "patient"

    app.dependency_overrides.clear()
    get_settings.cache_clear()


@pytest.mark.asyncio
async def test_public_registration_still_creates_patient_only(
    memory_db: MemoryDatabase,
) -> None:
    get_settings.cache_clear()
    auth = AuthService(memory_db)  # type: ignore[arg-type]
    session = await auth.register(
        RegisterRequest(
            full_name="Normal Patient",
            email="normal.patient@example.com",  # type: ignore[arg-type]
            password="strong-pass-1",
            confirm_password="strong-pass-1",
            consent_accepted=True,
            disclaimer_accepted=True,
        )
    )
    assert session.response.user.role == UserRole.PATIENT


@pytest.mark.asyncio
async def test_password_mismatch_rejected(privileged_service: PrivilegedUserService) -> None:
    with pytest.raises(ValidationException, match="do not match"):
        await privileged_service.create_privileged_user(
            role=UserRole.ADMIN,
            full_name="Mismatch Admin",
            email="mismatch.admin@example.com",
            password="strong-pass-1",
            confirm_password="strong-pass-2",
        )


def _setup_app_env(monkeypatch: pytest.MonkeyPatch) -> None:
    get_settings.cache_clear()
    monkeypatch.setenv("AUTHENTICATION_ENABLED", "true")
    monkeypatch.setenv("COOKIE_SECURE", "false")
    monkeypatch.setenv("RATE_LIMIT_ENABLED", "false")
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


@pytest.mark.asyncio
async def test_admin_approve_still_denied_via_api(
    memory_db: MemoryDatabase,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Regression: ADMIN must not approve even when provisioned."""
    _setup_app_env(monkeypatch)

    service = PrivilegedUserService(memory_db)  # type: ignore[arg-type]
    created = await service.create_privileged_user(
        role=UserRole.ADMIN,
        full_name="Approve Deny Admin",
        email="approve.deny.admin@example.com",
        password="strong-pass-1",
        confirm_password="strong-pass-1",
    )
    token, _ = create_access_token(user_id=created.user_id, role=UserRole.ADMIN)

    app = create_application()
    app.dependency_overrides[get_database] = lambda: memory_db
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        headers = {"Authorization": f"Bearer {token}"}
        draft = await client.post(
            "/api/v1/governance/knowledge",
            headers=headers,
            json={
                "slug": "synthetic-workflow-only",
                "title": "Synthetic Workflow Document",
                "source_name": "Internal Test",
                "source_url": "https://example.org/synthetic",
                "topic": "thyroidectomy_recovery",
                "language": "english",
                "body": "Synthetic non-medical workflow verification content only.",
                "medical_disclaimer": "Educational only.",
            },
        )
        assert draft.status_code == 201, draft.text
        detail = draft.json()
        document_id = detail["document"]["document_id"]
        version_id = detail["current_version"]["version_id"]
        version_number = detail["current_version"]["version"]
        submitted = await client.post(
            f"/api/v1/governance/knowledge/{document_id}/versions/{version_id}/submit",
            headers=headers,
            json={"expected_version": version_number},
        )
        assert submitted.status_code == 200, submitted.text
        content_hash = submitted.json()["current_version"]["content_hash"]
        deny = await client.post(
            f"/api/v1/governance/review-queue/{document_id}/{version_id}/decision",
            headers=headers,
            json={
                "decision": "approve",
                "expected_content_hash": content_hash,
                "comments": "Admin must not approve",
            },
        )
        assert deny.status_code == 403

    app.dependency_overrides.clear()
    get_settings.cache_clear()
