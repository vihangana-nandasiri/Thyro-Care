"""MongoDB connection foundation using PyMongo AsyncMongoClient.

One AsyncMongoClient per application event loop (FastAPI lifespan).
Motor is not used.
"""

from __future__ import annotations

from typing import Any

from pymongo import AsyncMongoClient
from pymongo.asynchronous.database import AsyncDatabase

from app.core.config import Settings
from app.core.logging import get_logger

logger = get_logger(__name__)


class MongoState:
    client: AsyncMongoClient | None = None
    database: AsyncDatabase | None = None
    connected: bool = False
    last_error: str | None = None
    initialized: bool = False


mongo_state = MongoState()


async def connect_to_mongo(settings: Settings) -> None:
    """Attempt MongoDB connection. Development may continue degraded if unavailable."""
    mongo_state.last_error = None
    mongo_state.initialized = False
    try:
        client: AsyncMongoClient = AsyncMongoClient(
            settings.mongodb_uri,
            serverSelectionTimeoutMS=settings.mongodb_server_selection_timeout_ms,
            connectTimeoutMS=settings.mongodb_connect_timeout_ms,
            socketTimeoutMS=settings.mongodb_socket_timeout_ms,
        )
        await client.admin.command("ping")
        mongo_state.client = client
        mongo_state.database = client[settings.mongodb_database]
        mongo_state.connected = True
        logger.info("MongoDB connection established (database=%s)", settings.mongodb_database)
    except Exception as exc:  # noqa: BLE001 - foundation must not crash on local Mongo absence
        mongo_state.client = None
        mongo_state.database = None
        mongo_state.connected = False
        mongo_state.last_error = type(exc).__name__
        logger.warning(
            "MongoDB unavailable (%s). API will report degraded health until Mongo is reachable.",
            type(exc).__name__,
        )
        if settings.is_production or settings.database_require_connection:
            logger.error("MongoDB connection failed — health will be unhealthy")


async def close_mongo_connection() -> None:
    if mongo_state.client is not None:
        await mongo_state.client.close()
        logger.info("MongoDB connection closed")
    mongo_state.client = None
    mongo_state.database = None
    mongo_state.connected = False
    mongo_state.initialized = False


async def ping_mongo() -> dict[str, Any]:
    """Return a safe connectivity snapshot for health endpoints."""
    if mongo_state.client is None:
        return {
            "connected": False,
            "status": "disconnected",
            "error": mongo_state.last_error or "not_initialized",
        }
    try:
        await mongo_state.client.admin.command("ping")
        mongo_state.connected = True
        mongo_state.last_error = None
        return {"connected": True, "status": "connected", "error": None}
    except Exception as exc:  # noqa: BLE001
        mongo_state.connected = False
        mongo_state.last_error = type(exc).__name__
        return {
            "connected": False,
            "status": "disconnected",
            "error": type(exc).__name__,
        }


def get_database() -> AsyncDatabase | None:
    return mongo_state.database


def get_client() -> AsyncMongoClient | None:
    return mongo_state.client
