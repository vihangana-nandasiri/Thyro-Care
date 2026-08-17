# Phase 8 — Medication Management Plan

Date: 2026-07-11  
Workspace: `Thyro-Care-t1`

## Baseline (pre-implementation)

| Check                                      | Result                          |
| ------------------------------------------ | ------------------------------- |
| Backend ruff / format / pytest             | PASS (75 passed, 1 skipped)     |
| Frontend typecheck / lint / format / build | PASS (2 react-refresh warnings) |

## Medication field scope

Editable / create: name, dosage_text, frequency, reminder_times, instructions, start_date, end_date, status, prescribed_by_text, notes, timezone (+ expected_version on update).

Tracking-only: dosage is patient-entered text; no clinical dosage engine.

## Dose-log scope

TAKEN / MISSED / SKIPPED per medication occurrence (`scheduled_for` UTC). Optional note. Unique `(medication_id, scheduled_for)`.

## Ownership strategy

All endpoints require `require_patient()`. Every query filters by authenticated `user_id`. Foreign IDs → 404.

## Schedule strategy

Computed on read from reminder_times + medication timezone. No auto-persist of occurrences. Bound date ranges (max 31 days). AS_NEEDED excluded. Inactive/deleted excluded. No auto-missed generation.

## Timezone strategy

IANA via `zoneinfo`. Store logs in UTC; preserve medication.timezone. Dev default may be browser-detected on FE; backend rejects invalid names.

## Adherence formula

`taken / eligible × 100` where eligible = past scheduled occurrences excluding AS_NEEDED, deleted, outside date range, and future times.

- TAKEN → numerator
- MISSED → eligible, not taken
- SKIPPED → excluded from denominator (intentional non-clinical skip)
- Unlogged past → eligible, not taken (`unlogged_count`)
- Null percentage when denominator is 0

No clinical interpretation in API or UI copy.

## Soft-delete strategy

Medications soft-deleted; logs retained. Soft-deleted meds excluded from list/schedule/adherence.

## Optimistic concurrency

Medication `version` + `expected_version` on PATCH; atomic `$inc`. Conflict → 409.

## Audit strategy

MEDICATION_CREATED / UPDATED / DELETED / LOG_RECORDED (+ LOG_UPDATED if used). Field names only — never name, dosage, notes, instructions.

## Frontend integration

Replace MedicationPage mocks with schedule + list + adherence APIs. Preserve card/chart layout. Neutral dose logging. Medical disclaimer. No localStorage. Dashboard: no medication section today → no new cards.

## Test strategy

Schemas, timezone, schedule, adherence, repos, ownership, API authz, audit field-name-only. In-memory DB; no Atlas.

## Deferred

Appointments, symptoms, AI/RAG, SMS/email reminders, pharmacy, prescription uploads, clinician approval, dosage recommendations.

## Implementation order

1. Enums + models + indexes
2. Schemas + timezone utils
3. Schedule + adherence services
4. Repositories + medication service + API
5. Backend tests
6. Frontend types/service/schemas/page
7. Docs + validate + commit/push
