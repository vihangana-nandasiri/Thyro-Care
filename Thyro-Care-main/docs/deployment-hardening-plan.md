# Deployment hardening plan

Date: 2026-07-11  
Workspace: `Thyro-Care-t1`  
Branch: `main` @ `023031e9`  
Live frontend: `https://thyrot1.chinthakajayaweera1.workers.dev`  
Worker name: `thyrot1`

## Scope boundary

This patch is **deployment and production configuration only**.

- Do not begin a new development phase.
- Do not add medication/appointment/AI APIs in this patch.
- Do not modify FastAPI domain behavior.
- Do not deploy the FastAPI backend without provider credentials.
- Phase 8 medication work already exists on `main` from a prior commit; this patch must not expand it.

## Current deployment flow

1. Cloudflare Pages/Workers build runs `npm run build` (Vite) once.
2. Deploy step previously used dynamic `npx wrangler` without a committed config.
3. Wrangler auto-generated project config and may have triggered a second build.
4. Only the static `dist/` frontend is uploaded to Worker `thyrot1`.
5. FastAPI is **not** part of this Cloudflare static deployment.

## Why Wrangler auto-configuration occurred

- No committed `wrangler.jsonc` / `wrangler.toml` / `wrangler.json` in the repo.
- Wrangler was not a project `devDependency`.
- Cloudflare/npx installed Wrangler ephemerally and ran setup defaults (including possible package.json / .gitignore edits and build hooks).

## Why the build ran twice

Likely combination of:

1. Cloudflare **Build command** running `npm run build`.
2. Wrangler deploy config (or auto-config) also declaring a **build** step that re-ran Vite.

Target model:

1. Cloudflare build command → `npm run ci:build` (quality gate + single Vite build → `dist/`).
2. Deploy command → `npm run cf:deploy` (`wrangler deploy` only; **no** Vite build).

## Vulnerability findings (initial)

| Area                   | Count             | Notes                                                              |
| ---------------------- | ----------------- | ------------------------------------------------------------------ |
| Full `npm audit`       | 4 (2 low, 2 high) | eslint plugin-kit (dev), react-router (runtime), vite (dev-server) |
| `npm audit --omit=dev` | 1 high            | `react-router@7.13.0`                                              |

### Runtime vs development

- **Runtime (shipped):** `react-router` high — must address with compatible patch within v7 if possible without `--force` major jumps outside intentional pin.
- **Development:** `@eslint/plugin-kit` / `eslint` (low), `vite` (high, primarily **dev server** exposure) — fix with safe minor/patch bumps where `npm audit fix` (non-force) or targeted installs allow.

## Wrangler configuration strategy

- Pin `wrangler@4.110.0` in `devDependencies`.
- Commit a single `wrangler.jsonc` with:
  - `name: "thyrot1"`
  - `compatibility_date`
  - `assets.directory: "./dist"`
  - SPA not-found handling
  - `workers_dev: true`
  - `preview_urls: false`
  - No Wrangler `build` command
- Ignore `.wrangler`, `dist`, `node_modules`, `.env*` (keep examples).

## Production environment strategy

- Strengthen `src/config/env.ts`: production must require `VITE_API_BASE_URL`, reject localhost / 127.0.0.1 / invalid URLs (throw at build/module init).
- Add `.env.production.example` placeholders only.
- Do **not** commit `.env.production` or a fake live API URL.
- Document that Vite embeds env at **build time**.

## Backend deployment boundary

Cloudflare Workers static assets ≠ FastAPI. Backend requires a separate HTTPS host, MongoDB, JWT secret, CORS with exact frontend origin, secure cookies. Document checklist only; do not deploy backend in this patch.

## CORS and cookie requirements

Document same-site vs cross-site vs local. Live frontend origin:

`https://thyrot1.chinthakajayaweera1.workers.dev`

must be listed exactly in backend `ALLOWED_ORIGINS` when a backend is live. Cross-site cookies need `COOKIE_SECURE=true` and an appropriate `SameSite` (often `None` for cross-site) — do not blindly change code without final domain plan.

## Recharts migration decision

- Current: `recharts@2.15.2` (deprecated, latest line is v3.x).
- Attempt controlled v3 upgrade only if typecheck/build and chart APIs migrate without redesign.
- Otherwise keep v2, document `docs/recharts-v3-migration-plan.md` as deferred debt.

## Bundle review

- Note large Recharts chunk (~384 kB) and main JS (~347 kB).
- Only low-risk lazy-loading / import hygiene; no chart library replacement for size alone.
- Record before/after in `docs/frontend-bundle-review.md` if any change is applied.

## Validation strategy

1. Safe `npm audit fix` / targeted pins → typecheck, lint, format, build after each change.
2. `npm ci` + `npm run ci:build`.
3. Backend ruff + pytest regression (no domain changes expected).
4. `wrangler deploy` dry-run.
5. Live `npm run cf:deploy` only after local validation.
6. Docs + commit `chore: harden Cloudflare frontend deployment` + normal push.
