# Medication data dictionary

Privacy: patient-owned health-support data. Never log dosage text, medication name, instructions, notes, or prescriber text in application or audit logs.

## Medication

| Field                | Type           | Required    | Editable    | Validation                    | Privacy   | Purpose                     |
| -------------------- | -------------- | ----------- | ----------- | ----------------------------- | --------- | --------------------------- |
| `_id`                | ObjectId       | yes         | no          | server                        | internal  | Primary key                 |
| `user_id`            | ObjectId       | yes         | no          | from JWT                      | owner     | Ownership                   |
| `name`               | string         | yes         | yes         | 1–200                         | sensitive | Patient label               |
| `dosage_text`        | string         | yes         | yes         | 1–200                         | sensitive | Patient-entered dosage text |
| `frequency`          | enum           | yes         | yes         | MedicationFrequency           | support   | Schedule pattern            |
| `reminder_times`     | string[]       | conditional | yes         | HH:mm unique sorted           | support   | Local times                 |
| `instructions`       | string\|null   | no          | yes         | ≤1000                         | sensitive | Patient notes               |
| `start_date`         | date           | yes         | yes         | ISO date                      | support   | Active from                 |
| `end_date`           | date\|null     | no          | yes         | ≥ start_date                  | support   | Active until                |
| `status`             | enum           | yes         | yes         | active/completed/discontinued | support   | Lifecycle                   |
| `prescribed_by_text` | string\|null   | no          | yes         | ≤200                          | sensitive | Free-text label             |
| `notes`              | string\|null   | no          | yes         | ≤1000                         | sensitive | Patient notes               |
| `timezone`           | string         | yes         | yes         | IANA                          | support   | Schedule TZ                 |
| `created_at`         | datetime UTC   | yes         | no          | server                        | meta      | Audit                       |
| `updated_at`         | datetime UTC   | yes         | no          | server                        | meta      | Audit                       |
| `is_deleted`         | bool           | yes         | soft-delete | server                        | meta      | Soft delete                 |
| `deleted_at`         | datetime\|null | no          | soft-delete | server                        | meta      | Soft delete                 |
| `schema_version`     | int            | yes         | no          | server                        | meta      | Migrations                  |
| `version`            | int            | yes         | concurrency | starts 1                      | meta      | Optimistic lock             |

Public API exposes `id` (not `_id`) and omits `user_id`, soft-delete, and `schema_version`.

## Medication log

| Field            | Type         | Required | Editable  | Validation           | Privacy   | Purpose              |
| ---------------- | ------------ | -------- | --------- | -------------------- | --------- | -------------------- |
| `_id`            | ObjectId     | yes      | no        | server               | internal  | Primary key          |
| `user_id`        | ObjectId     | yes      | no        | from JWT             | owner     | Ownership            |
| `medication_id`  | ObjectId     | yes      | no        | owned med            | support   | Parent               |
| `scheduled_for`  | datetime UTC | yes      | create    | occurrence           | support   | Unique with med      |
| `recorded_at`    | datetime UTC | yes      | no        | server               | meta      | When logged          |
| `status`         | enum         | yes      | create    | taken/missed/skipped | support   | Dose state           |
| `note`           | string\|null | no       | create    | ≤500                 | sensitive | Optional note        |
| `created_at`     | datetime UTC | yes      | no        | server               | meta      | Audit                |
| `schema_version` | int          | yes      | no        | server               | meta      | Migrations           |
| `version`        | int          | yes      | if update | starts 1             | meta      | Optional concurrency |

## Frequency enum

`once_daily`, `twice_daily`, `three_times_daily`, `four_times_daily`, `weekly`, `as_needed`, `custom`.

AS_NEEDED does not auto-generate schedule occurrences. CUSTOM requires reminder times.
