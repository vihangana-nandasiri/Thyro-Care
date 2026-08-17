# Symptom architecture (Phase 10)

## Overview

Patient-owned symptom tracking with structured yes/no safety checks and versioned deterministic rules. No AI, NLP, or free-text inference.

## Stack

- Collection: `symptoms` (`SymptomDocument`, soft-delete + `version`)
- Legacy: `symptom_logs` retained as foundation (not used by Phase 10 API)
- API: `/api/v1/symptoms` (PATIENT only)
- Safety rules: `backend/app/content/symptom_safety_rules.py` (`safety-rules-v1`)
- Service: `SymptomService` + `SymptomSafetyService`
- Frontend: `SymptomsPage`, `symptomService`, `useSymptoms`

## Ownership

`user_id` from JWT only. Same 404 for missing and foreign IDs.

## Safety flow

1. Client submits structured booleans (`SymptomSafetyAnswers`).
2. Rules evaluate; highest `SafetyLevel` wins; EMERGENCY overrides.
3. Persist `safety_level`, `safety_rule_version`, `safety_checked_at`.
4. EMERGENCY → `emergency_page_required` → Emergency page navigation.
5. Free-text `description` / `notes` never inspected.

## Concurrency & delete

Optimistic concurrency via `expected_version` (409). Soft delete excludes from lists.

## Audit

`SYMPTOM_*` events: field names, status, safety level, rule codes/version only — never notes or answers.
