# Appointment lifecycle

Statuses are patient tracking labels only — not clinical events.

## Allowed transitions

| From      | To                             |
| --------- | ------------------------------ |
| upcoming  | completed, missed, cancelled   |
| missed    | upcoming, completed, cancelled |
| cancelled | upcoming                       |
| completed | upcoming (correction)          |

## Timestamps

- COMPLETED sets `completed_at`, clears `cancelled_at`
- CANCELLED sets `cancelled_at`, clears `completed_at`
- UPCOMING / MISSED clear both

## Explicit non-behaviors

- No automatic status change based on current time
- No automatic MISSED when start time passes
- No medical interpretation of MISSED
- No outbound reminders in Phase 9
