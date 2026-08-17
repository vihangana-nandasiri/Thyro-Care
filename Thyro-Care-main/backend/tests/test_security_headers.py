"""Security headers, request metadata, CORS, and OpenAPI tests."""

from __future__ import annotations

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_request_id_and_process_time_headers(client: AsyncClient) -> None:
    response = await client.get("/health", headers={"X-Request-ID": "test-req-123"})
    assert response.status_code == 200
    assert response.headers.get("X-Request-ID") == "test-req-123"
    assert "X-Process-Time" in response.headers


@pytest.mark.asyncio
async def test_generated_request_id_when_missing(client: AsyncClient) -> None:
    response = await client.get("/health")
    assert response.headers.get("X-Request-ID")
    assert len(response.headers["X-Request-ID"]) >= 8


@pytest.mark.asyncio
async def test_security_headers_present(client: AsyncClient) -> None:
    response = await client.get("/health")
    assert response.headers.get("X-Content-Type-Options") == "nosniff"
    assert response.headers.get("X-Frame-Options") == "DENY"
    assert response.headers.get("Referrer-Policy") == "no-referrer"
    assert "Permissions-Policy" in response.headers
    assert response.headers.get("Cache-Control") == "no-store"


@pytest.mark.asyncio
async def test_cors_preflight_for_frontend_origin(client: AsyncClient) -> None:
    response = await client.options(
        "/health",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "GET",
        },
    )
    assert response.status_code in {200, 204}
    assert response.headers.get("access-control-allow-origin") == "http://localhost:5173"


@pytest.mark.asyncio
async def test_openapi_available_in_development(client: AsyncClient) -> None:
    response = await client.get("/openapi.json")
    assert response.status_code == 200
    payload = response.json()
    assert payload["info"]["title"]
    assert (
        "Phase 4" in payload["info"]["description"]
        or "authentication" in payload["info"]["description"].lower()
        or "infrastructure" in payload["info"]["description"].lower()
    )
    paths = payload.get("paths", {})
    assert "/api/v1/auth/login" in paths or any("auth/login" in p for p in paths)
