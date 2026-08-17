"""Motor removal and AsyncMongoClient lifecycle unit tests."""

from __future__ import annotations

import ast
from pathlib import Path

import pytest
from app.db import mongodb as mongodb_module
from pymongo import AsyncMongoClient


def test_no_motor_imports_in_application_code() -> None:
    app_root = Path(__file__).resolve().parents[1] / "app"
    offenders: list[str] = []
    for path in app_root.rglob("*.py"):
        tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                for alias in node.names:
                    if alias.name == "motor" or alias.name.startswith("motor."):
                        offenders.append(str(path))
            elif isinstance(node, ast.ImportFrom):
                if node.module and (node.module == "motor" or node.module.startswith("motor.")):
                    offenders.append(str(path))
    assert offenders == []


def test_async_mongo_client_type_used() -> None:
    assert mongodb_module.AsyncMongoClient is AsyncMongoClient


@pytest.mark.asyncio
async def test_async_client_lifecycle_behavior(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.core.config import Settings

    settings = Settings(
        APP_ENVIRONMENT="test",
        MONGODB_URI="mongodb://127.0.0.1:1",
        MONGODB_DATABASE="thyrocare_ai_test",
        MONGODB_SERVER_SELECTION_TIMEOUT_MS=100,
        MONGODB_CONNECT_TIMEOUT_MS=100,
        DATABASE_REQUIRE_CONNECTION=False,
    )

    await mongodb_module.connect_to_mongo(settings)
    assert mongodb_module.mongo_state.connected is False
    assert mongodb_module.mongo_state.client is None
    ping = await mongodb_module.ping_mongo()
    assert ping["connected"] is False
    await mongodb_module.close_mongo_connection()
    assert mongodb_module.mongo_state.connected is False
