"""Initial migration: ensure foundation indexes (idempotent)."""

from __future__ import annotations

from app.db.indexes import ensure_indexes

MIGRATION_ID = "0001_initial_indexes"
DESCRIPTION = "Create Phase 5 foundation indexes"
CHECKSUM = "phase5-indexes-v1"


async def apply(*, dry_run: bool = False) -> None:
    if dry_run:
        return
    await ensure_indexes()
