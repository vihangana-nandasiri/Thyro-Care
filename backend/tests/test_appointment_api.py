"""Appointment API, lifecycle, schema, and ownership tests."""

from __future__ import annotations

from datetime import UTC, date, datetime, timedelta

import pytest
from app.api.dependencies import get_database
from app.core.config import get_settings
from app.core.exceptions import ValidationException
from app.core.tokens import create_access_token
from app.main import create_application
from app.models.enums import AccountStatus, AppointmentStatus, UserRole
from app.models.user import UserDocument
from app.repositories.user_repository import UserRepository
from app.schemas.appointment import AppointmentCreate
from app.services.appointment_lifecycle_service import (
    apply_lifecycle_timestamps,
    assert_transition_allowed,
)
from app.utils.timezone import normalize_date_range, validate_timezone
from httpx import ASGITransport, AsyncClient
from pydantic import ValidationError

from tests.fakes.memory_db import MemoryDatabase


@pytest.fixture
def memory_db() -> MemoryDatabase:
    return MemoryDatabase()


def _appt_payload(**overrides: object) -> dict[str, object]:
    start = datetime(2026, 8, 1, 9, 0, tzinfo=UTC)
    base: dict[str, object] = {
        "appointment_type": "tsh_test",
        "title": "TSH blood test",
        "scheduled_start": start.isoformat().replace("+00:00", "Z"),
        "scheduled_end": (start + timedelta(hours=1)).isoformat().replace("+00:00", "Z"),
        "timezone": "UTC",
        "location": "Lab A",
        "location_type": "in_person",
        "provider_name": "Dr. Example",
        "notes": "",
        "status": "upcoming",
        "reminder_offsets_minutes": [60, 1440],
    }
    base.update(overrides)
    return base


def test_appointment_create_schema() -> None:
    appt = AppointmentCreate.model_validate(_appt_payload())
    assert appt.title == "TSH blood test"
    assert appt.notes is None
    assert appt.reminder_offsets_minutes == [60, 1440]


def test_appointment_schema_rejects_invalid() -> None:
    with pytest.raises(ValidationError):
        AppointmentCreate.model_validate({**_appt_payload(), "user_id": "abc"})
    with pytest.raises(ValidationError):
        AppointmentCreate.model_validate({**_appt_payload(), "title": ""})
    with pytest.raises(ValidationError):
        AppointmentCreate.model_validate({**_appt_payload(), "timezone": "Nope/Zone"})
    with pytest.raises(ValidationError):
        AppointmentCreate.model_validate({**_appt_payload(), "reminder_offsets_minutes": [-5]})
    with pytest.raises(ValidationError):
        AppointmentCreate.model_validate({**_appt_payload(), "reminder_offsets_minutes": [999999]})
    start = datetime(2026, 8, 1, 9, 0, tzinfo=UTC)
    with pytest.raises(ValidationError):
        AppointmentCreate.model_validate(
            {
                **_appt_payload(),
                "scheduled_start": start.isoformat().replace("+00:00", "Z"),
                "scheduled_end": (start - timedelta(hours=1)).isoformat().replace("+00:00", "Z"),
            }
        )


def test_lifecycle_transitions() -> None:
    assert_transition_allowed(AppointmentStatus.UPCOMING, AppointmentStatus.COMPLETED)
    assert_transition_allowed(AppointmentStatus.UPCOMING, AppointmentStatus.CANCELLED)
    assert_transition_allowed(AppointmentStatus.CANCELLED, AppointmentStatus.UPCOMING)
    with pytest.raises(ValidationException):
        assert_transition_allowed(AppointmentStatus.CANCELLED, AppointmentStatus.COMPLETED)

    completed_at, cancelled_at = apply_lifecycle_timestamps(
        previous_status=AppointmentStatus.UPCOMING,
        new_status=AppointmentStatus.COMPLETED,
        completed_at=None,
        cancelled_at=None,
    )
    assert completed_at is not None
    assert cancelled_at is None

    completed_at, cancelled_at = apply_lifecycle_timestamps(
        previous_status=AppointmentStatus.COMPLETED,
        new_status=AppointmentStatus.UPCOMING,
        completed_at=completed_at,
        cancelled_at=None,
    )
    assert completed_at is None
    assert cancelled_at is None


