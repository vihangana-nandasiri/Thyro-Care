# Deployment hardening summary

Date: 2026-07-11

## Initial deployment issues

- 4 npm vulnerabilities (2 low, 2 high)
- Wrangler not pinned; installed dynamically during cloud deploy
- No committed Wrangler config → auto-configuration risk
- Duplicate Vite builds (CI build + Wrangler build)
- `workers_dev` / `preview_urls` not explicit
- Cloudflare served static frontend only; backend not deployed
- Production API URL / CORS / cookies under-documented
- Deploy path lacked typecheck/lint/format gate
- Recharts 2.x deprecation warning
- Large chart/JS chunks

## Dependency fixes

- `npm audit fix` (no `--force`)
- `react-router` → `7.18.1`
- `vite` → `6.4.3`
- Final `npm audit`: **0** vulnerabilities

## Wrangler pinning

- `wrangler@4.110.0` in `devDependencies`
- Scripts use local binary; `--autoconfig=false` prevents setup wizard / auto-config

## Wrangler configuration

- Committed `wrangler.jsonc`: name `thyrot1`, assets `./dist`, SPA not-found handling, `workers_dev: true`, `preview_urls: false`, observability enabled
- No Wrangler build command

## Single-build deployment flow

1. `npm run ci:build` → typecheck, lint, format:check, **one** Vite build
2. `npm run cf:deploy` → upload `dist` only

## Production environment validation

- `src/config/env.ts` rejects localhost/127.0.0.1 in production bundles
- `VITE_APP_ENV=production` requires a non-loopback `VITE_API_BASE_URL`
- Frontend-only bundles may omit the URL (empty base; never localhost default)
- `.env.production.example` placeholders only

## Frontend / backend boundary

Cloudflare Worker deploys **static SPA only**. FastAPI remains undeployed until a separate host and secrets exist.

## Recharts decision

Deferred to `docs/recharts-v3-migration-plan.md` (major upgrade risk).

## Bundle decision

No performance claims; documented in `docs/frontend-bundle-review.md`. Charts remain route-lazy-loaded.

## Remaining risks

- Live auth/profile/medication APIs require a public backend + CORS/cookie setup
- Recharts 2 deprecation remains
- Large Recharts chunk remains
- Cross-site cookies on workers.dev may be restricted by browsers long-term
