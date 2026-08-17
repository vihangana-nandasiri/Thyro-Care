# Phase 12 — Validation

**Date:** 2026-07-12  
**Workspace:** `C:\Users\chint\OneDrive\Desktop\nivesha akka tec\Thyro-Care-t1`  
**Branch:** `main`

## Automated frontend

| Check                  | Result                                       |
| ---------------------- | -------------------------------------------- |
| `npm ci`               | PASS (baseline)                              |
| `npm audit`            | PASS — 0 vulnerabilities                     |
| `npm audit --omit=dev` | PASS — 0 vulnerabilities                     |
| `npm run typecheck`    | PASS                                         |
| `npm run lint`         | PASS (2 pre-existing react-refresh warnings) |
| `npm run format:check` | PASS                                         |
| `npm run build`        | PASS                                         |
| `npm run ci:build`     | PASS                                         |

## Automated backend

| Check                         | Result                           |
| ----------------------------- | -------------------------------- |
| `ruff check backend`          | PASS                             |
| `ruff format --check backend` | PASS                             |
| `pytest backend/tests`        | PASS — **121 passed, 1 skipped** |

## Governance coverage (automated)

| Area                                                   | Result |
| ------------------------------------------------------ | ------ |
| PATIENT denied governance endpoints                    | PASS   |
| ADMIN draft create/update/submit; ADMIN cannot approve | PASS   |
| MEDICAL_EXPERT approve / request_changes / reject      | PASS   |
| Content-hash mismatch → 409                            | PASS   |
| OCC expected_version → 409                             | PASS   |
| Approval creates review record + approved chunks       | PASS   |
| Retire/restore cycle                                   | PASS   |
| Seed files remain `pending_review` (not auto-approved) | PASS   |
| Diff/compare service                                   | PASS   |
| Governance indexes defined                             | PASS   |

## Manual checklist (role consoles)

Manual browser validation against a live API depends on local backend + seeded ADMIN/MEDICAL_EXPERT accounts. Automated API tests cover the same authorization and workflow transitions. Recommended manual smoke when a backend is available:

1. ADMIN: `/admin/knowledge` create → edit → submit; confirm no Approve control.
2. MEDICAL_EXPERT: `/medical-review` inspect → request changes → ADMIN edit/resubmit → approve with confirmation text + content hash.
3. Confirm patient chat/knowledge still only retrieves APPROVED content.
4. Confirm 409 conflict messages and ingestion-failure messaging when applicable.

## Deployment notes

- FastAPI backend is **not** publicly deployed (no production credentials in this phase).
- Frontend gained admin/medical-review pages; Cloudflare Worker redeploy (`npm run cf:deploy`) is a separate action after push if live SPA should expose the consoles.
- Seed knowledge remains **PENDING_REVIEW** until MEDICAL_EXPERT approval.

## Phase 13

**Not started.**
