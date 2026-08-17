"""Patient profile schema, service, repository, and API tests."""

from __future__ import annotations

from datetime import timedelta

import pytest
from app.api.dependencies import get_database
from app.core.config import get_settings
from app.core.tokens import create_access_token
from app.main import create_application
from app.models.enums import (
    AccountStatus,
    AgeRange,
    PreferredLanguage,
    TreatmentStage,
    UserRole,
)
from app.models.object_id import new_object_id
from app.models.patient_profile import PatientProfileDocument
from app.models.user import UserDocument
from app.repositories.exceptions import RepositoryConflictError
from app.repositories.patient_profile_repository import PatientProfileRepository
from app.repositories.user_repository import UserRepository
from app.schemas.patient_profile import PatientProfileUpdate
from app.services.auth_service import AuthService
from app.services.profile_service import ProfileService
from app.utils.datetime import utc_now
from httpx import ASGITransport, AsyncClient
from pydantic import ValidationError

from tests.fakes.memory_db import MemoryDatabase


@pytest.fixture
def memory_db() -> MemoryDatabase:
    return MemoryDatabase()


def _register_payload_json(email: str = "profile.patient@example.com") -> dict[str, object]:
    return {
        "full_name": "Profile Patient",
        "email": email,
        "password": "secure-pass-1",
        "confirm_password": "secure-pass-1",
        "consent_accepted": True,
        "disclaimer_accepted": True,
    }


@pytest.mark.asyncio
async def test_profile_update_schema_valid_partial() -> None:
    payload = PatientProfileUpdate(
        expected_version=1,
        age_range=AgeRange.AGE_30_39,
        emergency_contact_phone="+1 (555) 111-2222",
        current_medication_summary="",
    )
    data = payload.editable_payload()
    assert data["age_range"] == AgeRange.AGE_30_39
    assert data["emergency_contact_phone"] == "+15551112222"
    assert data["current_medication_summary"] is None


@pytest.mark.asyncio
async def test_profile_update_rejects_unknown_and_protected() -> None:
    with pytest.raises(ValidationError):
        PatientProfileUpdate(expected_version=1, user_id="abc")  # type: ignore[call-arg]
    with pytest.raises(ValidationError):
        PatientProfileUpdate(expected_version=1, role="admin")  # type: ignore[call-arg]
    with pytest.raises(ValidationError):
        PatientProfileUpdate(expected_version=1, account_status="active")  # type: ignore[call-arg]
    with pytest.raises(ValidationError):
        PatientProfileUpdate(expected_version=1, email="x@y.com")  # type: ignore[call-arg]
    with pytest.raises(ValidationError):
        PatientProfileUpdate(expected_version=1, consent_accepted=False)  # type: ignore[call-arg]
    with pytest.raises(ValidationError):
        PatientProfileUpdate(expected_version=1, disclaimer_accepted=False)  # type: ignore[call-arg]


@pytest.mark.asyncio
async def test_profile_update_rejects_invalid_enum_and_future_date() -> None:
    with pytest.raises(ValidationError):
        PatientProfileUpdate(expected_version=1, age_range="not-an-age")  # type: ignore[arg-type]
    with pytest.raises(ValidationError):
        PatientProfileUpdate(
            expected_version=1,
            surgery_date=utc_now().date() + timedelta(days=400),
        )
    with pytest.raises(ValidationError):
        PatientProfileUpdate(expected_version=1, emergency_contact_phone="abc-letters")
    with pytest.raises(ValidationError):
        PatientProfileUpdate(
            expected_version=1,
            current_medication_summary="x" * 501,
        )


@pytest.mark.asyncio
async def test_repository_update_preserves_consent_and_increments_version(
    memory_db: MemoryDatabase,
) -> None:
    users = UserRepository(memory_db)  # type: ignore[arg-type]
    profiles = PatientProfileRepository(memory_db)  # type: ignore[arg-type]
    user = await users.create_user_document(
        UserDocument(
            email_normalized="repo@example.com",
            email_display="repo@example.com",
            password_hash="$argon2id$placeholder",
            full_name="Repo User",
            role=UserRole.PATIENT,
            account_status=AccountStatus.ACTIVE,
        )
    )
    now = utc_now()
    created = await profiles.create_profile_document(
        PatientProfileDocument(
            user_id=user.id,
            consent_accepted=True,
            consent_accepted_at=now,
            disclaimer_accepted=True,
            disclaimer_accepted_at=now,
        )
    )
    assert created.version == 1
    updated = await profiles.update_for_user(
        user.id,
        {"preferred_language": PreferredLanguage.SINHALA},
        expected_version=1,
    )
    assert updated.version == 2
    assert updated.preferred_language == PreferredLanguage.SINHALA
    assert updated.consent_accepted is True
    assert updated.consent_accepted_at == now
    assert updated.updated_at >= created.updated_at

    with pytest.raises(RepositoryConflictError):
        await profiles.update_for_user(
            user.id,
            {"treatment_stage": TreatmentStage.FOLLOW_UP},
            expected_version=1,
        )


