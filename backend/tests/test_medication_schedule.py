"""Timezone and medication schedule/adherence unit tests."""

from __future__ import annotations

from datetime import date, datetime, time
from zoneinfo import ZoneInfo

import pytest
from app.models.enums import (
    MedicationFrequency,
    MedicationLogStatus,
    MedicationStatus,
)
from app.models.medication import MedicationDocument, MedicationLogDocument
from app.models.object_id import new_object_id
from app.services.adherence_service import calculate_adherence
from app.services.medication_schedule_service import (
    generate_occurrences_for_medication,
    validate_date_range,
)
from app.utils.timezone import (
    combine_local_date_and_time,
    validate_timezone,
)


def test_validate_timezone_accepts_iana() -> None:
    assert validate_timezone("Asia/Colombo") == "Asia/Colombo"
    assert validate_timezone("UTC") == "UTC"


def test_validate_timezone_rejects_invalid() -> None:
    with pytest.raises(ValueError):
        validate_timezone("Not/AZone")


def test_local_to_utc_conversion() -> None:
    utc_dt = combine_local_date_and_time(date(2024, 6, 1), time(7, 0), "Asia/Colombo")
    assert utc_dt.tzinfo is not None
    assert utc_dt.astimezone(ZoneInfo("UTC")).hour in {1, 2}  # IST is UTC+5:30


def test_schedule_daily_multiple_reminders() -> None:
    med = MedicationDocument(
        user_id=new_object_id(),
        name="Levo",
        dosage_text="100 mcg",
        frequency=MedicationFrequency.TWICE_DAILY,
        reminder_times=[time(7, 0), time(19, 0)],
        start_date=date(2024, 1, 1),
        end_date=date(2024, 1, 2),
        status=MedicationStatus.ACTIVE,
        timezone="UTC",
    )
    occ = generate_occurrences_for_medication(med, date(2024, 1, 1), date(2024, 1, 2))
    assert len(occ) == 4


def test_schedule_respects_start_end_and_as_needed() -> None:
    med = MedicationDocument(
        user_id=new_object_id(),
        name="Levo",
        dosage_text="100 mcg",
        frequency=MedicationFrequency.ONCE_DAILY,
        reminder_times=[time(8, 0)],
        start_date=date(2024, 1, 10),
        end_date=date(2024, 1, 11),
        status=MedicationStatus.ACTIVE,
        timezone="UTC",
    )
    occ = generate_occurrences_for_medication(med, date(2024, 1, 1), date(2024, 1, 31))
    assert len(occ) == 2

    as_needed = MedicationDocument(
        user_id=new_object_id(),
        name="PRN",
        dosage_text="as needed",
        frequency=MedicationFrequency.AS_NEEDED,
        reminder_times=[],
        start_date=date(2024, 1, 1),
        status=MedicationStatus.ACTIVE,
        timezone="UTC",
    )
    assert generate_occurrences_for_medication(as_needed, date(2024, 1, 1), date(2024, 1, 7)) == []


def test_inactive_excluded() -> None:
    med = MedicationDocument(
        user_id=new_object_id(),
        name="Old",
        dosage_text="1 tab",
        frequency=MedicationFrequency.ONCE_DAILY,
        reminder_times=[time(8, 0)],
        start_date=date(2024, 1, 1),
        status=MedicationStatus.DISCONTINUED,
        timezone="UTC",
    )
    assert generate_occurrences_for_medication(med, date(2024, 1, 1), date(2024, 1, 3)) == []


def test_date_range_max() -> None:
    with pytest.raises(ValueError):
        validate_date_range(date(2024, 1, 1), date(2024, 3, 1))


def test_adherence_taken_missed_skipped_unlogged() -> None:
    uid = new_object_id()
    mid = new_object_id()
    med = MedicationDocument(
        id=mid,
        user_id=uid,
        name="Levo",
        dosage_text="100 mcg",
        frequency=MedicationFrequency.ONCE_DAILY,
        reminder_times=[time(8, 0)],
        start_date=date(2024, 1, 1),
        end_date=date(2024, 1, 4),
        status=MedicationStatus.ACTIVE,
        timezone="UTC",
    )
    day1 = datetime(2024, 1, 1, 8, 0, tzinfo=ZoneInfo("UTC"))
    day2 = datetime(2024, 1, 2, 8, 0, tzinfo=ZoneInfo("UTC"))
    day3 = datetime(2024, 1, 3, 8, 0, tzinfo=ZoneInfo("UTC"))
    # day4 unlogged
    logs = [
        MedicationLogDocument(
            user_id=uid,
            medication_id=mid,
            scheduled_for=day1,
            status=MedicationLogStatus.TAKEN,
        ),
        MedicationLogDocument(
            user_id=uid,
            medication_id=mid,
            scheduled_for=day2,
            status=MedicationLogStatus.MISSED,
        ),
        MedicationLogDocument(
            user_id=uid,
            medication_id=mid,
            scheduled_for=day3,
            status=MedicationLogStatus.SKIPPED,
        ),
    ]
    # Freeze "now" by using past dates only — schedule past filter uses utc_now
    # so use dates far in the past relative to today
    result = calculate_adherence([med], logs, date(2024, 1, 1), date(2024, 1, 4))
    assert result.taken_count == 1
    assert result.missed_count == 1
    assert result.skipped_count == 1
    assert result.unlogged_count == 1
    assert result.total_eligible == 3  # skip excluded
    assert result.adherence_percentage == pytest.approx(33.3)


def test_adherence_zero_eligible_null() -> None:
    result = calculate_adherence([], [], date(2024, 1, 1), date(2024, 1, 2))
    assert result.adherence_percentage is None
    assert result.total_eligible == 0
