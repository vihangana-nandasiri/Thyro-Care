"""Appointment lifecycle transitions (patient tracking only — not clinical)."""

from __future__ import annotations

from datetime import datetime

from app.core.exceptions import ValidationException
from app.models.enums import AppointmentStatus
from app.utils.timezone import utc_now_aware

_ALLOWED: dict[AppointmentStatus, set[AppointmentStatus]] = {
    AppointmentStatus.UPCOMING: {
        AppointmentStatus.COMPLETED,
        AppointmentStatus.MISSED,
        AppointmentStatus.CANCELLED,
    },
    AppointmentStatus.MISSED: {
        AppointmentStatus.UPCOMING,
        AppointmentStatus.COMPLETED,
        AppointmentStatus.CANCELLED,
    },
    AppointmentStatus.CANCELLED: {
        AppointmentStatus.UPCOMING,
    },
    AppointmentStatus.COMPLETED: {
        AppointmentStatus.UPCOMING,
    },
}


def assert_transition_allowed(
    current: AppointmentStatus,
    target: AppointmentStatus,
) -> None:
    if current == target:
        return
    allowed = _ALLOWED.get(current, set())
    if target not in allowed:
        raise ValidationException("This appointment status change is not available.")


def apply_lifecycle_timestamps(
    *,
    previous_status: AppointmentStatus,
    new_status: AppointmentStatus,
    completed_at: datetime | None,
    cancelled_at: datetime | None,
    now: datetime | None = None,
) -> tuple[datetime | None, datetime | None]:
    """Return (completed_at, cancelled_at) for the new status."""
    assert_transition_allowed(previous_status, new_status)
    stamp = now or utc_now_aware()
    if new_status == AppointmentStatus.COMPLETED:
        if completed_at is None or previous_status != AppointmentStatus.COMPLETED:
            return stamp, None
        return completed_at, None
    if new_status == AppointmentStatus.CANCELLED:
        if cancelled_at is None or previous_status != AppointmentStatus.CANCELLED:
            return None, stamp
        return None, cancelled_at
    # UPCOMING or MISSED — clear lifecycle stamps
    return None, None