@pytest.mark.asyncio
async def test_deleted_profile_excluded(memory_db: MemoryDatabase) -> None:
    profiles = PatientProfileRepository(memory_db)  # type: ignore[arg-type]
    uid = new_object_id()
    doc = await profiles.create_profile_document(PatientProfileDocument(user_id=uid))
    await profiles.soft_delete(doc.id)
    assert await profiles.get_by_user_id(uid) is None


@pytest.mark.asyncio
async def test_profile_http_flow(
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
        unauth = await client.get("/api/v1/profiles/me")
        assert unauth.status_code == 401

        reg = await client.post("/api/v1/auth/register", json=_register_payload_json())
        assert reg.status_code == 201, reg.text
        token = reg.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        me = await client.get("/api/v1/profiles/me", headers=headers)
        assert me.status_code == 200, me.text
        body = me.json()
        assert body["account"]["email"] == "profile.patient@example.com"
        assert body["account"]["role"] == "patient"
        assert "password_hash" not in body["account"]
        assert body["profile"]["consent_accepted"] is True
        assert body["profile"]["profile_completion_percentage"] == 0
        assert body["profile"]["version"] == 1
        consent_at = body["profile"]["consent_accepted_at"]

        patch = await client.patch(
            "/api/v1/profiles/me",
            headers=headers,
            json={
                "expected_version": 1,
                "age_range": "age_30_39",
                "preferred_language": "english",
                "surgery_date": "2024-09-15",
                "rai_treatment_status": "completed",
                "treatment_stage": "follow_up",
                "emergency_contact_name": "Alex Helper",
                "emergency_contact_phone": "+1 (555) 999-8888",
                "current_medication_summary": "As prescribed by clinician",
            },
        )
        assert patch.status_code == 200, patch.text
        updated = patch.json()
        assert updated["profile"]["version"] == 2
        assert updated["profile"]["profile_completion_percentage"] == 100
        assert updated["profile"]["consent_accepted_at"] == consent_at
        assert updated["profile"]["emergency_contact_phone"] == "+15559998888"

        conflict = await client.patch(
            "/api/v1/profiles/me",
            headers=headers,
            json={"expected_version": 1, "age_range": "age_40_49"},
        )
        assert conflict.status_code == 409

        # ADMIN denied
        admin = UserDocument(
            email_normalized="admin@example.com",
            email_display="admin@example.com",
            password_hash="$argon2id$placeholder",
            full_name="Admin User",
            role=UserRole.ADMIN,
            account_status=AccountStatus.ACTIVE,
        )
        users = UserRepository(memory_db)  # type: ignore[arg-type]
        admin = await users.create_user_document(admin)
        admin_token, _ = create_access_token(user_id=admin.id, role=UserRole.ADMIN)
        admin_get = await client.get(
            "/api/v1/profiles/me",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert admin_get.status_code == 403

        expert = UserDocument(
            email_normalized="expert@example.com",
            email_display="expert@example.com",
            password_hash="$argon2id$placeholder",
            full_name="Expert User",
            role=UserRole.MEDICAL_EXPERT,
            account_status=AccountStatus.ACTIVE,
        )
        expert = await users.create_user_document(expert)
        expert_token, _ = create_access_token(user_id=expert.id, role=UserRole.MEDICAL_EXPERT)
        expert_get = await client.get(
            "/api/v1/profiles/me",
            headers={"Authorization": f"Bearer {expert_token}"},
        )
        assert expert_get.status_code == 403

        # Audit stores field names only
        audits = memory_db["audit_logs"].docs
        profile_audits = [a for a in audits if a.get("action") == "PROFILE_UPDATED"]
        assert profile_audits
        summary = profile_audits[-1]["changes_summary"]
        assert "age_range" in summary
        assert "Alex Helper" not in summary
        assert "As prescribed" not in summary
        assert "+15559998888" not in summary

    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_profile_service_audit_field_names_only(memory_db: MemoryDatabase) -> None:
    auth = AuthService(memory_db)  # type: ignore[arg-type]
    from app.schemas.auth import RegisterRequest

    session = await auth.register(
        RegisterRequest(
            full_name="Audit Patient",
            email="audit.profile@example.com",  # type: ignore[arg-type]
            password="secure-pass-1",
            confirm_password="secure-pass-1",
            consent_accepted=True,
            disclaimer_accepted=True,
        )
    )
    service = ProfileService(memory_db)  # type: ignore[arg-type]
    users = UserRepository(memory_db)  # type: ignore[arg-type]
    user = await users.get_by_id(session.response.user.id)
    assert user is not None
    await service.update_my_profile(
        user,
        PatientProfileUpdate(
            expected_version=1,
            emergency_contact_name="Secret Name",
            emergency_contact_phone="5551234567",
        ),
    )
    summary = memory_db["audit_logs"].docs[-1]["changes_summary"]
    assert "emergency_contact_name" in summary
    assert "Secret Name" not in summary
    assert "5551234567" not in summary
