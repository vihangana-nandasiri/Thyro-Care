"""Prepare users collection before creating the active-email unique partial index.

Atlas partial indexes require equality on ``is_deleted: false``. Documents that
omit ``is_deleted`` would fall outside that index; this module backfills the
field safely and refuses to proceed when duplicate active emails exist.
"""

from __future__ import annotations

from pymongo.asynchronous.database import AsyncDatabase
from pymongo.errors import PyMongoError

from app.core.logging import get_logger
from app.db.collections import CollectionName

logger = get_logger(__name__)


class DuplicateActiveEmailError(RuntimeError):
    """Raised when multiple non-deleted users share the same email_normalized."""


async def backfill_users_is_deleted(database: AsyncDatabase) -> int:
    """Set ``is_deleted=False`` only where the field is missing. Idempotent."""
    users = database[CollectionName.USERS.value]
    try:
        result = await users.update_many(
            {"is_deleted": {"$exists": False}},
            {"$set": {"is_deleted": False}},
        )
    except PyMongoError:
        logger.exception("Failed to backfill users.is_deleted")
        raise
    modified = int(result.modified_count)
    logger.info("users.is_deleted backfill modified=%s", modified)
    return modified


async def assert_no_duplicate_active_emails(database: AsyncDatabase) -> None:
    """Fail startup if active users would violate the unique partial index.

    Does not log email addresses — only the duplicate group count.
    """
    users = database[CollectionName.USERS.value]
    pipeline = [
        {"$match": {"is_deleted": False}},
        {
            "$group": {
                "_id": "$email_normalized",
                "count": {"$sum": 1},
            }
        },
        {"$match": {"count": {"$gt": 1}}},
        {"$count": "duplicate_groups"},
    ]
    try:
        cursor = await users.aggregate(pipeline)
        rows = await cursor.to_list(length=1)
    except PyMongoError:
        logger.exception("Failed to check duplicate active emails")
        raise
    if not rows:
        return
    groups = int(rows[0].get("duplicate_groups") or 0)
    if groups > 0:
        raise DuplicateActiveEmailError(
            "Cannot create ux_users_email_normalized_active: "
            f"{groups} duplicate active email_normalized group(s) exist. "
            "Resolve manually before deploying; no records were deleted."
        )


async def prepare_users_for_active_email_index(database: AsyncDatabase) -> None:
    """Backfill missing is_deleted, then verify uniqueness for active users."""
    await backfill_users_is_deleted(database)
    await assert_no_duplicate_active_emails(database)
