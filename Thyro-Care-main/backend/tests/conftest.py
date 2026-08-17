"""Shared pytest fixtures — no real MongoDB required for the default suite."""

from __future__ import annotations

import os
from collections.abc import AsyncIterator, Iterator
from typing import Any

import pytest
from httpx import ASGITransport, AsyncClient

# Ensure test environment before app import
os.environ.setdefault("APP_ENVIRONMENT", "test")
os.environ.setdefault("DEBUG", "true")
os.environ.setdefault("OPENAPI_ENABLED", "true")
os.environ.setdefault("RATE_LIMIT_ENABLED", "false")
os.environ.setdefault("ALLOWED_ORIGINS", "http://localhost:5173")
os.environ.setdefault("MONGODB_URI", "mongodb://localhost:27017")
os.environ.setdefault("MONGODB_DATABASE", "thyrocare_ai_test")
os.environ.setdefault("DATABASE_TEST_NAME", "thyrocare_ai_test")
os.environ.setdefault("DATABASE_AUTO_INITIALIZE", "false")
os.environ.setdefault("DATABASE_RUN_MIGRATIONS", "false")
os.environ.setdefault("LOG_LEVEL", "WARNING")

from app.core.config import get_settings
from app.db import mongodb as mongodb_module
from app.main import create_application


@pytest.fixture(autouse=True)
def _clear_settings_cache() -> Iterator[None]:
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


@pytest.fixture
def anyio_backend() -> str:
    return "asyncio"


@pytest.fixture
async def client(monkeypatch: pytest.MonkeyPatch) -> AsyncIterator[AsyncClient]:
    async def fake_connect(_settings: Any) -> None:
        mongodb_module.mongo_state.connected = False
        mongodb_module.mongo_state.client = None
        mongodb_module.mongo_state.database = None
        mongodb_module.mongo_state.last_error = "test_skipped"
        mongodb_module.mongo_state.initialized = False

    async def fake_close() -> None:
        mongodb_module.mongo_state.connected = False
        mongodb_module.mongo_state.client = None
        mongodb_module.mongo_state.database = None
        mongodb_module.mongo_state.initialized = False

    async def fake_ping() -> dict[str, Any]:
        return {"connected": False, "status": "disconnected", "error": "test_skipped"}

    async def fake_initialize(_settings: Any) -> None:
        return None

    monkeypatch.setattr(mongodb_module, "connect_to_mongo", fake_connect)
    monkeypatch.setattr(mongodb_module, "close_mongo_connection", fake_close)
    monkeypatch.setattr(mongodb_module, "ping_mongo", fake_ping)
    monkeypatch.setattr("app.main.initialize_database", fake_initialize)

    application = create_application()
    transport = ASGITransport(app=application)
    async with AsyncClient(transport=transport, base_url="http://testserver") as ac:
        yield ac
