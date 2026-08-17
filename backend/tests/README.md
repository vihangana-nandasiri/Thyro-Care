# Backend tests

## Default suite (no MongoDB required)

```powershell
cd backend
.\.venv\Scripts\Activate.ps1
pytest
```

Uses mocked Mongo connection for HTTP tests and unit tests for models/repositories/indexes.

## Optional integration suite

Requires a local MongoDB and an explicitly named test database ending in `_test`.

```powershell
$env:MONGODB_DATABASE="thyrocare_ai_test"
$env:DATABASE_TEST_NAME="thyrocare_ai_test"
pytest -m integration
```

Safety:

- Integration tests refuse database names that do not end with `_test`.
- Cleanup deletes only documents created by the test inside that database.
- Do not point integration tests at production databases.
