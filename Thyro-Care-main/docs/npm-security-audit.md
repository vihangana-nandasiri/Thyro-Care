# npm security audit — deployment hardening

Date: 2026-07-11

## Initial findings

| Scope                  | Count             | Detail                                |
| ---------------------- | ----------------- | ------------------------------------- |
| `npm audit`            | 4 (2 low, 2 high) | eslint plugin-kit, react-router, vite |
| `npm audit --omit=dev` | 1 high            | react-router                          |

### Packages

| Package                           | Direct/transitive | Runtime/dev              | Severity | Fix approach                              |
| --------------------------------- | ----------------- | ------------------------ | -------- | ----------------------------------------- |
| `@eslint/plugin-kit` (via eslint) | transitive        | development              | low      | `npm audit fix` (non-force)               |
| `react-router@7.13.0`             | direct            | **runtime**              | high     | Targeted upgrade to `7.18.1` (same major) |
| `vite@6.3.5`                      | direct (dev)      | development (dev-server) | high     | Targeted upgrade to `6.4.3` (same major)  |

## Fixes applied

1. `npm audit fix` (no `--force`) — cleared eslint/plugin-kit low issues.
2. `npm install react-router@7.18.1`
3. `npm install --save-dev vite@6.4.3`
4. Updated `pnpm.overrides.vite` to `6.4.3`
5. `npm install --save-dev wrangler@4.110.0` (not an audit finding; deployment pin)

## Final audit

| Scope                  | Result                |
| ---------------------- | --------------------- |
| `npm audit`            | **0 vulnerabilities** |
| `npm audit --omit=dev` | **0 vulnerabilities** |

## Runtime exposure

- Production SPA ships `react-router` — patched to 7.18.1.
- Vite vulnerabilities are **dev-server** oriented; Vite is not shipped as an app dependency. Still patched to 6.4.3 for local/CI safety.

## Remaining / deferred

None from `npm audit` at time of writing. Recharts deprecation is **not** an npm advisory; tracked separately in `docs/recharts-v3-migration-plan.md`.
