"""Map PyMongo / BSON errors to repository exceptions without leaking details."""

from __future__ import annotations

from collections.abc import Callable
from typing import TypeVar

from bson.errors import InvalidId
from pymongo.errors import (
    ConnectionFailure,
    DuplicateKeyError,
    NetworkTimeout,
    OperationFailure,
    ServerSelectionTimeoutError,
)

from app.core.logging import get_logger
from app.repositories.exceptions import (
    RepositoryConflictError,
    RepositoryError,
    RepositoryUnavailableError,
    RepositoryValidationError,
)

logger = get_logger(__name__)

T = TypeVar("T")


def map_pymongo_error(exc: Exception) -> Exception:
    if isinstance(exc, InvalidId):
        return RepositoryValidationError("Invalid identifier")
    if isinstance(exc, DuplicateKeyError):
        return RepositoryConflictError("Duplicate key")
    if isinstance(
        exc,
        (ServerSelectionTimeoutError, ConnectionFailure, NetworkTimeout),
    ):
        return RepositoryUnavailableError("Database temporarily unavailable")
    if isinstance(exc, OperationFailure):
        logger.error("MongoDB operation failure: code=%s", getattr(exc, "code", None))
        return RepositoryError("Database operation failed")
    return exc


async def run_db_operation(operation: Callable[[], T]) -> T:
    """Execute a sync-looking coroutine factory with error mapping.

    Prefer wrapping call sites with try/except translate_db_errors instead.
    """
    try:
        return await operation()  # type: ignore[misc]
    except Exception as exc:
        mapped = map_pymongo_error(exc)
        if mapped is exc:
            raise
        raise mapped from exc


def translate_db_errors(exc: BaseException) -> None:
    """Re-raise mapped repository exceptions; no-op for non-DB errors of interest."""
    if isinstance(exc, Exception):
        mapped = map_pymongo_error(exc)
        if mapped is not exc:
            raise mapped from exc
    raise exc
