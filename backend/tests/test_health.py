"""Health endpoint tests."""

from __future__ import annotations

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_root_health_ok(client: AsyncClient) -> None:
    response = await client.get("/health")
    assert response.status_code == 200
    body = response.json()
    assert body["success"] is True
    assert body["data"]["status"] == "healthy"
    assert body["data"]["database_status"] == "unknown"
    assert "version" in body["data"]


@pytest.mark.asyncio
async def test_api_v1_health_schema(client: AsyncClient) -> None:
    response = await client.get("/api/v1/health")
    assert response.status_code == 200
    body = response.json()
    assert set(body.keys()) >= {"success", "message", "data", "request_id"}
    data = body["data"]
    assert set(data.keys()) >= {
        "status",
        "service",
        "version",
        "environment",
        "timestamp",
        "database_status",
        "uptime_seconds",
    }
    # Mongo mocked as disconnected in tests → degraded in non-production
    assert data["status"] in {"healthy", "degraded", "unhealthy"}
    assert data["database_status"] in {"connected", "disconnected", "unknown"}
