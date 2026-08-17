# Motor → PyMongo Async Migration

**Date:** 2026-07-11  
**Baseline:** Phase 4 commit `79323f7`

## Previous architecture (Motor)

- `motor.motor_asyncio.AsyncIOMotorClient`
- `AsyncIOMotorDatabase`
- Runtime deps: `motor` + `pymongo`

## New architecture

- `from pymongo import AsyncMongoClient`
- `pymongo.asynchronous.database.AsyncDatabase`
- Single client created in FastAPI lifespan; closed with `await client.close()`
- Explicit timeouts: server selection, connect, socket
- Runtime dep: `pymongo` only (`motor` removed)

## Lifecycle

1. Startup: `connect_to_mongo(settings)` → ping → store client/db on `mongo_state`
2. Optional: `initialize_database` (indexes/migrations)
3. Shutdown: `await close_mongo_connection()`

## Behavioral parity

- Development may start degraded if Mongo is down
- Production / `DATABASE_REQUIRE_CONNECTION` logs unhealthy connection failures
- Health endpoints still use async ping without exposing URI
- No dual clients

## Tests

- `test_no_motor_imports_in_application_code`
- `test_async_client_lifecycle_behavior`
- Existing health/middleware suite still passes

## Rollback considerations

Reintroducing Motor is not recommended (deprecated). If needed, restore Phase 4 `mongodb.py` and `motor` dependency from git history before Phase 5 commit.