def test_timezone_and_range_helpers() -> None:
    assert validate_timezone("Asia/Colombo") == "Asia/Colombo"
    with pytest.raises(ValueError):
        validate_timezone("Not/AZone")
    normalize_date_range(date(2026, 1, 1), date(2026, 1, 31))
    with pytest.raises(ValueError):
        normalize_date_range(date(2026, 1, 1), date(2026, 4, 1))


@pytest.mark.asyncio
async def test_appointment_http_flow(
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
        assert (await client.get("/api/v1/appointments")).status_code == 401

        reg = await client.post(
            "/api/v1/auth/register",
            json={
                "full_name": "Appt Patient",
                "email": "appt.patient@example.com",
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
            "/api/v1/appointments",
            headers=headers,
            json=_appt_payload(),
        )
        assert created.status_code == 201, created.text
        body = created.json()
        assert body["title"] == "TSH blood test"
        assert "user_id" not in body
        appt_id = body["id"]
        version = body["version"]

        listed = await client.get("/api/v1/appointments", headers=headers)
        assert listed.status_code == 200
        assert listed.json()["total"] >= 1

        got = await client.get(f"/api/v1/appointments/{appt_id}", headers=headers)
        assert got.status_code == 200

        upcoming = await client.get("/api/v1/appointments/upcoming", headers=headers)
        assert upcoming.status_code == 200

        calendar = await client.get(
            "/api/v1/appointments/calendar",
            headers=headers,
            params={"date_from": "2026-08-01", "date_to": "2026-08-31"},
        )
        assert calendar.status_code == 200
        assert len(calendar.json()) >= 1

        patched = await client.patch(
            f"/api/v1/appointments/{appt_id}",
            headers=headers,
            json={"title": "TSH follow-up", "expected_version": version},
        )
        assert patched.status_code == 200
        assert patched.json()["version"] == version + 1
        version = patched.json()["version"]

        conflict = await client.patch(
            f"/api/v1/appointments/{appt_id}",
            headers=headers,
            json={"title": "Stale", "expected_version": 1},
        )
        assert conflict.status_code == 409

        status_res = await client.patch(
            f"/api/v1/appointments/{appt_id}/status",
            headers=headers,
            json={"status": "completed", "expected_version": version},
        )
        assert status_res.status_code == 200
        assert status_res.json()["status"] == "completed"
        assert status_res.json()["completed_at"] is not None
        version = status_res.json()["version"]

        bad_transition = await client.patch(
            f"/api/v1/appointments/{appt_id}/status",
            headers=headers,
            json={"status": "cancelled", "expected_version": version},
        )
        assert bad_transition.status_code == 422

        deleted = await client.delete(f"/api/v1/appointments/{appt_id}", headers=headers)
        assert deleted.status_code == 200
        assert (
            await client.get(f"/api/v1/appointments/{appt_id}", headers=headers)
        ).status_code == 404

        other = await client.post(
            "/api/v1/auth/register",
            json={
                "full_name": "Other Patient",
                "email": "appt.other@example.com",
                "password": "secure-pass-1",
                "confirm_password": "secure-pass-1",
                "consent_accepted": True,
                "disclaimer_accepted": True,
            },
        )
        assert other.status_code == 201, other.text
        other_headers = {"Authorization": f"Bearer {other.json()['access_token']}"}
        mine = await client.post(
            "/api/v1/appointments",
            headers=headers,
            json=_appt_payload(title="Mine"),
        )
        assert mine.status_code == 201, mine.text
        mine_id = mine.json()["id"]
        assert (
            await client.get(f"/api/v1/appointments/{mine_id}", headers=other_headers)
        ).status_code == 404

        users = UserRepository(memory_db)  # type: ignore[arg-type]
        admin = await users.create_user_document(
            UserDocument(
                email_normalized="admin.appt@example.com",
                email_display="admin.appt@example.com",
                password_hash="$argon2id$placeholder",
                full_name="Admin",
                role=UserRole.ADMIN,
                account_status=AccountStatus.ACTIVE,
            )
        )
        admin_token, _ = create_access_token(user_id=admin.id, role=UserRole.ADMIN)
        denied = await client.get(
            "/api/v1/appointments",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert denied.status_code == 403

        updates = [
            a for a in memory_db["audit_logs"].docs if a.get("action") == "APPOINTMENT_UPDATED"
        ]
        assert updates
        assert "title" in updates[-1]["changes_summary"]
        assert "TSH follow-up" not in updates[-1]["changes_summary"]
        assert "TSH blood test" not in updates[-1]["changes_summary"]

    app.dependency_overrides.clear()
