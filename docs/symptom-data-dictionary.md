# Symptom data dictionary (Phase 10)

| Field                       | Type                                          | Notes                         |
| --------------------------- | --------------------------------------------- | ----------------------------- |
| `_id`                       | ObjectId                                      | Public as `id`                |
| `user_id`                   | ObjectId                                      | Never exposed                 |
| `symptom_type`              | enum                                          | See SymptomType               |
| `custom_symptom_name`       | string\|null                                  | OTHER only; max 120           |
| `severity`                  | mild\|moderate\|severe                        | Required                      |
| `frequency`                 | once\|occasional\|daily\|frequent\|continuous | Required                      |
| `started_at`                | datetime UTC                                  | Required                      |
| `ended_at`                  | datetime UTC\|null                            | ≥ started_at                  |
| `timezone`                  | IANA string                                   | Required                      |
| `status`                    | active\|improving\|resolved                   | Tracking label                |
| `description`               | string\|null                                  | Max 1000; not used for safety |
| `notes`                     | string\|null                                  | Max 1000; not used for safety |
| `safety_level`              | SafetyLevel                                   | Server only                   |
| `safety_rule_version`       | string                                        | Server only                   |
| `safety_checked_at`         | datetime\|null                                | Server only                   |
| `version`                   | int ≥ 1                                       | Optimistic concurrency        |
| `is_deleted` / `deleted_at` | soft delete                                   | Hidden from clients           |
| `schema_version`            | int                                           | Persistence migration         |
| `created_at` / `updated_at` | datetime UTC                                  | Server managed                |

## SafetyLevel

`routine_tracking` | `contact_healthcare_team` | `urgent_medical_review` | `emergency`
