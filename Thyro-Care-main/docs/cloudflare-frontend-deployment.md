# Cloudflare frontend deployment

## Identifiers

| Item                       | Value                                           |
| -------------------------- | ----------------------------------------------- |
| GitHub repository          | https://github.com/jkchinthaka/thyro_t1.git     |
| Worker name                | `thyrot1`                                       |
| Production workers.dev URL | https://thyrot1.chinthakajayaweera1.workers.dev |
| Config file                | `wrangler.jsonc` (committed)                    |
| Wrangler version           | `4.110.0` (devDependency)                       |

## Important boundary

**Cloudflare static asset deployment does not deploy FastAPI.**  
The Worker serves only the Vite `dist/` SPA. Authentication, profile, and medication APIs require a separately hosted backend.

## Required Cloudflare project settings

| Setting                   | Value                              |
| ------------------------- | ---------------------------------- |
| Build command             | `npm run ci:build`                 |
| Deploy command            | `npm run cf:deploy`                |
| Output / assets directory | `dist`                             |
| Node version              | 20+ (validated locally on Node 24) |

`ci:build` runs typecheck → lint → format:check → **one** Vite build.  
`cf:deploy` runs `wrangler deploy --autoconfig=false` and **must not** run Vite again.

## Environment variables (build-time)

Set in the Cloudflare build environment (not committed):

| Variable            | Required when      | Notes                                                                                                        |
| ------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------ |
| `VITE_API_BASE_URL` | yes for production | Exactly `https://thyro-t1.onrender.com/api/v1` (**Never localhost.** Never append an extra `.onrender.com`.) |
| `VITE_APP_NAME`     | recommended        | `ThyroCare AI`                                                                                               |
| `VITE_APP_ENV`      | yes for production | `production`                                                                                                 |

These must be **Cloudflare build variables** (Vite compile time), not Worker runtime secrets. Do not put MongoDB/JWT/Render secrets in any `VITE_*` variable.

Vite embeds these into the JS bundle at **build** time. Changing them requires a new build and deploy. A malformed value such as `https://thyro-t1.onrender.com.onrender.com/api/v1` breaks all API calls.

**Dashboard checklist (Workers Builds / Cloudflare build env):** set the three variables above exactly. Do not set them as Worker runtime secrets. After correcting dashboard values, trigger a clean production rebuild so auto-deploys stop shipping a broken API base URL.

See `.env.production.example`. Do not commit `.env.production`.

### Production API

Backend: `https://thyro-t1.onrender.com` (Render Web Service, root directory `backend`).
Frontend builds must set `VITE_API_BASE_URL=https://thyro-t1.onrender.com/api/v1`. Production bundles **never** fall back to localhost.

## SPA fallback

`wrangler.jsonc` sets `assets.not_found_handling` to `single-page-application` so routes like `/login` and `/profile` refresh correctly.

## workers_dev / preview_urls

- `workers_dev: true` — serves on `*.workers.dev`
- `preview_urls: false` — preview URLs disabled explicitly

## Redeploy

- Push to `main` (if Git integration is connected), or
- Locally: `npm run ci:build` then `npm run cf:deploy` (requires Cloudflare auth)

## Rollback

Use the Cloudflare dashboard → Workers → `thyrot1` → Deployments → rollback to a previous version.

## Logs

Cloudflare dashboard → Workers → `thyrot1` → Logs / Observability (`observability.enabled` is true in config).

## Verify a single build

1. Cloudflare build logs should show one Vite build via `ci:build`.
2. Deploy logs for `cf:deploy` / Wrangler should **not** show `vite build`.
3. Local dry-run: `npm run cf:dry-run` after `npm run build` — Wrangler must not invoke Vite.
