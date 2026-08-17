"""BSON-safe serialization helpers for Mongo persistence."""

from __future__ import annotations

from datetime import UTC, date, datetime, time

from app.repositories.base import to_bson_safe
from bson import BSON


def test_to_bson_safe_converts_date_and_time() -> None:
    payload = {
        "start_date": date(2026, 7, 1),
        "reminder_times": [time(8, 0), time(20, 30)],
        "nested": {"surgery_date": date(2025, 1, 2)},
        "created_at": datetime(2026, 7, 1, 12, 0, tzinfo=UTC),
    }
    safe = to_bson_safe(payload)
    assert safe["start_date"] == datetime(2026, 7, 1, tzinfo=UTC)
    assert safe["reminder_times"] == ["08:00", "20:30"]
    assert safe["nested"]["surgery_date"] == datetime(2025, 1, 2, tzinfo=UTC)
    assert isinstance(safe["created_at"], datetime)
    # Must be encodable by real BSON (Atlas / production MongoDB).
    BSON.encode(safe)
