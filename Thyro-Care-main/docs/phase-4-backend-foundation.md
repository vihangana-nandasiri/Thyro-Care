# Phase 4 — Backend Foundation

**Date:** 2026-07-11  
**Commit target:** `feat: create FastAPI backend foundation`  
**Scope:** FastAPI infrastructure only. No domain collections, auth, or AI.

---

## Architecture

Async FastAPI application with:

- Application factory `create_application()` and module-level `app`
- Lifespan hooks for logging + MongoDB connect/disconnect
- Versioned router at `/api/v1`
- Pure ASGI middleware (request ID, timing, security headers)
- CORSMiddleware for configured origins
- Safe JSON exception handlers
- Motor MongoDB client foundation (ping/health only)

## Directory structure

```
backend/
  app/
    main.py                 # factory + lifespan
    api/v1/health.py        # health routes
    api/v1/router.py        # v1 aggregator
    core/                   # config, logging, exceptions, security headers
    db/                     # mongodb.py + indexes placeholder
    middleware/             # request_id, timing, security
    schemas/                # common + health
    utils/                  # UTC datetime
    models|repositories|services/  # empty packages for later phases
  tests/                    # pytest + httpx ASGITransport
  Dockerfile, pyproject.toml, requirements*.txt, .env.example
```

## Dependencies

**Runtime:** fastapi, uvicorn[standard], pydantic, pydantic-settings, motor, pymongo, httpx, slowapi

**Dev:** pytest, pytest-asyncio, ruff

**Not installed:** JWT/auth libs, LangChain, vector DBs, Redis, password hashing

## Configuration

`app/core/config.py` — Pydantic Settings with safe development defaults.  
Production validation rejects local Mongo URI, wildcard CORS, and `DEBUG=true`.  
Secrets (Mongo URI) are never logged or returned in responses.

## Middleware

| Middleware                | Role                                                  |
| ------------------------- | ----------------------------------------------------- |
| RequestIdMiddleware       | Validate/generate `X-Request-ID`                      |
| TimingMiddleware          | `X-Process-Time` + request log                        |
| SecurityHeadersMiddleware | nosniff, DENY frame, referrer, permissions, no-store  |
| CORSMiddleware            | Origins from settings; expose request/process headers |
| SlowAPIMiddleware         | Only when `RATE_LIMIT_ENABLED=true`                   |

## Logging

Standard library logging with request-id filter. Dev: readable line format. Production: JSON lines. No request bodies, Authorization headers, or Mongo URIs.

## Error handling

AppException hierarchy + handlers for validation, HTTPException, and unhandled Exception. Clients receive safe JSON (`success`, `message`, `code`, `request_id`, `timestamp`) without stack traces. FastAPI `debug=False` so Starlette does not serve HTML tracebacks.

## MongoDB connection foundation

Motor client with 3s timeouts. Development continues if Mongo is down (degraded health). Production marks unhealthy. No collections, seed data, or domain indexes in Phase 4.

## API versioning

- `GET /health` — lightweight
- `GET /api/v1/health` — detailed
- Future routers mount only under `api_router`

## Health endpoints

Documented statuses: `healthy` | `degraded` | `unhealthy`. Database status never includes credentials.

## Test approach

pytest-asyncio + httpx ASGITransport. Mongo connect/ping mocked in fixtures. Covers health, headers, CORS, OpenAPI, 404/422/500 shapes.

## Security baseline

Env-based config, CORS allow-list, security headers, request ID validation, no secrets in responses, OpenAPI disable flag, rate-limit hook (off by default).

## Deferred Phase 5+ work

Domain schemas/collections/indexes, user registration, JWT, clinical CRUD, AI/RAG, Redis rate limits, Docker Compose.
