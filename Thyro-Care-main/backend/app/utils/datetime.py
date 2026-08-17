from datetime import UTC, datetime


def utc_now() -> datetime:
    """Return timezone-aware UTC datetime."""
    return datetime.now(UTC)


def utc_isoformat(value: datetime | None = None) -> str:
    """Serialize a datetime as ISO-8601 UTC."""
    current = value or utc_now()
    if current.tzinfo is None:
        current = current.replace(tzinfo=UTC)
    return current.astimezone(UTC).isoformat().replace("+00:00", "Z")
