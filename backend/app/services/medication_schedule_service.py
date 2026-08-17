"""Generate expected medication schedule occurrences (read-only)."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, timedelta

from app.models.enums import MedicationFrequency, MedicationLogStatus, MedicationStatus
from app.models.medication import MedicationDocument, MedicationLogDocument
from app.models.object_id import object_id_to_string
from app.utils.timezone import (
    combine_local_date_and_time,
    ensure_utc,
    utc_datetime_to_local,
    utc_now_aware,
)

MAX_SCHEDULE_DAYS = 31


@dataclass(frozen=True, slots=True)
class ScheduleOccurrence:
    medication_id: str
    medication_name: str
    dosage_text: str
    scheduled_for: datetime
    scheduled_local_time: str
    timezone: str
    log_status: MedicationLogStatus | None = None
    log_id: str | None = None


def _daterange(start: date, end: date) -> list[date]:
    days: list[date] = []
    cur = start
    while cur <= end:
        days.append(cur)
        cur += timedelta(days=1)
    return days


def validate_date_range(date_from: date, date_to: date) -> None:
    if date_to < date_from:
        raise ValueError("date_to cannot precede date_from")
    if (date_to - date_from).days + 1 > MAX_SCHEDULE_DAYS:
        raise ValueError(f"Date range cannot exceed {MAX_SCHEDULE_DAYS} days")


def medication_is_schedulable(med: MedicationDocument) -> bool:
    if med.is_deleted:
        return False
    if med.status != MedicationStatus.ACTIVE:
        return False
    if med.frequency == MedicationFrequency.AS_NEEDED:
        return False
    return True


def generate_occurrences_for_medication(
    med: MedicationDocument,
    date_from: date,
    date_to: date,
) -> list[ScheduleOccurrence]:
    if not medication_is_schedulable(med):
        return []
    if not med.reminder_times:
        return []

    range_start = max(date_from, med.start_date)
    range_end = date_to
    if med.end_date is not None:
        range_end = min(range_end, med.end_date)
    if range_end < range_start:
        return []

    items: list[ScheduleOccurrence] = []
    for day in _daterange(range_start, range_end):
        if med.frequency == MedicationFrequency.WEEKLY:
            # Weekly: only generate on the weekday matching start_date
            if day.weekday() != med.start_date.weekday():
                continue
        for reminder in med.reminder_times:
            utc_dt = combine_local_date_and_time(day, reminder, med.timezone)
            local = utc_datetime_to_local(utc_dt, med.timezone)
            items.append(
                ScheduleOccurrence(
                    medication_id=object_id_to_string(med.id),
                    medication_name=med.name,
                    dosage_text=med.dosage_text,
                    scheduled_for=utc_dt,
                    scheduled_local_time=local.strftime("%H:%M"),
                    timezone=med.timezone,
                )
            )
    return items


def attach_logs(
    occurrences: list[ScheduleOccurrence],
    logs: list[MedicationLogDocument],
) -> list[ScheduleOccurrence]:
    by_key: dict[tuple[str, datetime], MedicationLogDocument] = {}
    for log in logs:
        key = (object_id_to_string(log.medication_id), ensure_utc(log.scheduled_for))
        by_key[key] = log

    result: list[ScheduleOccurrence] = []
    for occ in occurrences:
        key = (occ.medication_id, ensure_utc(occ.scheduled_for))
        log = by_key.get(key)
        if log is None:
            result.append(occ)
            continue
        result.append(
            ScheduleOccurrence(
                medication_id=occ.medication_id,
                medication_name=occ.medication_name,
                dosage_text=occ.dosage_text,
                scheduled_for=occ.scheduled_for,
                scheduled_local_time=occ.scheduled_local_time,
                timezone=occ.timezone,
                log_status=log.status,
                log_id=object_id_to_string(log.id),
            )
        )
    return result


def build_schedule(
    medications: list[MedicationDocument],
    logs: list[MedicationLogDocument],
    date_from: date,
    date_to: date,
) -> list[ScheduleOccurrence]:
    validate_date_range(date_from, date_to)
    occurrences: list[ScheduleOccurrence] = []
    for med in medications:
        occurrences.extend(generate_occurrences_for_medication(med, date_from, date_to))
    occurrences.sort(key=lambda o: o.scheduled_for)
    return attach_logs(occurrences, logs)


def past_occurrences_only(
    occurrences: list[ScheduleOccurrence],
    *,
    now: datetime | None = None,
) -> list[ScheduleOccurrence]:
    cutoff = ensure_utc(now or utc_now_aware())
    return [o for o in occurrences if ensure_utc(o.scheduled_for) <= cutoff]
