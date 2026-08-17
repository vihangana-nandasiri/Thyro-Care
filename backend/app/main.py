"""FastAPI application factory for ThyroCare AI (Phase 4 foundation)."""

from __future__ import annotations

import time
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from app.api.v1.health import lightweight_health
from app.api.v1.router import api_router
from app.core.config import Settings, get_settings
from app.core.exceptions import register_exception_handlers
from app.core.logging import configure_logging, get_logger
from app.core.rate_limit import configure_limiter, limiter
from app.db.initialize import initialize_database
from app.db.mongodb import close_mongo_connection, connect_to_mongo
from app.middleware.request_id import RequestIdMiddleware
from app.middleware.security import SecurityHeadersMiddleware
from app.middleware.timing import TimingMiddleware

logger = get_logger(__name__)


OPENAPI_DESCRIPTION = """
ThyroCare AI API — patient-support research system for post-thyroidectomy thyroid cancer survivors.

**Medical disclaimer:** This system provides informational support only. It does **not** replace
professional medical advice, diagnosis, or emergency care.

**Medication tracking:** Medication endpoints are for patient self-tracking only. They do not
prescribe medication, recommend dosage, interpret missed doses clinically, or guarantee outcomes.
Follow your healthcare provider’s instructions. Do not change or stop medication without
professional advice. Soft deletion and optimistic concurrency (`expected_version`) apply.
Patients may access only their own records; foreign IDs return 404.

**Phase 4–9 scope:** infrastructure, persistence, authentication, patient profile,
medication tracking, and appointment/follow-up organization. Symptom CRUD and AI HTTP
endpoints are **not** implemented yet.

**Appointment tracking:** Appointment endpoints are for personal organization only.
They do not decide clinical follow-up, send real reminders, or replace clinician instructions.
Soft deletion and optimistic concurrency (`expected_version`) apply. Patients may access
only their own records; foreign IDs return 404.

Authentication:
- Bearer JWT access tokens (short-lived, memory-only on the client)
- Opaque HttpOnly refresh cookies with rotation and reuse detection
- CSRF double-submit for refresh/logout
"""


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    settings: Settings = app.state.settings
    configure_logging(settings)
    app.state.started_at = time.time()
    logger.info(
        "Starting %s v%s (%s)",
        settings.app_name,
        settings.app_version,
        settings.app_environment,
    )
    await connect_to_mongo(settings)
    await initialize_database(settings)
    yield
    await close_mongo_connection()
    logger.info("Shutdown complete")


def create_application() -> FastAPI:
    settings = get_settings()
    docs_url = "/docs" if settings.openapi_enabled else None
    redoc_url = "/redoc" if settings.openapi_enabled else None
    openapi_url = "/openapi.json" if settings.openapi_enabled else None

    # Keep FastAPI/Starlette debug=False so ServerErrorMiddleware uses our
    # safe JSON Exception handler instead of HTML traceback pages.
    app = FastAPI(
        title=settings.app_name,
        version=settings.app_version,
        description=OPENAPI_DESCRIPTION,
        lifespan=lifespan,
        docs_url=docs_url,
        redoc_url=redoc_url,
        openapi_url=openapi_url,
        debug=False,
    )
    app.state.settings = settings
    configure_limiter(
        enabled=settings.rate_limit_enabled,
        default_limit=settings.rate_limit_default,
    )
    app.state.limiter = limiter

    app.add_middleware(SecurityHeadersMiddleware)
    app.add_middleware(TimingMiddleware)
    app.add_middleware(RequestIdMiddleware)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type", "X-CSRF-Token", "X-Request-ID"],
        expose_headers=["X-Request-ID", "X-Process-Time"],
    )

    if settings.rate_limit_enabled:
        app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
        app.add_middleware(SlowAPIMiddleware)

    register_exception_handlers(app)

    app.add_api_route("/health", lightweight_health, methods=["GET"], tags=["health"])
    app.include_router(api_router, prefix=settings.api_v1_prefix)

    @app.get("/", include_in_schema=False)
    async def root() -> dict[str, str]:
        return {
            "service": settings.app_name,
            "version": settings.app_version,
            "docs": "/docs" if settings.openapi_enabled else "disabled",
            "health": "/health",
            "api_health": f"{settings.api_v1_prefix}/health",
        }

    return app


app = create_application()
