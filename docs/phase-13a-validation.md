# Phase 13A validation checklist

## Automated (repository)

```bash
# Frontend
npm ci
npm audit
npm audit --omit=dev
npm run typecheck
npm run lint
npm run format:check
npm run build
npm run ci:build

# Backend
ruff check backend
ruff format --check backend
pytest backend/tests
```

Expected: existing suite remains green; Phase 13A adds coverage in
`backend/tests/test_phase13a_account_auth.py`. Frontend has no Vitest runner in
this repo; fragment handling lives in `src/utils/authTokenFragment.ts`.

## Manual after env configuration

Do **not** claim production recovery/Google works until:

1. Render: email + Google variables configured and service redeployed
2. Cloudflare: `VITE_GOOGLE_CLIENT_ID` set, build cache cleared, redeployed
3. Google Console: authorized JS origins include localhost + workers.dev
4. Controlled test mailbox: forgot → reset → login
5. Approved Google test user: sign-in creates PATIENT or returns conflict safely
6. Confirm tokens disappear from the address bar after SPA processing
7. Confirm refresh/CSRF cookies remain Secure / SameSite=None in production

## Feature flags (safe defaults)

All Phase 13A delivery features ship disabled:

- `EMAIL_DELIVERY_ENABLED=false`
- `EMAIL_VERIFICATION_ENABLED=false`
- `PASSWORD_RESET_ENABLED=false`
- `GOOGLE_AUTH_ENABLED=false`

## Out of scope

Phase 13B (dashboard analytics, reminders, AI provider integration) was **not**
started in this phase.
