"""Domain model validation unit tests."""

from __future__ import annotations

from datetime import UTC, datetime, time, timedelta

import pytest
from app.models.appointment import AppointmentDocument
from app.models.chat import CHAT_CONTENT_MAX_LENGTH, ChatMessageDocument
from app.models.enums import (
    AppointmentType,
    ChatMessageRole,
    KnowledgeStatus,
    MedicationLogStatus,
    SymptomGuidanceLevel,
)
from app.models.medication import MedicationDocument
from app.models.symptom_log import FREE_TEXT_MAX_LENGTH, SymptomLogDocument
from app.models.user import UserDocument, normalize_email
from app.schemas.user import UserPublic
from app.utils.datetime import utc_now
from bson import ObjectId
from pydantic import ValidationError


def test_utc_timestamp_generation() -> None:
    now = utc_now()
    assert now.tzinfo is not None
    assert now.utcoffset() == timedelta(0)


def test_user_password_hash_excluded_from_public_schema() -> None:
    user = UserDocument(
        email_normalized="Person@Example.com",
        email_display="Person@Example.com",
        password_hash="hashed-value-not-for-public",
        full_name="Test User",
    )
    public = UserPublic(
        id=str(user.id),
        email_display=user.email_display,
        full_name=user.full_name,
        role=user.role,
        account_status=user.account_status,
        email_verified=user.email_verified,
        created_at=user.created_at,
        updated_at=user.updated_at,
        is_deleted=user.is_deleted,
    )
    dumped = public.model_dump()
    assert "password_hash" not in dumped
    assert "password_hash" not in UserPublic.model_fields


def test_email_normalization() -> None:
    assert normalize_email("  Person@Example.COM ") == "person@example.com"
    user = UserDocument(
        email_normalized="  Person@Example.COM ",
        email_display="Person@Example.COM",
        password_hash="x",
        full_name="A",
    )
    assert user.email_normalized == "person@example.com"


def test_appointment_end_before_start_validation() -> None:
    start = datetime(2026, 1, 1, 10, 0, tzinfo=UTC)
    with pytest.raises(ValidationError):
        AppointmentDocument(
            user_id=ObjectId(),
            appointment_type=AppointmentType.TSH_TEST,
            title="Lab",
            scheduled_start=start,
            scheduled_end=start,
        )


def test_medication_reminder_time_validation() -> None:
    with pytest.raises(ValidationError):
        MedicationDocument(
            user_id=ObjectId(),
            name="Levothyroxine",
            dosage_text="50 mcg",
            frequency="daily",
            reminder_times=[time(8, 0), time(8, 0)],
        )


def test_symptom_free_text_length_validation() -> None:
    with pytest.raises(ValidationError):
        SymptomLogDocument(
            user_id=ObjectId(),
            guidance_level=SymptomGuidanceLevel.SELF_CARE,
            free_text_summary="x" * (FREE_TEXT_MAX_LENGTH + 1),
        )


def test_chat_content_length_validation() -> None:
    with pytest.raises(ValidationError):
        ChatMessageDocument(
            session_id=ObjectId(),
            user_id=ObjectId(),
            role=ChatMessageRole.USER,
            content="x" * (CHAT_CONTENT_MAX_LENGTH + 1),
        )


def test_knowledge_status_serialization() -> None:
    assert KnowledgeStatus.APPROVED.value == "approved"
    assert MedicationLogStatus.TAKEN.value == "taken"
