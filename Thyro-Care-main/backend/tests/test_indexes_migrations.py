"""Index definition and migration registry unit tests."""

from __future__ import annotations

from typing import Any

import pytest
from app.db.collections import CollectionName
from app.db.indexes import (
    INDEX_SPECS,
    assert_index_names_unique,
    assert_partial_filters_atlas_compatible,
    list_ttl_indexes,
)
from app.db.migrations.registry import MIGRATIONS, apply_pending_migrations
from app.db.user_index_prep import (
    DuplicateActiveEmailError,
    assert_no_duplicate_active_emails,
    backfill_users_is_deleted,
)


def test_ttl_index_definitions() -> None:
    ttl = list_ttl_indexes()
    names = {spec.name for spec in ttl}
    assert "ttl_refresh_tokens_expires_at" in names
    assert "ttl_notifications_expires_at" in names
    for spec in ttl:
        assert spec.expire_after_seconds == 0


def test_index_names_are_stable_and_unique() -> None:
    assert_index_names_unique()
    names = [spec.name for spec in INDEX_SPECS]
    assert len(names) == len(set(names))
    assert all(name for name in names)


def test_active_user_email_partial_index_atlas_compatible() -> None:
    spec = next(s for s in INDEX_SPECS if s.name == "ux_users_email_normalized_active")
    assert spec.collection == CollectionName.USERS.value
    assert spec.unique is True
    assert spec.keys == [("email_normalized", 1)]
    assert spec.partial_filter == {"is_deleted": False}
    assert_partial_filters_atlas_compatible()


def test_no_partial_index_uses_unsupported_operators() -> None:
    forbidden = {"$ne", "$not", "$nin"}
    for spec in INDEX_SPECS:
        if not spec.partial_filter:
            continue
        serialized = str(spec.partial_filter)
        for op in forbidden:
            assert op not in serialized, f"{spec.name} uses forbidden {op}"
        # Explicit equality exclusion of deleted users for the unique email index.
        if spec.name == "ux_users_email_normalized_active":
            assert spec.partial_filter == {"is_deleted": False}


def test_partial_filter_assert_rejects_ne(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.db import indexes as indexes_module
    from app.db.indexes import IndexSpec

    bad = (
        IndexSpec(
            CollectionName.USERS.value,
            "ux_bad_partial",
            [("email_normalized", 1)],
            unique=True,
            partial_filter={"is_deleted": {"$ne": True}},
        ),
    )
    monkeypatch.setattr(indexes_module, "INDEX_SPECS", bad)
    with pytest.raises(RuntimeError, match="Unsupported partial filter"):
        assert_partial_filters_atlas_compatible()


@pytest.mark.asyncio
async def test_migration_registry_idempotency(monkeypatch: pytest.MonkeyPatch) -> None:
    import app.db.migrations.registry as registry

    async def fake_applied() -> set[str]:
        return {MIGRATIONS[0].migration_id}

    monkeypatch.setattr(registry, "list_applied_migration_ids", fake_applied)
    monkeypatch.setattr(registry, "get_database", lambda: object())

    applied = await apply_pending_migrations(dry_run=False)
    assert applied == []
    # Same migration id remains the only registered entry
    assert MIGRATIONS[0].migration_id in await fake_applied()


class _FakeUpdateResult:
    def __init__(self, modified_count: int) -> None:
        self.modified_count = modified_count


class _FakeCursor:
    def __init__(self, rows: list[dict[str, Any]]) -> None:
        self._rows = rows

    async def to_list(self, length: int) -> list[dict[str, Any]]:
        _ = length
        return self._rows


class _FakeUsersCollection:
    def __init__(self) -> None:
        self.update_calls: list[tuple[dict[str, Any], dict[str, Any]]] = []
        self.aggregate_rows: list[dict[str, Any]] = []

    async def update_many(self, filt: dict[str, Any], update: dict[str, Any]) -> _FakeUpdateResult:
        self.update_calls.append((filt, update))
        return _FakeUpdateResult(modified_count=3)

    async def aggregate(self, pipeline: list[dict[str, Any]]) -> _FakeCursor:
        _ = pipeline
        return _FakeCursor(self.aggregate_rows)


class _FakeDatabase:
    def __init__(self, users: _FakeUsersCollection) -> None:
        self._users = users

    def __getitem__(self, name: str) -> _FakeUsersCollection:
        assert name == CollectionName.USERS.value
        return self._users


@pytest.mark.asyncio
async def test_backfill_users_is_deleted_only_missing_field() -> None:
    users = _FakeUsersCollection()
    db = _FakeDatabase(users)
    modified = await backfill_users_is_deleted(db)  # type: ignore[arg-type]
    assert modified == 3
    assert users.update_calls == [
        ({"is_deleted": {"$exists": False}}, {"$set": {"is_deleted": False}})
    ]


@pytest.mark.asyncio
async def test_duplicate_active_email_check_passes_when_clean() -> None:
    users = _FakeUsersCollection()
    users.aggregate_rows = []
    await assert_no_duplicate_active_emails(_FakeDatabase(users))  # type: ignore[arg-type]


@pytest.mark.asyncio
async def test_duplicate_active_email_check_stops_on_duplicates() -> None:
    users = _FakeUsersCollection()
    users.aggregate_rows = [{"duplicate_groups": 2}]
    with pytest.raises(DuplicateActiveEmailError, match="duplicate active email_normalized"):
        await assert_no_duplicate_active_emails(_FakeDatabase(users))  # type: ignore[arg-type]
