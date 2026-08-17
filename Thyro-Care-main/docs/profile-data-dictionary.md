# Profile Data Dictionary

## Account (`users`) — read-only on profile API

| Field          | Type     | Notes                               |
| -------------- | -------- | ----------------------------------- |
| id             | string   | Public user id                      |
| full_name      | string   | Display name                        |
| email          | string   | Display email                       |
| role           | string   | Always `patient` for self endpoints |
| account_status | string   | Active / inactive / …               |
| email_verified | bool     |                                     |
| created_at     | datetime | UTC                                 |

## Profile (`patient_profiles`)

| Field                         | Editable    | Notes                                    |
| ----------------------------- | ----------- | ---------------------------------------- |
| age_range                     | yes         | Enum                                     |
| preferred_language            | yes         | Enum                                     |
| surgery_date                  | yes         | Date; not > 1 year future                |
| rai_treatment_status          | yes         | Enum                                     |
| treatment_stage               | yes         | Enum                                     |
| emergency_contact_name        | yes         | Optional, max 120                        |
| emergency_contact_phone       | yes         | Optional, normalized                     |
| current_medication_summary    | yes         | Optional free text, max 500              |
| consent_accepted / \_at       | no          | Set at registration                      |
| disclaimer_accepted / \_at    | no          | Set at registration                      |
| version                       | concurrency | Integer; client sends `expected_version` |
| profile_completion_percentage | computed    | Not stored                               |

## Not stored

National ID, exact home address, laboratory results, uploaded records, diagnosis / TNM staging, passwords, tokens.
