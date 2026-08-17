# Phase 8 — Validation

Date: 2026-07-11

## Backend

| Check                  | Result                   |
| ---------------------- | ------------------------ |
| `ruff check app tests` | PASS                     |
| `ruff format --check`  | PASS                     |
| `pytest tests`         | **87 passed, 1 skipped** |

## Frontend

| Check                  | Result                                      |
| ---------------------- | ------------------------------------------- |
| `npm run typecheck`    | PASS                                        |
| `npm run lint`         | PASS (2 react-refresh warnings, documented) |
| `npm run format:check` | PASS                                        |
| `npm run build`        | PASS                                        |

## Manual checks (documented expectations)

1. PATIENT login → `/medications` loads from API
2. Empty state for new patient
3. Create / edit / soft-delete persist across refresh
4. Schedule + Taken/Missed/Skipped logs persist
5. Adherence updates; future doses excluded; AS_NEEDED not auto-scheduled
6. Foreign medication IDs → 404
7. Version conflict → 409 UX
8. Disclaimer visible
9. No medication data in localStorage
10. Profile + auth still work
11. Dashboard adherence + medication card use live data
12. Phase 9 not started

## Known warnings

Frontend ESLint: 2 documented low-risk React Refresh warnings (`router.tsx`, `AuthContext.tsx`).

## Phase 9

**Not started.**
