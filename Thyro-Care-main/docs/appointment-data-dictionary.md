# Appointment data dictionary

Never log title, notes, provider, location, or exact schedule values.

## Appointment fields

| Field                      | Type               | Required | Editable    | Notes            |
| -------------------------- | ------------------ | -------- | ----------- | ---------------- |
| `_id`                      | ObjectId           | yes      | no          | Primary key      |
| `user_id`                  | ObjectId           | yes      | no          | From JWT         |
| `appointment_type`         | enum               | yes      | yes         | Tracking label   |
| `title`                    | string             | yes      | yes         | 1–200            |
| `scheduled_start`          | datetime UTC       | yes      | yes         |                  |
| `scheduled_end`            | datetime UTC\|null | no       | yes         | After start      |
| `timezone`                 | IANA string        | yes      | yes         |                  |
| `location`                 | string\|null       | no       | yes         | ≤300             |
| `location_type`            | enum\|null         | no       | yes         |                  |
| `provider_name`            | string\|null       | no       | yes         | ≤200             |
| `notes`                    | string\|null       | no       | yes         | ≤1000            |
| `status`                   | enum               | yes      | yes         | Patient tracking |
| `completed_at`             | datetime\|null     | server   | lifecycle   |                  |
| `cancelled_at`             | datetime\|null     | server   | lifecycle   |                  |
| `reminder_offsets_minutes` | int[]              | no       | yes         | 0–43200, unique  |
| `version`                  | int                | yes      | concurrency | Starts 1         |
| soft-delete + timestamps   |                    |          |             | Standard         |

Public API omits `user_id` and soft-delete flags.
