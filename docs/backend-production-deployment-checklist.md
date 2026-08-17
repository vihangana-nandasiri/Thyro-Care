# Backend production deployment checklist

Provider-neutral. **Do not deploy the FastAPI backend without valid provider credentials and a chosen host.**

Current static frontend origin (must be allowlisted exactly when the API is live):

`https://thyrot1.chinthakajayaweera1.workers.dev`

## Required configuration

| Item                          | Requirement                                                                                       |
| ----------------------------- | ------------------------------------------------------------------------------------------------- |
| Public HTTPS backend URL      | e.g. `https://api.example.com` with TLS                                                           |
| MongoDB URI                   | Production Atlas/URI via secret manager — never commit                                            |
| `JWT_SECRET_KEY`              | Long random secret — never commit                                                                 |
| `APP_ENVIRONMENT`             | `production`                                                                                      |
| `DEBUG`                       | `false`                                                                                           |
| `DATABASE_REQUIRE_CONNECTION` | `true`                                                                                            |
| `COOKIE_SECURE`               | `true`                                                                                            |
| `ALLOWED_ORIGINS`             | Exact frontend origin(s), comma-separated — **no wildcard** with credentials                      |
| CORS credentials              | Enabled (`allow_credentials=true`)                                                                |
| OpenAPI                       | Prefer `OPENAPI_ENABLED=false` in production unless intentionally public                          |
| Health check                  | `GET /health` and/or `GET /api/v1/health`                                                         |
| Start command                 | `uvicorn app.main:app --host 0.0.0.0 --port $PORT`                                                |
| Dockerfile                    | Optional; `backend/Dockerfile` exists as a foundation                                             |
| Secrets                       | Platform secret store / env — never in Git                                                        |
| Logging                       | Structured logs; no passwords, tokens, dosage text, or PHI in log bodies                          |
| Indexes                       | Run controlled init/migrations in prod; prefer `DATABASE_AUTO_INITIALIZE=false` after first setup |
| Migrations                    | Documented, idempotent; gate with `DATABASE_RUN_MIGRATIONS`                                       |
| Backups                       | MongoDB provider backups + restore drill                                                          |

## CORS note

The live Workers frontend origin above must appear **exactly** in `ALLOWED_ORIGINS`. Mismatched schemes/hosts break browser credentialed requests.

## Cookie note

See `docs/production-auth-cookie-and-cors.md` for SameSite / Secure combinations when frontend and API are cross-site.

## Current status

| Item                   | Value                                              |
| ---------------------- | -------------------------------------------------- |
| Backend URL            | `https://thyro-t1.onrender.com`                    |
| Health                 | `GET /health`, `GET /api/v1/health`                |
| Frontend origin (CORS) | `https://thyrot1.chinthakajayaweera1.workers.dev`  |
| Root directory         | `backend`                                          |
| Start command          | `uvicorn app.main:app --host 0.0.0.0 --port $PORT` |

After each `main` push, confirm Render deployed the matching commit (Manual Deploy if auto-deploy is delayed). Medication create requires the BSON date/time serialization fix (`to_bson_safe`).

## Trusted Render Shell commands

Knowledge seed ingestion (run twice to confirm idempotency; keeps `PENDING_REVIEW`):

```bash
python -m app.scripts.ingest_approved_knowledge
```

Privileged account provisioning (ADMIN / MEDICAL_EXPERT only; never commit passwords):

```bash
python -m app.scripts.create_privileged_user --role admin
python -m app.scripts.create_privileged_user --role medical_expert
```

Optional temporary password env for non-interactive shells (clear immediately after use):

- `PRIVILEGED_USER_PASSWORD`
- `PRIVILEGED_USER_PASSWORD_CONFIRM`

Public registration always creates `PATIENT` only. Do not expose privileged creation via HTTP.
