# Appointment architecture

Phase 9 — patient-owned appointment tracking (organization only).

## Medical safety

Appointments are for personal organization. The system does not decide clinical follow-up, send real reminders, or interpret missed appointments medically.

Disclaimer:

> Appointment information is for personal organization only. Follow the schedule and instructions provided by your healthcare team.

## API flow

Authenticated PATIENT → `/api/v1/appointments*` → `AppointmentService` → repository → MongoDB.

Static routes `/calendar` and `/upcoming` are registered before `/{appointment_id}`.

## Ownership / soft-delete / concurrency

JWT `user_id` on every query. Soft-delete. `version` + `expected_version` → 409.

## Lifecycle

Patient-controlled status transitions via `appointment_lifecycle_service`. No automatic MISSED/COMPLETED from clock time.

## Frontend

`FollowUpPage` + `useAppointments`. Dashboard follow-up card uses upcoming summary. No localStorage.
