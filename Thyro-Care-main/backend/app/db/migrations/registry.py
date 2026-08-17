"""Idempotent migration registry backed by schema_migrations collection."""

from __future__ import annotations

from collections.abc import Awaitable, Callable
from dataclasses import dataclass

from app.core.logging import get_logger
from app.db.collections import CollectionName
from app.db.migrations import migration_0001_initial_indexes as m0001
from app.db.mongodb import get_database
from app.models.supporting import SchemaMigrationDocument
from app.utils.datetime import utc_now

logger = get_logger(__name__)


@dataclass(frozen=True, slots=True)
class Migration:
    migration_id: str
    description: str
    checksum: str | None
    apply: Callable[..., Awaitable[None]]


MIGRATIONS: tuple[Migration, ...] = (
    Migration(
        migration_id=m0001.MIGRATION_ID,
        description=m0001.DESCRIPTION,
        checksum=m0001.CHECKSUM,
        apply=m0001.apply,
    ),
)


async def list_applied_migration_ids() -> set[str]:
    db = get_database()
    if db is None:
        return set()
    cursor = db[CollectionName.SCHEMA_MIGRATIONS.value].find({}, projection={"migration_id": 1})
    ids: set[str] = set()
    async for doc in cursor:
        value = doc.get("migration_id")
        if isinstance(value, str):
            ids.add(value)
    return ids


async def apply_pending_migrations(*, dry_run: bool = False) -> list[str]:
    """Apply pending migrations idempotently. Returns applied migration IDs."""
    db = get_database()
    if db is None:
        logger.info("Migrations skipped — database unavailable")
        return []

    applied = await list_applied_migration_ids()
    newly_applied: list[str] = []
    for migration in MIGRATIONS:
        if migration.migration_id in applied:
            logger.info("Migration already applied: %s", migration.migration_id)
            continue
        logger.info(
            "%s migration %s — %s",
            "Dry-run" if dry_run else "Applying",
            migration.migration_id,
            migration.description,
        )
        await migration.apply(dry_run=dry_run)
        if dry_run:
            newly_applied.append(migration.migration_id)
            continue
        record = SchemaMigrationDocument(
            migration_id=migration.migration_id,
            description=migration.description,
            checksum=migration.checksum,
            applied_at=utc_now(),
        )
        await db[CollectionName.SCHEMA_MIGRATIONS.value].update_one(
            {"migration_id": migration.migration_id},
            {"$setOnInsert": record.model_dump(by_alias=True, mode="python")},
            upsert=True,
        )
        newly_applied.append(migration.migration_id)
    return newly_applied
