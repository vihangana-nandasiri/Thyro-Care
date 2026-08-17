# Medication architecture

Phase 8 — patient-owned medication tracking (not prescribing).

## Medical safety

Medication data is for **tracking and reminders only**. The system does not prescribe, recommend dosage, change dosage, interpret missed doses clinically, or guarantee treatment outcomes.

Disclaimer shown in the UI and API description:

> Medication information is for tracking purposes only. Follow your healthcare provider’s instructions. Do not change or stop medication without professional advice.

## API flow

Authenticated `PATIENT` → `/api/v1/medications*` → `MedicationService` → repositories → MongoDB.

| Method | Path                     | Purpose                          |
| ------ | ------------------------ | -------------------------------- |
| GET    | `/medications`           | List owned medications           |
| POST   | `/medications`           | Create                           |
| GET    | `/medications/schedule`  | Computed schedule (static route) |
| GET    | `/medications/adherence` | Adherence metrics (static route) |
| GET    | `/medications/{id}`      | Get one                          |
| PATCH  | `/medications/{id}`      | Update with `expected_version`   |
| DELETE | `/medications/{id}`      | Soft delete                      |
| POST   | `/medications/{id}/logs` | Record dose status               |
| GET    | `/medications/{id}/logs` | List logs for medication         |

All routes use `require_patient()`. `user_id` is never accepted from the client.

## Service flow

1. Validate schemas (forbid unknown / protected fields).
2. Derive owner from JWT subject.
3. Schedule service expands reminder times in medication timezone → UTC occurrences.
4. Adherence service counts TAKEN / MISSED / SKIPPED / unlogged against eligible past occurrences.
5. Audit writes event name + field names only.

## Repository flow

- `MedicationRepository`: create / list / get_owned / update_owned (version) / soft_delete_owned.
- `MedicationLogRepository`: create with unique `(medication_id, scheduled_for)`; list by range/medication.
- Every query includes `user_id` and excludes soft-deleted medications by default.

## Ownership

Foreign or missing IDs return **404** (no existence leak). Logs require medication ownership first.

## Schedule generation

- Read-only computation; does not persist occurrences.
- Max range: 31 days.
- Excludes AS_NEEDED, inactive/completed/discontinued, deleted, outside start/end dates.
- Does not auto-create MISSED logs.

## Log recording

Patient posts `scheduled_for` (UTC), `status` (`taken` | `missed` | `skipped`), optional `note`. Duplicate occurrence → **409**.

## Soft deletion

`is_deleted=true`, `deleted_at` set. Logs retained. Soft-deleted meds hidden from list/schedule/adherence.

## Version control

`version` starts at 1; PATCH requires matching `expected_version`; mismatch → **409**.

## Frontend integration

- `medicationService.ts` via authenticated Axios.
- `MedicationPage` + `useMedications` hook.
- Dashboard quick-stat adherence + Medication feature-card summary.
- No localStorage caching of medication payloads.
