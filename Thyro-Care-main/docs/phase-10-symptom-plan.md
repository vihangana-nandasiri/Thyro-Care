# Phase 10 — Symptom Tracking and Deterministic Safety Escalation Plan

## Scope

Patient-owned symptom CRUD with structured yes/no safety checks, versioned deterministic rules, Emergency page escalation, soft delete, optimistic concurrency, and privacy-preserving audits. No AI/NLP/RAG, no diagnosis, no treatment advice, no notifications.

**Out of scope (Phase 11+):** chatbot, lab interpretation, medication recommendations, real emergency dialing, clinician workflows.

## Approved symptom fields

| Field                                                  | Client                     | Server                                       |
| ------------------------------------------------------ | -------------------------- | -------------------------------------------- |
| symptom_type                                           | yes                        | required                                     |
| custom_symptom_name                                    | yes (OTHER only)           | bounded                                      |
| severity                                               | yes                        | MILD / MODERATE / SEVERE                     |
| frequency                                              | yes                        | enum                                         |
| started_at / ended_at                                  | yes                        | UTC; end ≥ start                             |
| timezone                                               | yes                        | IANA                                         |
| status                                                 | yes                        | ACTIVE / IMPROVING / RESOLVED                |
| description / notes                                    | yes                        | optional, bounded; **never used for safety** |
| safety_answers                                         | yes (structured bools)     | evaluated server-side                        |
| safety_level / safety_rule_version / safety_checked_at | **no**                     | server only                                  |
| version                                                | expected_version on update | optimistic concurrency                       |
| user_id                                                | **never**                  | from auth                                    |

## Ownership strategy

- All routes require active `PATIENT`.
- `user_id` derived from authenticated user only.
- Queries always include `user_id`; missing and foreign IDs return the same safe 404.
- Admin / medical_expert denied (403).

## Symptom lifecycle

- Create → ACTIVE (default) with safety assessment persisted.
- Update → field edits; re-run safety only when `safety_answers` provided.
- Status → ACTIVE / IMPROVING / RESOLVED (`ended_at` set on resolve when supplied or now).
- Soft delete → `is_deleted=true`; excluded from lists.

Legacy `symptom_logs` / `SymptomGuidanceLevel` remain foundation artifacts; Phase 10 uses collection `symptoms` and `SafetyLevel`.

## Safety-check architecture

1. Client submits explicit boolean answers only.
2. `SymptomSafetyService` evaluates versioned rules in deterministic order.
3. Highest applicable `SafetyLevel` wins; EMERGENCY overrides all.
4. Response uses approved constants only (headline, message, action, disclaimer).
5. Free-text description/notes are never inspected.

## Approved-content boundary

- Emergency page: preserve existing design and “call 911” messaging; do not invent new country numbers.
- Safety question wording aligned with existing Emergency warning themes (breathing, chest discomfort, neck swelling, swallowing, bleeding, confusion, rapid worsening).
- Content marked **REVIEW_REQUIRED** in `docs/symptom-safety-content-review.md` until medical-expert sign-off.
- Routine wording must never claim the user is “safe.”

## Rule-versioning strategy

- Rules live in `backend/app/content/symptom_safety_rules.py` as frozen data + version string (e.g. `safety-rules-v1`).
- Each rule has stable `rule_code`, required boolean predicates, and target `SafetyLevel`.
- No DB-executable rules, no `eval`, no free-text matching.
- Rule version stored on each symptom assessment and returned in API responses.

## No-free-text-inference rule

Safety classification uses only structured booleans + versioned rules. Symptom type alone does not set EMERGENCY unless an approved structured rule says so (v1 rules use answers only).

## Emergency escalation strategy

- `safety_level == EMERGENCY` → `emergency_page_required=true`.
- Frontend shows prominent alert + link to `/emergency`.
- App states it cannot contact emergency services.
- Persistence of the symptom entry must not block navigating to Emergency.

## Soft-delete / optimistic concurrency

- Mirror medications/appointments: `SoftDeletableDocument`, `expected_version`, 409 conflict message.
- Atomic updates increment `version` and `updated_at`.

## Audit strategy

Events: `SYMPTOM_CREATED`, `SYMPTOM_UPDATED`, `SYMPTOM_STATUS_CHANGED`, `SYMPTOM_DELETED`, `SYMPTOM_SAFETY_CHECKED`.

Allowed: actor id, entity id, request id, field names, status, safety_level, matched_rule_codes, rule_version.

Forbidden: custom name, description, notes, raw answers, exact symptom timestamps, tokens, full bodies.

## Frontend integration

- Preserve Symptoms page layout (tiles, severity card, colors, animations).
- Replace mock assessment / AI copy with safety assessment + history list.
- Map UI severity control to MILD/MODERATE/SEVERE.
- React Hook Form + Zod; conflict/empty/loading/error states.
- Dashboard “Symptom Check” card: active count / recent summary only (no notes).
- Remove `mockSymptoms` / `mockSymptomRecommendations` consumers; keep Emergency mocks (approved UI content).

## Test strategy

Schema, safety rules (every branch), repository ownership/version/soft-delete, API auth/ownership/409/422, audit privacy, regression of auth/profile/meds/appointments/health. MemoryDatabase only.

## Git push strategy

Commit on `main`: `feat: implement symptom tracking and safety escalation`. Push to `https://github.com/jkchinthaka/thyro_t1.git`. Force-with-lease only if remote is obsolete unrelated history.

## Deferred Phase 11

AI chatbot, RAG, lab interpretation, notifications, clinician review queues, executable clinical rule editors.
