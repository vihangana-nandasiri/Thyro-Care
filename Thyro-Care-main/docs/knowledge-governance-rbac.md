# Knowledge governance RBAC (Phase 12)

## Roles

`UserRole` (`app/models/enums.py`): `PATIENT`, `ADMIN`, `MEDICAL_EXPERT`. Governance uses all three; PATIENT is always denied.

## Permission matrix

| Action                                                 | ADMIN  | MEDICAL_EXPERT | PATIENT                                                      |
| ------------------------------------------------------ | ------ | -------------- | ------------------------------------------------------------ |
| List/view governance documents, versions, review queue | Yes    | Yes            | No (403)                                                     |
| Create / edit drafts                                   | Yes    | No             | No                                                           |
| Submit for review                                      | Yes    | No             | No                                                           |
| Create new draft version from approved                 | Yes    | No             | No                                                           |
| Approve / request changes / reject                     | **No** | Yes            | No                                                           |
| Retire approved content                                | Yes    | Yes            | No                                                           |
| Restore retired content                                | No     | Yes            | No                                                           |
| Read append-only review history                        | Yes    | Yes            | No                                                           |
| Patient retrieval of drafts / review comments          | No     | No             | No (never exposed to anyone via patient APIs)                |
| Patient retrieval of APPROVED chunks                   | N/A    | N/A            | Yes (existing `/api/v1/chat`, `/api/v1/knowledge` retrieval) |

ADMIN cannot approve, request changes, reject, or restore under any condition — this is enforced by dependency injection, not just hidden in the UI.

## Enforcement

`app/api/dependencies.py`:

```python
require_patient = require_roles(UserRole.PATIENT)
require_admin = require_roles(UserRole.ADMIN)
require_medical_expert = require_roles(UserRole.MEDICAL_EXPERT)
require_admin_or_medical_expert = require_roles(UserRole.ADMIN, UserRole.MEDICAL_EXPERT)

# Phase 12 knowledge governance role aliases — same authorization, clearer intent at call sites.
require_knowledge_manager = require_admin
require_knowledge_reviewer = require_medical_expert
```

`app/api/v1/knowledge_governance.py` wires these into route-level dependencies:

| Dependency alias    | Resolves to                                   | Used for                                 |
| ------------------- | --------------------------------------------- | ---------------------------------------- |
| `KnowledgeManager`  | `require_knowledge_manager` (ADMIN)           | create/update draft, submit, new version |
| `KnowledgeReviewer` | `require_knowledge_reviewer` (MEDICAL_EXPERT) | review decisions, restore                |
| `KnowledgeViewer`   | `require_admin_or_medical_expert`             | list/detail/compare/review-history reads |
| `KnowledgeRetirer`  | `require_admin_or_medical_expert`             | retire                                   |

Role checks run on every request via FastAPI `Depends`; there is no code path in the governance service layer that bypasses them. A denied request is recorded via `AuditActions.AUTHORIZATION_DENIED` before the 403 is raised.

## Actor identity

Actor (`user_id`, `role`) is always derived from the verified JWT access token (`get_current_user` → `AuthService.get_user_for_claims`), never from a client-supplied field. All governance request schemas use `model_config = ConfigDict(extra="forbid")`, so an unexpected `actor_user_id`/`reviewer_user_id` field in a request body is rejected outright rather than silently accepted.

## Frontend enforcement (convenience only, not authoritative)

- `RoleProtectedRoute` gates `/admin/knowledge*` to `role === "admin"` and `/medical-review*` to `role === "medical_expert"` (`src/app/router.tsx`).
- Sidebar navigation (`src/constants/navigation.ts`) only renders governance links for the matching role.
- These are UX conveniences; the backend dependency layer above is the sole source of truth. A patient or admin who calls a MEDICAL_EXPERT-only endpoint directly still receives 403 from the API regardless of frontend routing.

## Patient isolation

Patient-facing routers (`app/api/v1/chat.py`, patient knowledge retrieval) never import or call `KnowledgeGovernanceService`/`KnowledgeGovernanceRepository`. They read only from `knowledge_chunks` filtered to `review_status == APPROVED and active`, so there is no code path by which a patient session can observe a draft, a pending-review item, review comments, or a rejection reason.
