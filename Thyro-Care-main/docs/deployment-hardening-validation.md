# Deployment hardening validation

Date: 2026-07-11

## Results

| Check                                   | Result                                                         |
| --------------------------------------- | -------------------------------------------------------------- |
| Initial `npm audit`                     | 4 (2 low, 2 high)                                              |
| Final `npm audit`                       | **0**                                                          |
| Final `npm audit --omit=dev`            | **0**                                                          |
| `npm run typecheck`                     | PASS (via `ci:build`)                                          |
| `npm run lint`                          | PASS (2 documented react-refresh warnings)                     |
| `npm run format:check`                  | PASS (via `ci:build`)                                          |
| `npm run build` / `ci:build`            | PASS                                                           |
| Backend `ruff check` / `format --check` | PASS                                                           |
| Backend `pytest`                        | **87 passed, 1 skipped**                                       |
| Wrangler version                        | **4.110.0**                                                    |
| `npm run cf:dry-run`                    | PASS — read `dist`, no Vite, `--autoconfig=false`              |
| `npm run cf:deploy`                     | PASS — Worker `thyrot1` uploaded                               |
| Live URL                                | https://thyrot1.chinthakajayaweera1.workers.dev                |
| Single-build verification               | Deploy logs show asset upload only; no Vite during `cf:deploy` |

## Production API URL status

- Frontend-only deploy: no `VITE_APP_ENV=production` / no public API URL embedded
- Bundle does not default to localhost in production mode
- Auth/API features need a live backend + rebuild with real `VITE_API_BASE_URL`

## Known warnings

- ESLint react-refresh (2 warnings)
- npm deprecated `recharts@2.15.2` (deferred migration)
- slowapi asyncio deprecation in pytest (backend transitive)

## Deferred work

- Recharts v3 migration
- Bundle size reduction
- FastAPI production hosting
- Set Cloudflare build env `VITE_API_BASE_URL` when backend is live
- Point Cloudflare build command to `npm run ci:build` and deploy to `npm run cf:deploy` in the dashboard if not already

## Phase boundary

This patch does not start Phase 9. No new medication/appointment/AI APIs were added in this commit.
