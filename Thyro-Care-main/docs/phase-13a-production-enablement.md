# Phase 13A production enablement status

This note tracks live enablement after commit `6fb3188e9`.
It does **not** claim features work until Render + Cloudflare + providers are configured.

## Live findings (agent probe)

| Check                                           | Result                                                                               |
| ----------------------------------------------- | ------------------------------------------------------------------------------------ |
| Git `main` / `origin/main`                      | `6fb3188e9`                                                                          |
| Backend `/health` + `/api/v1/health`            | HTTP 200; API reports `database_status=connected`                                    |
| Render OpenAPI auth surface                     | Still pre-13A: login/logout/me/refresh/register only                                 |
| `POST /api/v1/auth/forgot-password`             | **404** — Phase 13A backend **not deployed**                                         |
| Frontend SPA routes (forgot/reset/verify/legal) | Present in live bundle                                                               |
| Active API host string                          | Exact `https://thyro-t1.onrender.com/api/v1` present; **no** doubled `.onrender.com` |
| `VITE_GOOGLE_CLIENT_ID` in live bundle          | Not embedded (Google button remains disabled)                                        |
| Google Client Secret in bundle                  | Not found                                                                            |

## Manual actions required (operator)

### 1. Render — deploy latest `main`

Confirm Root Directory `backend`, build/start/health as documented.
Deploy commit `6fb3188e9` (or newer). Do not print env values.

### 2. Render — set Phase 13A variables (presence only)

Core: `APP_ENVIRONMENT`, `DEBUG`, `ALLOWED_ORIGINS`, `MONGODB_URI`, `MONGODB_DATABASE`,
`JWT_SECRET_KEY`, `COOKIE_SECURE`, `COOKIE_SAMESITE`, `FRONTEND_PUBLIC_URL`

Email (only when real SMTP credentials exist):
`EMAIL_DELIVERY_ENABLED`, `EMAIL_PROVIDER`, `SMTP_*`, `EMAIL_VERIFICATION_*`, `PASSWORD_RESET_*`

Google (only when Web Client ID exists):
`GOOGLE_AUTH_ENABLED`, `GOOGLE_CLIENT_ID`

Expected non-secret values:
`APP_ENVIRONMENT=production`, `DEBUG=false`,
`ALLOWED_ORIGINS=https://thyrot1.chinthakajayaweera1.workers.dev`,
`COOKIE_SECURE=true`, `COOKIE_SAMESITE=none`,
`FRONTEND_PUBLIC_URL=https://thyrot1.chinthakajayaweera1.workers.dev`

### 3. Cloudflare Build variables

`VITE_API_BASE_URL=https://thyro-t1.onrender.com/api/v1`
`VITE_APP_ENV=production`
`VITE_APP_NAME=ThyroCare AI`
`VITE_GOOGLE_CLIENT_ID=<same Web Client ID as Render>`

Clear build cache, rebuild from latest `main`, deploy.

### 4. Google Cloud Console

Authorized JavaScript origins:
`http://localhost:5173`
`https://thyrot1.chinthakajayaweera1.workers.dev`

### 5. Controlled mailbox + Google test user

Re-run email verification, password reset, change-password, and Google E2E
only after steps 1–4. Do not log tokens, passwords, or mailbox addresses.

## Safe probe scripts

- `scripts/phase13a_live_probe.py` — presence checks only
- `scripts/check_live_frontend_bundle.py` — API URL / localhost checks
- `scripts/run_privileged_e2e.ps1` + `scripts/privileged_production_e2e.py` —
  interactive privileged governance smoke (credentials via prompt/env)

Phase 13B is out of scope.
