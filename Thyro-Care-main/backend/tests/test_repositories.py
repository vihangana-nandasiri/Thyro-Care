"""Repository behavior unit tests (no real MongoDB)."""

from __future__ import annotations

from typing import Any
from unittest.mock import AsyncMock, MagicMock

import pytest
from app.models.enums import KnowledgeStatus
from app.models.medication import MedicationDocument
from app.repositories.base import MAX_PAGE_SIZE, BaseRepository, clamp_pagination
from app.repositories.errors import map_pymongo_error
from app.repositories.exceptions import (
    RepositoryConflictError,
    RepositoryUnavailableError,
)
from app.repositories.knowledge_repository import KnowledgeRepository
from app.repositories.medication_repository import MedicationRepository
from bson import ObjectId
from pymongo.errors import DuplicateKeyError, ServerSelectionTimeoutError


class _SoftDoc(MedicationDocument):
    pass


def test_soft_delete_default_filtering() -> None:
    repo = BaseRepository.__new__(MedicationRepository)
    repo.supports_soft_delete = True
    repo.collection_name = "medications"
    repo.model_type = MedicationDocument
    assert repo._not_deleted_filter(False) == {"is_deleted": {"$ne": True}}
    assert repo._not_deleted_filter(True) == {}


def test_pagination_maximum_limit() -> None:
    page, size = clamp_pagination(1, 10_000)
    assert page == 1
    assert size == MAX_PAGE_SIZE


def test_duplicate_key_exception_mapping() -> None:
    mapped = map_pymongo_error(DuplicateKeyError("E11000"))
    assert isinstance(mapped, RepositoryConflictError)


def test_database_unavailable_exception_mapping() -> None:
    mapped = map_pymongo_error(ServerSelectionTimeoutError("timeout"))
    assert isinstance(mapped, RepositoryUnavailableError)


@pytest.mark.asyncio
async def test_patient_owned_query_includes_user_id() -> None:
    database = MagicMock()
    collection = MagicMock()
    collection.find_one = AsyncMock(return_value=None)
    database.__getitem__.return_value = collection

    repo = MedicationRepository(database)
    user_id = ObjectId()
    med_id = ObjectId()
    await repo.get_owned_by_id(med_id, user_id)

    query = collection.find_one.await_args.args[0]
    assert query["_id"] == med_id
    assert query["user_id"] == user_id
    assert query["is_deleted"] == {"$ne": True}


@pytest.mark.asyncio
async def test_approved_knowledge_filtering() -> None:
    database = MagicMock()
    collection = MagicMock()

    class _Cursor:
        def sort(self, *_args: Any, **_kwargs: Any) -> _Cursor:
            return self

        def skip(self, *_args: Any, **_kwargs: Any) -> _Cursor:
            return self

        def limit(self, *_args: Any, **_kwargs: Any) -> _Cursor:
            return self

        def __aiter__(self) -> _Cursor:
            return self

        async def __anext__(self) -> dict[str, Any]:
            raise StopAsyncIteration

    collection.find = MagicMock(return_value=_Cursor())
    database.__getitem__.return_value = collection

    repo = KnowledgeRepository(database)
    await repo.list_approved_active()
    query = collection.find.call_args.args[0]
    assert query["status"] == KnowledgeStatus.APPROVED.value
    assert query["active"] is True
