"""Deterministic medication adherence metrics (non-clinical)."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date

from app.models.enums import MedicationLogStatus
from app.models.medication import MedicationDocument, MedicationLogDocument
from app.services.medication_schedule_service import (
    build_schedule,
    past_occurrences_only,
    validate_date_range,
)
from app.utils.timezone import ensure_utc


@dataclass(frozen=True, slots=True)
class AdherenceResult:
    adherence_percentage: float | None
    total_eligible: int
    taken_count: int
    missed_count: int
    skipped_count: int
    unlogged_count: int
    date_from: date
    date_to: date


def calculate_adherence(
    medications: list[MedicationDocument],
    logs: list[MedicationLogDocument],
    date_from: date,
    date_to: date,
) -> AdherenceResult:
    """Taken / eligible × 100.

    Eligible = past scheduled occurrences excluding AS_NEEDED and SKIPPED.
    MISSED and unlogged past occurrences count as not taken.
    SKIPPED is tracked separately and excluded from the denominator.
    """
    validate_date_range(date_from, date_to)
    schedule = past_occurrences_only(build_schedule(medications, logs, date_from, date_to))

    taken = 0
    missed = 0
    skipped = 0
    unlogged = 0

    for occ in schedule:
        status = occ.log_status
        if status == MedicationLogStatus.SKIPPED:
            skipped += 1
            continue
        if status == MedicationLogStatus.TAKEN:
            taken += 1
        elif status == MedicationLogStatus.MISSED:
            missed += 1
        else:
            unlogged += 1

    eligible = taken + missed + unlogged
    percentage: float | None
    if eligible == 0:
        percentage = None
    else:
        percentage = round((taken / eligible) * 100, 1)

    return AdherenceResult(
        adherence_percentage=percentage,
        total_eligible=eligible,
        taken_count=taken,
        missed_count=missed,
        skipped_count=skipped,
        unlogged_count=unlogged,
        date_from=date_from,
        date_to=date_to,
    )


def log_matches_occurrence(
    log: MedicationLogDocument,
    medication_id: str,
    scheduled_for,
) -> bool:
    from app.models.object_id import object_id_to_string

    return object_id_to_string(log.medication_id) == medication_id and ensure_utc(
        log.scheduled_for
    ) == ensure_utc(scheduled_for)
