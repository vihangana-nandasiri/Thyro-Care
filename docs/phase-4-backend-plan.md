# Phase 4 — Backend Plan

**Date:** 2026-07-11  
**Workspace:** Thyro-Care-t1  
**Baseline:** Phase 3 commit `7443b8b`  
**Python available:** 3.14.0 (`python -m pip`)  
**Current backend:** none  
**Frontend:** unchanged; Axios client points at future `/api/v1` but not connected

---

## 1. Backend architecture

```
backend/
  app/
    main.py              # create_application() factory + app instance
    api/v1/              # Versioned HTTP routes (health only)
    core/                # Config, logging, exceptions, security headers
    db/                  # Motor client + health ping (no domain collections)
    middleware/          # Request ID, timing, security headers
    schemas/             # Pydantic response/health models
    utils/               # UTC datetime helpers
  tests/                 # pytest + httpx ASGITransport (no real MongoDB)
```

Async FastAPI + Motor. No domain routers, auth, or AI.

---

## 2. Package strategy

**Runtime:** fastapi, uvicorn[standard], pydantic, pydantic-settings, motor, pymongo, httpx, slowapi (optional in-memory rate limit)

**Dev:** pytest, pytest-asyncio, ruff, httpx

**Deferred:** JWT, passlib, langchain, vector DBs, redis

Use `requirements.txt` + `requirements-dev.txt` and `pyproject.toml` for tool config.

---

## 3. API versioning strategy

- Prefix: `/api/v1` from settings
- Lightweight `GET /health` for host probes
- Detailed `GET /api/v1/health` for ops
- Future domain routers mount under the same v1 aggregator only

---

## 4. Configuration strategy

- `pydantic-settings` `Settings` class
- `.env.example` only; never commit `.env`
- Safe development defaults
- Production must require `MONGODB_URI` / origins explicitly when `APP_ENVIRONMENT=production`
- Never log or return `mongodb_uri`

---

## 5. MongoDB connection strategy

- Motor async client on lifespan startup
- Ping for health
- Development: allow app start if Mongo unavailable → `degraded`
- Production: unhealthy / fail-safe messaging in health; no silent success
- No collections, seed data, or domain indexes (Phase 5)
- `ensure_indexes()` placeholder only

---

## 6. Logging strategy

- stdlib logging with structured JSON formatter in production
- Human-readable formatter in development
- Context: request_id, method, path, status, duration
- Never log bodies, Authorization, or secrets

---

## 7. Error-handling strategy

- Typed `AppException` hierarchy
- Handlers for app exceptions, validation errors, HTTPException, unhandled
- Safe JSON: message, code, request_id, timestamp
- Stack traces in logs only (dev visibility); never in production responses

---

## 8. Middleware strategy

1. Request ID (`X-Request-ID`)
2. Timing (`X-Process-Time`)
3. Security headers (API-appropriate)
4. CORS from `ALLOWED_ORIGINS`
5. Rate-limit foundation (disabled by default; in-memory / SlowAPI if clean)

---

## 9. Test strategy

- pytest + httpx ASGITransport
- Override/mock MongoDB health so tests need no real server
- Cover health, headers, 404, validation format, OpenAPI, CORS preflight

---

## 10. Security baseline

- No secrets in repo
- Security headers middleware
- CORS allowlist
- Docs disableable in production
- Medical disclaimer in OpenAPI description

---

## 11. Deferred domain features (Phase 5+)

Users, profiles, medications, appointments, symptoms, chat, RAG, JWT, admin, docker-compose

---

## 12. Validation strategy

1. Create plan (this doc) before code
2. venv + install
3. ruff check / format --check
4. pytest
5. uvicorn smoke: /health, /api/v1/health, /docs
6. Frontend regression: typecheck, lint, format:check, build
7. Commit only if all pass

**Do not begin Phase 5.**
