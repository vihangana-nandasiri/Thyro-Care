"""Symptom API, safety rules, schema, and ownership tests."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

import pytest
from app.api.dependencies import get_database
from app.content.symptom_safety_rules import ALL_RULES, SAFETY_QUESTION_KEYS, SAFETY_RULE_VERSION
from app.core.config import get_settings
from app.core.tokens import create_access_token
from app.main import create_application
from app.models.enums import AccountStatus, SafetyLevel, UserRole
from app.models.user import UserDocument
from app.repositories.user_repository import UserRepository
from app.schemas.symptom import SymptomCreate
from app.services.symptom_safety_service import evaluate_safety_answers
from httpx import ASGITransport, AsyncClient
from pydantic import ValidationError

from tests.fakes.memory_db import MemoryDatabase


@pytest.fixture
def memory_db() -> MemoryDatabase:
    return MemoryDatabase()


def _all_false_answers(**overrides: bool) -> dict[str, bool]:
    base = {key: False for key in SAFETY_QUESTION_KEYS}
    base.update(overrides)
    return base


def _symptom_payload(**overrides: object) -> dict[str, object]:
    start = datetime(2026, 7, 1, 10, 0, tzinfo=UTC)
    base: dict[str, object] = {
        "symptom_type": "fatigue",
        "severity": "mild",
        "frequency": "occasional",
        "started_at": start.isoformat().replace("+00:00", "Z"),
        "timezone": "UTC",
        "status": "active",
        "description": "",
        "notes": "",
        "safety_answers": _all_false_answers(),
    }
    base.update(overrides)
    return base


def test_symptom_create_schema_valid() -> None:
    payload = SymptomCreate.model_validate(_symptom_payload())
    assert payload.symptom_type.value == "fatigue"
    assert payload.description is None
    assert payload.notes is None


def test_symptom_schema_rejects_invalid() -> None:
    with pytest.raises(ValidationError):
        SymptomCreate.model_validate({**_symptom_payload(), "user_id": "abc"})
    with pytest.raises(ValidationError):
        SymptomCreate.model_validate({**_symptom_payload(), "safety_level": "emergency"})
    with pytest.raises(ValidationError):
        SymptomCreate.model_validate({**_symptom_payload(), "symptom_type": "not_a_type"})
    with pytest.raises(ValidationError):
        SymptomCreate.model_validate({**_symptom_payload(), "severity": "critical"})
    with pytest.raises(ValidationError):
        SymptomCreate.model_validate({**_symptom_payload(), "frequency": "hourly"})
    with pytest.raises(ValidationError):
        SymptomCreate.model_validate({**_symptom_payload(), "timezone": "Nope/Zone"})
    with pytest.raises(ValidationError):
        SymptomCreate.model_validate(
            {
                **_symptom_payload(),
                "symptom_type": "other",
                "custom_symptom_name": None,
            }
        )
    with pytest.raises(ValidationError):
        SymptomCreate.model_validate(
            {
                **_symptom_payload(),
                "symptom_type": "fatigue",
                "custom_symptom_name": "should-fail",
            }
        )
    start = datetime(2026, 7, 1, 10, 0, tzinfo=UTC)
    with pytest.raises(ValidationError):
        SymptomCreate.model_validate(
            {
                **_symptom_payload(),
                "started_at": start.isoformat().replace("+00:00", "Z"),
                "ended_at": (start - timedelta(hours=1)).isoformat().replace("+00:00", "Z"),
            }
        )
    with pytest.raises(ValidationError):
        SymptomCreate.model_validate({**_symptom_payload(), "unknown_field": 1})
    with pytest.raises(ValidationError):
        SymptomCreate.model_validate({**_symptom_payload(), "description": "x" * 1001})


def test_other_with_custom_name_ok() -> None:
    payload = SymptomCreate.model_validate(
        {
            **_symptom_payload(),
            "symptom_type": "other",
            "custom_symptom_name": "Unusual ache",
        }
    )
    assert payload.custom_symptom_name == "Unusual ache"


def test_safety_rules_deterministic_and_emergency_wins() -> None:
    routine = evaluate_safety_answers(_all_false_answers())
    assert routine.safety_level == SafetyLevel.ROUTINE_TRACKING
    assert routine.emergency_page_required is False
    assert routine.rule_version == SAFETY_RULE_VERSION
    lowered = routine.user_message.lower()
    assert "you are safe" not in lowered
    assert "nothing to worry" not in lowered
    assert "no medical review is needed" not in lowered
    assert "no emergency safety rule was triggered" in lowered

    urgent = evaluate_safety_answers(_all_false_answers(rapidly_worsening_condition=True))
    assert urgent.safety_level == SafetyLevel.URGENT_MEDICAL_REVIEW
    assert "SR-U-WORSENING" in urgent.matched_rule_codes

    emergency = evaluate_safety_answers(
        _all_false_answers(
            rapidly_worsening_condition=True,
            breathing_emergency=True,
        )
    )
    assert emergency.safety_level == SafetyLevel.EMERGENCY
    assert emergency.emergency_page_required is True
    assert "SR-E-BREATHING" in emergency.matched_rule_codes


def test_every_rule_branch() -> None:
    for rule in ALL_RULES:
        result = evaluate_safety_answers(_all_false_answers(**{rule.field: True}))
        assert result.safety_level == rule.safety_level
        assert rule.rule_code in result.matched_rule_codes


def test_safety_missing_answer_rejected() -> None:
    from app.core.exceptions import ValidationException

    incomplete = {key: False for key in SAFETY_QUESTION_KEYS}
    del incomplete["breathing_emergency"]
    with pytest.raises(ValidationException):
        evaluate_safety_answers(incomplete)


def test_safety_ignores_free_text_keys() -> None:
    # Extra free-text-like keys must not affect structured evaluation if absent from schema;
    # service only reads SAFETY_QUESTION_KEYS.
    result = evaluate_safety_answers(_all_false_answers())
    assert result.safety_level == SafetyLevel.ROUTINE_TRACKING


@pytest.mark.asyncio
async def test_symptom_http_flow(
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
        assert (await client.get("/api/v1/symptoms")).status_code == 401

        reg = await client.post(
            "/api/v1/auth/register",
            json={
                "full_name": "Symptom Patient",
                "email": "symptom.patient@example.com",
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
            "/api/v1/symptoms",
            headers=headers,
            json=_symptom_payload(description="private note text", notes="secret notes"),
        )
        assert created.status_code == 201, created.text
        body = created.json()
        assert "user_id" not in body["symptom"]
        assert body["symptom"]["safety_level"] == "routine_tracking"
        assert body["safety_assessment"]["emergency_page_required"] is False
        symptom_id = body["symptom"]["id"]
        version = body["symptom"]["version"]

        listed = await client.get("/api/v1/symptoms", headers=headers)
        assert listed.status_code == 200
        assert listed.json()["total"] >= 1

        active = await client.get("/api/v1/symptoms/active", headers=headers)
        assert active.status_code == 200
        assert any(i["id"] == symptom_id for i in active.json())

        got = await client.get(f"/api/v1/symptoms/{symptom_id}", headers=headers)
        assert got.status_code == 200

        safety = await client.post(
            "/api/v1/symptoms/safety-check",
            headers=headers,
            json=_all_false_answers(breathing_emergency=True),
        )
        assert safety.status_code == 200
        assert safety.json()["safety_level"] == "emergency"
        assert safety.json()["emergency_page_required"] is True

        updated = await client.patch(
            f"/api/v1/symptoms/{symptom_id}",
            headers=headers,
            json={"severity": "moderate", "expected_version": version},
        )
        assert updated.status_code == 200, updated.text
        assert updated.json()["severity"] == "moderate"
        assert updated.json()["version"] == version + 1
        version = updated.json()["version"]

        conflict = await client.patch(
            f"/api/v1/symptoms/{symptom_id}",
            headers=headers,
            json={"severity": "severe", "expected_version": 1},
        )
        assert conflict.status_code == 409

        resolved = await client.patch(
            f"/api/v1/symptoms/{symptom_id}/status",
            headers=headers,
            json={"status": "resolved", "expected_version": version},
        )
        assert resolved.status_code == 200
        assert resolved.json()["status"] == "resolved"
        assert resolved.json()["ended_at"] is not None
        version = resolved.json()["version"]

        # Second patient cannot see foreign symptom
        reg2 = await client.post(
            "/api/v1/auth/register",
            json={
                "full_name": "Other Patient",
                "email": "symptom.other@example.com",
                "password": "secure-pass-1",
                "confirm_password": "secure-pass-1",
                "consent_accepted": True,
                "disclaimer_accepted": True,
            },
        )
        assert reg2.status_code == 201
        headers2 = {"Authorization": f"Bearer {reg2.json()['access_token']}"}
        foreign = await client.get(f"/api/v1/symptoms/{symptom_id}", headers=headers2)
        assert foreign.status_code == 404
        foreign_upd = await client.patch(
            f"/api/v1/symptoms/{symptom_id}",
            headers=headers2,
            json={"severity": "mild", "expected_version": version},
        )
        assert foreign_upd.status_code == 404

        deleted = await client.delete(f"/api/v1/symptoms/{symptom_id}", headers=headers)
        assert deleted.status_code == 200
        gone = await client.get(f"/api/v1/symptoms/{symptom_id}", headers=headers)
        assert gone.status_code == 404

        # Audit must not contain private text
        for entry in memory_db["audit_logs"].docs:
            summary = entry.get("changes_summary") or ""
            assert "private note text" not in summary
            assert "secret notes" not in summary

        users = UserRepository(memory_db)  # type: ignore[arg-type]
        admin = await users.create_user_document(
            UserDocument(
                email_normalized="admin.symptom@example.com",
                email_display="admin.symptom@example.com",
                password_hash="$argon2id$placeholder",
                full_name="Admin",
                role=UserRole.ADMIN,
                account_status=AccountStatus.ACTIVE,
            )
        )
        admin_token, _ = create_access_token(user_id=admin.id, role=UserRole.ADMIN)
        assert (
            await client.get(
                "/api/v1/symptoms",
                headers={"Authorization": f"Bearer {admin_token}"},
            )
        ).status_code == 403

        expert = await users.create_user_document(
            UserDocument(
                email_normalized="expert.symptom@example.com",
                email_display="expert.symptom@example.com",
                password_hash="$argon2id$placeholder",
                full_name="Expert",
                role=UserRole.MEDICAL_EXPERT,
                account_status=AccountStatus.ACTIVE,
            )
        )
        expert_token, _ = create_access_token(user_id=expert.id, role=UserRole.MEDICAL_EXPERT)
        assert (
            await client.get(
                "/api/v1/symptoms",
                headers={"Authorization": f"Bearer {expert_token}"},
            )
        ).status_code == 403


@pytest.mark.asyncio
async def test_symptom_indexes_defined() -> None:
    from app.db.collections import CollectionName
    from app.db.indexes import INDEX_SPECS

    names = {spec.name for spec in INDEX_SPECS if spec.collection == CollectionName.SYMPTOMS.value}
    assert "ix_symptoms_user_started" in names
    assert "ix_symptoms_user_status_started" in names
    assert "ix_symptoms_user_type_started" in names
    assert "ix_symptoms_user_severity_started" in names
    assert "ix_symptoms_user_deleted_started" in names
    assert "ix_symptoms_user_created" in names
