# Repository architecture

## Layers

| Layer               | Responsibility                                            |
| ------------------- | --------------------------------------------------------- |
| Routes (future)     | HTTP only — never touch collections                       |
| Services (future)   | Business workflows, authz                                 |
| Domain repositories | Ownership-aware queries                                   |
| BaseRepository      | Shared async CRUD, soft-delete, pagination, error mapping |
| PyMongo Async       | Driver / wire protocol                                    |

## Base repository

- Typed generic over Pydantic document models
- Soft-delete filter by default when `supports_soft_delete`
- Bounded pagination (`MAX_PAGE_SIZE = 100`)
- Rejects top-level `$` operators from untrusted query maps
- Maps DuplicateKey / connectivity / InvalidId to repository exceptions

## Domain repositories

Examples: `UserRepository`, `MedicationRepository.get_owned_by_id(id, user_id)`, `KnowledgeRepository.list_approved_active()`.

Patient-owned reads always include `user_id`.

## Dependencies

`app/api/dependencies.py` exposes `get_database()` and repository factories. Missing DB → `ServiceUnavailableException`. Overridable in tests via FastAPI `dependency_overrides`.

## Why routes must not access collections

Bypassing repositories skips ownership filters, soft-delete defaults, validation, and exception mapping — the primary security boundary for multi-tenant patient data.
