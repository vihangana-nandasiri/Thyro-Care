"""Health endpoints — infrastructure only."""

from __future__ import annotations

import time
from typing import Any

from fastapi import APIRouter, Request, Response, status

from app.core.config import get_settings
from app.core.logging import get_request_id
from app.db.mongodb import ping_mongo
from app.schemas.common import ApiSuccessResponse
from app.schemas.health import HealthResponse

router = APIRouter(tags=["health"])


def _uptime_seconds(request: Request) -> float:
    started = getattr(request.app.state, "started_at", None)
    if started is None:
        return 0.0
    return max(0.0, time.time() - float(started))


async def lightweight_health(request: Request) -> dict[str, Any]:
    """Lightweight probe for hosting platforms (no Mongo ping)."""
    settings = get_settings()
    payload = HealthResponse(
        status="healthy",
        service=settings.app_name,
        version=settings.app_version,
        environment=settings.app_environment,
        database_status="unknown",
        uptime_seconds=round(_uptime_seconds(request), 3),
    )
    return {
        "success": True,
        "message": "Service is running",
        "data": payload.model_dump(),
        "request_id": get_request_id(),
    }


@router.get(
    "/health",
    response_model=ApiSuccessResponse[HealthResponse],
    responses={503: {"description": "Unhealthy"}},
)
async def detailed_health(request: Request, response: Response) -> dict[str, Any]:
    """Detailed health including MongoDB connectivity (GET /api/v1/health)."""
    settings = get_settings()
    mongo = await ping_mongo()
    db_status = str(mongo.get("status", "unknown"))
    connected = bool(mongo.get("connected"))

    if connected:
        health_status = "healthy"
        http_status = status.HTTP_200_OK
        message = "Service is healthy"
    elif settings.is_production:
        health_status = "unhealthy"
        http_status = status.HTTP_503_SERVICE_UNAVAILABLE
        message = "Service is unhealthy"
    else:
        health_status = "degraded"
        http_status = status.HTTP_200_OK
        message = "Service is degraded (database unavailable)"

    payload = HealthResponse(
        status=health_status,  # type: ignore[arg-type]
        service=settings.app_name,
        version=settings.app_version,
        environment=settings.app_environment,
        database_status=db_status,  # type: ignore[arg-type]
        uptime_seconds=round(_uptime_seconds(request), 3),
    )
    response.status_code = http_status
    return {
        "success": health_status != "unhealthy",
        "message": message,
        "data": payload.model_dump(),
        "request_id": get_request_id(),
    }
