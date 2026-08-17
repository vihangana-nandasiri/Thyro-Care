"""Error-handling and response-shape tests."""

from __future__ import annotations

from typing import Any

import pytest
from app.db import mongodb as mongodb_module
from app.main import create_application
from fastapi import Query
from httpx import ASGITransport, AsyncClient


async def _fake_connect(_settings: Any) -> None:
    mongodb_module.mongo_state.connected = False
    mongodb_module.mongo_state.client = None
    mongodb_module.mongo_state.database = None
    mongodb_module.mongo_state.last_error = "test_skipped"


async def _fake_close() -> None:
    mongodb_module.mongo_state.connected = False


async def _fake_initialize(_settings: Any) -> None:
    return None


@pytest.mark.asyncio
async def test_unknown_route_safe_404(client: AsyncClient) -> None:
    response = await client.get("/definitely-missing-route")
    assert response.status_code == 404
    body = response.json()
    assert body["success"] is False
    assert body["code"] == "not_found"
    assert "traceback" not in str(body).lower()
    assert "request_id" in body


@pytest.mark.asyncio
async def test_validation_error_format(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(mongodb_module, "connect_to_mongo", _fake_connect)
    monkeypatch.setattr(mongodb_module, "close_mongo_connection", _fake_close)
    monkeypatch.setattr("app.main.initialize_database", _fake_initialize)

    app = create_application()

    @app.get("/__test/validate")
    async def validate_endpoint(count: int = Query(...)) -> dict[str, int]:
        return {"count": count}

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as ac:
        response = await ac.get("/__test/validate", params={"count": "not-an-int"})
    assert response.status_code == 422
    body = response.json()
    assert body["success"] is False
    assert body["code"] == "validation_error"
    assert isinstance(body["details"], list)


@pytest.mark.asyncio
async def test_unhandled_exception_hides_stack(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(mongodb_module, "connect_to_mongo", _fake_connect)
    monkeypatch.setattr(mongodb_module, "close_mongo_connection", _fake_close)
    monkeypatch.setattr("app.main.initialize_database", _fake_initialize)

    app = create_application()

    @app.get("/__test/boom")
    async def boom() -> None:
        raise RuntimeError("secret-stack-trace-should-not-leak")

    transport = ASGITransport(app=app, raise_app_exceptions=False)
    async with AsyncClient(transport=transport, base_url="http://testserver") as ac:
        response = await ac.get("/__test/boom")
    assert response.status_code == 500
    body = response.json()
    assert body["success"] is False
    assert body["code"] == "internal_error"
    assert "secret-stack-trace" not in response.text
    assert "RuntimeError" not in response.text
