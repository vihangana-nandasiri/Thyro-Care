"""Timezone helpers using zoneinfo (IANA)."""

from __future__ import annotations

from datetime import date, datetime, time
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from app.utils.datetime import utc_now


def validate_timezone(name: str) -> str:
    cleaned = name.strip()
    if not cleaned:
        raise ValueError("Timezone is required")
    try:
        ZoneInfo(cleaned)
    except ZoneInfoNotFoundError as exc:
        raise ValueError(f"Invalid IANA timezone: {cleaned}") from exc
    return cleaned


def local_datetime_to_utc(local_dt: datetime, timezone_name: str) -> datetime:
    tz = ZoneInfo(validate_timezone(timezone_name))
    if local_dt.tzinfo is None:
        aware = local_dt.replace(tzinfo=tz)
    else:
        aware = local_dt.astimezone(tz)
    return aware.astimezone(ZoneInfo("UTC"))


def utc_datetime_to_local(utc_dt: datetime, timezone_name: str) -> datetime:
    tz = ZoneInfo(validate_timezone(timezone_name))
    if utc_dt.tzinfo is None:
        aware = utc_dt.replace(tzinfo=ZoneInfo("UTC"))
    else:
        aware = utc_dt.astimezone(ZoneInfo("UTC"))
    return aware.astimezone(tz)


def combine_local_date_and_time(
    local_date: date,
    local_time: time,
    timezone_name: str,
) -> datetime:
    """Combine local calendar date + time into a UTC-aware datetime."""
    local_dt = datetime(
        local_date.year,
        local_date.month,
        local_date.day,
        local_time.hour,
        local_time.minute,
        local_time.second,
        local_time.microsecond,
    )
    return local_datetime_to_utc(local_dt, timezone_name)


def ensure_utc(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=ZoneInfo("UTC"))
    return dt.astimezone(ZoneInfo("UTC"))


def utc_now_aware() -> datetime:
    now = utc_now()
    if now.tzinfo is None:
        return now.replace(tzinfo=ZoneInfo("UTC"))
    return now.astimezone(ZoneInfo("UTC"))


def ensure_utc_datetime(dt: datetime) -> datetime:
    """Alias for ensure_utc — store appointment timestamps in UTC."""
    return ensure_utc(dt)


def appointment_local_date(utc_dt: datetime, timezone_name: str) -> date:
    return utc_datetime_to_local(utc_dt, timezone_name).date()


def normalize_date_range(
    date_from: date,
    date_to: date,
    *,
    max_days: int = 62,
) -> tuple[date, date]:
    if date_to < date_from:
        raise ValueError("date_to cannot precede date_from")
    span = (date_to - date_from).days
    if span > max_days:
        raise ValueError(f"Date range cannot exceed {max_days} days")
    return date_from, date_to
