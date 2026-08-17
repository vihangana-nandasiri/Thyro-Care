"""Optional integration tests — require local MongoDB and DATABASE_TEST_NAME ending _test."""

from __future__ import annotations

import os

import pytest
from app.core.config import get_settings
from app.db.indexes import ensure_indexes
from app.db.mongodb import close_mongo_connection, connect_to_mongo, get_database, mongo_state
from app.models.user import UserDocument
from app.repositories.user_repository import UserRepository


def _require_test_database_name(name: str) -> None:
    if not name.endswith("_test"):
        raise RuntimeError("Refusing to run integration tests against non-test database")


@pytest.mark.integration
@pytest.mark.asyncio
async def test_integration_indexes_and_user_roundtrip() -> None:
    settings = get_settings()
    _require_test_database_name(settings.mongodb_database)
    _require_test_database_name(settings.database_test_name)

    # Prefer dedicated test DB name
    os.environ["MONGODB_DATABASE"] = settings.database_test_name
    get_settings.cache_clear()
    settings = get_settings()
    _require_test_database_name(settings.mongodb_database)

    await connect_to_mongo(settings)
    if not mongo_state.connected:
        pytest.skip("MongoDB not available for integration tests")

    db = get_database()
    assert db is not None
    assert db.name.endswith("_test")

    try:
        await ensure_indexes(db)
    except Exception as exc:  # noqa: BLE001
        # Local/Atlas credentials may allow ping but not createIndexes.
        if getattr(exc, "code", None) == 13:
            pytest.skip("MongoDB connected but not authorized to create indexes")
        raise
    repo = UserRepository(db)
    user = UserDocument(
        email_normalized="phase5.integration@example.com",
        email_display="phase5.integration@example.com",
        password_hash="not-a-real-hash",
        full_name="Integration User",
    )
    created = await repo.create_user_document(user)
    loaded = await repo.get_by_email_normalized(created.email_normalized)
    assert loaded is not None
    assert loaded.full_name == "Integration User"

    await repo.soft_delete(created.id)
    assert await repo.get_by_email_normalized(created.email_normalized) is None

    # Cleanup only inside *_test database
    await db[repo.collection_name].delete_many({"email_normalized": created.email_normalized})
    await close_mongo_connection()
