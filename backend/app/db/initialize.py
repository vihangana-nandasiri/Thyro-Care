"""Safe database initialization (indexes / migrations — never destructive)."""

from __future__ import annotations

from app.core.config import Settings
from app.core.logging import get_logger
from app.db.indexes import assert_partial_filters_atlas_compatible, ensure_indexes
from app.db.mongodb import get_database, mongo_state
from app.db.user_index_prep import prepare_users_for_active_email_index

logger = get_logger(__name__)


async def initialize_database(settings: Settings) -> None:
    """Ensure indexes and optionally apply migrations when connected."""
    if not mongo_state.connected or get_database() is None:
        logger.info("initialize_database(): skipped — MongoDB not connected")
        return

    database = get_database()
    assert database is not None

    # Must run before the unique active-email partial index is created.
    await prepare_users_for_active_email_index(database)

    if settings.database_auto_initialize:
        assert_partial_filters_atlas_compatible()
        count = await ensure_indexes(database)
        logger.info("Database indexes ensured (%s definitions)", count)
    else:
        logger.info("DATABASE_AUTO_INITIALIZE=false — skipping index creation")

    if settings.database_run_migrations:
        from app.db.migrations.registry import apply_pending_migrations

        applied = await apply_pending_migrations(dry_run=False)
        logger.info("Migrations applied: %s", applied)
    else:
        logger.info("DATABASE_RUN_MIGRATIONS=false — skipping migrations")
