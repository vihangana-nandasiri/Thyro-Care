"""Medication API and ownership tests."""

from __future__ import annotations

from datetime import date, timedelta

import pytest
from app.api.dependencies import get_database
from app.core.config import get_settings
from app.core.tokens import create_access_token
from app.main import create_application
from app.models.enums import AccountStatus, UserRole
from app.models.user import UserDocument
from app.repositories.user_repository import UserRepository
from app.schemas.medication import MedicationCreate
from httpx import ASGITransport, AsyncClient
from pydantic import ValidationError

from tests.fakes.memory_db import MemoryDatabase


@pytest.fixture
def memory_db() -> MemoryDatabase:
    return MemoryDatabase()


def _med_payload(**overrides: object) -> dict[str, object]:
    base: dict[str, object] = {
        "name": "Levothyroxine",
        "dosage_text": "100 mcg",
        "frequency": "once_daily",
        "reminder_times": ["07:00"],
        "instructions": "Before breakfast",
        "start_date": "2024-01-01",
        "end_date": None,
        "status": "active",
        "prescribed_by_text": "Dr. Example",
        "notes": "",
        "timezone": "UTC",
    }
    base.update(overrides)
    return base


@pytest.mark.asyncio
async def test_medication_create_schema() -> None:
    med = MedicationCreate.model_validate(_med_payload())
    assert med.name == "Levothyroxine"
    assert med.notes is None


@pytest.mark.asyncio
async def test_medication_schema_rejects_protected() -> None:
    with pytest.raises(ValidationError):
        MedicationCreate.model_validate({**_med_payload(), "user_id": "abc"})
    with pytest.raises(ValidationError):
        MedicationCreate.model_validate({**_med_payload(), "timezone": "Nope/Zone"})
    with pytest.raises(ValidationError):
        MedicationCreate.model_validate(
            {**_med_payload(), "end_date": "2023-01-01", "start_date": "2024-01-01"}
        )
    with pytest.raises(ValidationError):
        MedicationCreate.model_validate({**_med_payload(), "reminder_times": ["25:99"]})


@pytest.mark.asyncio
async def test_medication_http_flow(
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
        assert (await client.get("/api/v1/medications")).status_code == 401

        reg = await client.post(
            "/api/v1/auth/register",
            json={
                "full_name": "Med Patient",
                "email": "med.patient@example.com",
                "password": "secure-pass-1",
                "confirm_password": "secure-pass-1",
                "consent_accepted": True,
                "disclaimer_accepted": True,
            },
        )
        assert reg.status_code == 201, reg.text
        token = reg.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        created = await client.post(
            "/api/v1/medications",
            headers=headers,
            json=_med_payload(start_date=str(date.today() - timedelta(days=2))),
        )
        assert created.status_code == 201, created.text
        med = created.json()
        assert med["name"] == "Levothyroxine"
        assert "user_id" not in med
        assert med["version"] == 1
        med_id = med["id"]

        listed = await client.get("/api/v1/medications", headers=headers)
        assert listed.status_code == 200
        assert listed.json()["total"] == 1

        got = await client.get(f"/api/v1/medications/{med_id}", headers=headers)
        assert got.status_code == 200

        patched = await client.patch(
            f"/api/v1/medications/{med_id}",
            headers=headers,
            json={"expected_version": 1, "dosage_text": "112 mcg"},
        )
        assert patched.status_code == 200
        assert patched.json()["version"] == 2
        assert patched.json()["dosage_text"] == "112 mcg"

        conflict = await client.patch(
            f"/api/v1/medications/{med_id}",
            headers=headers,
            json={"expected_version": 1, "dosage_text": "125 mcg"},
        )
        assert conflict.status_code == 409

        today = date.today()
        sched = await client.get(
            "/api/v1/medications/schedule",
            headers=headers,
            params={"date_from": str(today - timedelta(days=2)), "date_to": str(today)},
        )
        assert sched.status_code == 200, sched.text
        items = sched.json()
        assert len(items) >= 1

        scheduled_for = items[0]["scheduled_for"]
        log = await client.post(
            f"/api/v1/medications/{med_id}/logs",
            headers=headers,
            json={"scheduled_for": scheduled_for, "status": "taken", "note": ""},
        )
        assert log.status_code == 201, log.text
        assert log.json()["status"] == "taken"
        assert "dosage" not in str(memory_db["audit_logs"].docs[-1].get("changes_summary", ""))

        dup = await client.post(
            f"/api/v1/medications/{med_id}/logs",
            headers=headers,
            json={"scheduled_for": scheduled_for, "status": "missed"},
        )
        assert dup.status_code == 409

        adh = await client.get(
            "/api/v1/medications/adherence",
            headers=headers,
            params={"date_from": str(today - timedelta(days=2)), "date_to": str(today)},
        )
        assert adh.status_code == 200
        body = adh.json()
        assert "adherence_percentage" in body
        assert body["taken_count"] >= 1

        deleted = await client.delete(f"/api/v1/medications/{med_id}", headers=headers)
        assert deleted.status_code == 200
        assert (
            await client.get(f"/api/v1/medications/{med_id}", headers=headers)
        ).status_code == 404

        # Admin denied
        users = UserRepository(memory_db)  # type: ignore[arg-type]
        admin = await users.create_user_document(
            UserDocument(
                email_normalized="admin.med@example.com",
                email_display="admin.med@example.com",
                password_hash="$argon2id$placeholder",
                full_name="Admin",
                role=UserRole.ADMIN,
                account_status=AccountStatus.ACTIVE,
            )
        )
        admin_token, _ = create_access_token(user_id=admin.id, role=UserRole.ADMIN)
        denied = await client.get(
            "/api/v1/medications",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert denied.status_code == 403

        # Audit field names only for update
        updates = [
            a for a in memory_db["audit_logs"].docs if a.get("action") == "MEDICATION_UPDATED"
        ]
        assert updates
        assert "dosage_text" in updates[-1]["changes_summary"]
        assert "112 mcg" not in updates[-1]["changes_summary"]
        assert "Levothyroxine" not in updates[-1]["changes_summary"]

    app.dependency_overrides.clear()
