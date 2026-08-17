# Phase 9 — Appointment & Follow-Up Plan

Date: 2026-07-11  
Workspace: `Thyro-Care-t1`  
Base commit: `995a7cec`

## Approved appointment fields

`_id`, `user_id`, `appointment_type`, `title`, `scheduled_start`, `scheduled_end` (optional), `timezone`, `location`, `location_type`, `provider_name`, `notes`, `status`, `completed_at`, `cancelled_at`, `reminder_offsets_minutes`, `created_at`, `updated_at`, `is_deleted`, `deleted_at`, `schema_version`, `version`.

## Appointment lifecycle

Patient-controlled tracking only — no automatic status from clock time.

- UPCOMING → COMPLETED | MISSED | CANCELLED
- MISSED → UPCOMING | COMPLETED | CANCELLED
- CANCELLED → UPCOMING (restore/reschedule)
- COMPLETED → UPCOMING (explicit correction only)

Set `completed_at` / `cancelled_at` accordingly; clear when inappropriate.

## Ownership strategy

All endpoints: `require_patient()`. Every query filters by JWT `user_id`. Foreign/missing IDs → identical 404. Never accept `user_id` from client.

## Timezone strategy

Reuse `backend/app/utils/timezone.py`. Store UTC; preserve IANA timezone on document; calendar items expose local date/time. Bound calendar ranges (max 62 days).

## Reminder-offset strategy

Non-negative unique sorted integers (minutes). Max count 10; max offset 30 days (43200). Persist only — **no SMS/email/push** in Phase 9.

## Soft-delete / concurrency / audit

Soft-delete default. `version` + `expected_version` → 409. Audit field names / status names only — never title, notes, provider, location, schedule values.

## Frontend integration

Wire `FollowUpPage.tsx` (route `/follow-ups`). Preserve design. Remove appointment mocks from Follow-Up + dashboard follow-up tile. Keep TSH history mock if not appointment CRUD. Hook `useAppointments` for dashboard next appointment.

## Test / push strategy

In-memory DB tests mirroring medication suite. Commit `feat: implement appointment and follow-up management` → `git push origin main`.

## Deferred / Phase 10 exclusions

Real reminders, Google/Outlook calendar, clinician accounts, symptoms, AI/RAG, backend public deploy.
