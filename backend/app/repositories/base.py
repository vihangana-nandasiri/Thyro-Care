"""Generic asynchronous repository foundation."""

from __future__ import annotations

from collections.abc import Mapping, MutableMapping
from datetime import UTC, date, datetime, time
from typing import Any, Generic, TypeVar

from bson import ObjectId
from pydantic import BaseModel
from pymongo.asynchronous.collection import AsyncCollection
from pymongo.asynchronous.database import AsyncDatabase
from pymongo.errors import PyMongoError
from pymongo.results import InsertOneResult, UpdateResult

from app.models.object_id import object_id_to_string, to_object_id
from app.repositories.errors import map_pymongo_error
from app.repositories.exceptions import (
    RepositoryNotFoundError,
    RepositoryValidationError,
)
from app.utils.datetime import utc_now

T = TypeVar("T", bound=BaseModel)

DEFAULT_PAGE_SIZE = 20
MAX_PAGE_SIZE = 100


def clamp_pagination(page: int, page_size: int) -> tuple[int, int]:
    safe_page = max(1, page)
    safe_size = min(MAX_PAGE_SIZE, max(1, page_size))
    return safe_page, safe_size


def to_bson_safe(value: Any) -> Any:
    """Convert values that BSON cannot encode (date/time) into safe forms.

    - ``datetime.date`` → UTC midnight ``datetime``
    - ``datetime.time`` → ``HH:MM`` string
    Nested dicts/lists are converted recursively.
    """
    if isinstance(value, datetime):
        return value
    if isinstance(value, date):
        return datetime(value.year, value.month, value.day, tzinfo=UTC)
    if isinstance(value, time):
        return f"{value.hour:02d}:{value.minute:02d}"
    if isinstance(value, list):
        return [to_bson_safe(item) for item in value]
    if isinstance(value, dict):
        return {key: to_bson_safe(item) for key, item in value.items()}
    return value


class BaseRepository(Generic[T]):
    """Typed async repository over a single collection."""

    collection_name: str
    model_type: type[T]
    supports_soft_delete: bool = True

    def __init__(self, database: AsyncDatabase) -> None:
        self._db = database
        self._collection: AsyncCollection[MutableMapping[str, Any]] = database[self.collection_name]

    @property
    def collection(self) -> AsyncCollection[MutableMapping[str, Any]]:
        return self._collection

    def _not_deleted_filter(self, include_deleted: bool) -> dict[str, Any]:
        if not self.supports_soft_delete or include_deleted:
            return {}
        return {"is_deleted": {"$ne": True}}

    def _merge_filters(
        self,
        query: Mapping[str, Any] | None,
        *,
        include_deleted: bool,
    ) -> dict[str, Any]:
        # Reject operator injection from untrusted callers — repositories must
        # build filters from typed parameters, not raw request bodies.
        base = dict(query or {})
        for key in base:
            if key.startswith("$"):
                raise RepositoryValidationError("Unsupported query operator")
        base.update(self._not_deleted_filter(include_deleted))
        return base

    def _serialize_document(self, document: T) -> dict[str, Any]:
        payload = document.model_dump(by_alias=True, mode="python")
        if "_id" in payload and payload["_id"] is not None:
            payload["_id"] = to_object_id(payload["_id"])
        return to_bson_safe(payload)

    def _deserialize(self, raw: Mapping[str, Any] | None) -> T | None:
        if raw is None:
            return None
        return self.model_type.model_validate(raw)

    async def get_by_id(
        self,
        document_id: ObjectId | str,
        *,
        include_deleted: bool = False,
    ) -> T | None:
        try:
            oid = to_object_id(document_id)
            query = self._merge_filters({"_id": oid}, include_deleted=include_deleted)
            raw = await self._collection.find_one(query)
            return self._deserialize(raw)
        except PyMongoError as exc:
            raise map_pymongo_error(exc) from exc

    async def find_one(
        self,
        query: Mapping[str, Any],
        *,
        include_deleted: bool = False,
    ) -> T | None:
        try:
            filters = self._merge_filters(query, include_deleted=include_deleted)
            raw = await self._collection.find_one(filters)
            return self._deserialize(raw)
        except PyMongoError as exc:
            raise map_pymongo_error(exc) from exc

    async def find_many(
        self,
        query: Mapping[str, Any] | None = None,
        *,
        include_deleted: bool = False,
        page: int = 1,
        page_size: int = DEFAULT_PAGE_SIZE,
        sort: list[tuple[str, int]] | None = None,
    ) -> list[T]:
        page, page_size = clamp_pagination(page, page_size)
        try:
            filters = self._merge_filters(query, include_deleted=include_deleted)
            cursor = self._collection.find(filters)
            if sort:
                cursor = cursor.sort(sort)
            cursor = cursor.skip((page - 1) * page_size).limit(page_size)
            results: list[T] = []
            async for raw in cursor:
                item = self._deserialize(raw)
                if item is not None:
                    results.append(item)
            return results
        except PyMongoError as exc:
            raise map_pymongo_error(exc) from exc

    async def insert_one(self, document: T) -> T:
        try:
            now = utc_now()
            payload = self._serialize_document(document)
            if "created_at" in payload and payload.get("created_at") is None:
                payload["created_at"] = now
            if "updated_at" in self.model_type.model_fields:
                payload["updated_at"] = now
            if "created_at" in self.model_type.model_fields and "created_at" not in payload:
                payload["created_at"] = now
            result: InsertOneResult = await self._collection.insert_one(payload)
            payload["_id"] = result.inserted_id
            loaded = self._deserialize(payload)
            assert loaded is not None
            return loaded
        except PyMongoError as exc:
            raise map_pymongo_error(exc) from exc

    async def update_one(
        self,
        document_id: ObjectId | str,
        updates: Mapping[str, Any],
        *,
        include_deleted: bool = False,
    ) -> T:
        if any(key.startswith("$") for key in updates):
            raise RepositoryValidationError("Unsupported update operator")
        try:
            oid = to_object_id(document_id)
            payload = to_bson_safe(dict(updates))
            if "updated_at" in self.model_type.model_fields:
                payload["updated_at"] = utc_now()
            filters = self._merge_filters({"_id": oid}, include_deleted=include_deleted)
            result: UpdateResult = await self._collection.update_one(
                filters,
                {"$set": payload},
            )
            if result.matched_count == 0:
                raise RepositoryNotFoundError("Document not found")
            found = await self.get_by_id(oid, include_deleted=include_deleted)
            if found is None:
                raise RepositoryNotFoundError("Document not found")
            return found
        except PyMongoError as exc:
            raise map_pymongo_error(exc) from exc

    async def soft_delete(
        self,
        document_id: ObjectId | str,
        *,
        deleted_by: ObjectId | str | None = None,
    ) -> T:
        if not self.supports_soft_delete:
            raise RepositoryValidationError("Soft delete is not supported for this collection")
        updates: dict[str, Any] = {
            "is_deleted": True,
            "deleted_at": utc_now(),
        }
        if deleted_by is not None:
            updates["deleted_by"] = to_object_id(deleted_by)
        oid = to_object_id(document_id)
        try:
            payload = dict(updates)
            if "updated_at" in self.model_type.model_fields:
                payload["updated_at"] = utc_now()
            filters = self._merge_filters({"_id": oid}, include_deleted=False)
            result: UpdateResult = await self._collection.update_one(
                filters,
                {"$set": payload},
            )
            if result.matched_count == 0:
                raise RepositoryNotFoundError("Document not found")
            found = await self.get_by_id(oid, include_deleted=True)
            if found is None:
                raise RepositoryNotFoundError("Document not found")
            return found
        except PyMongoError as exc:
            raise map_pymongo_error(exc) from exc

    async def restore(self, document_id: ObjectId | str) -> T:
        if not self.supports_soft_delete:
            raise RepositoryValidationError("Restore is not supported for this collection")
        return await self.update_one(
            document_id,
            {"is_deleted": False, "deleted_at": None, "deleted_by": None},
            include_deleted=True,
        )

    async def count(
        self,
        query: Mapping[str, Any] | None = None,
        *,
        include_deleted: bool = False,
    ) -> int:
        try:
            filters = self._merge_filters(query, include_deleted=include_deleted)
            return await self._collection.count_documents(filters)
        except PyMongoError as exc:
            raise map_pymongo_error(exc) from exc

    async def exists(
        self,
        query: Mapping[str, Any],
        *,
        include_deleted: bool = False,
    ) -> bool:
        return await self.count(query, include_deleted=include_deleted) > 0

    @staticmethod
    def to_public_id(document_id: ObjectId | str) -> str:
        return object_id_to_string(document_id)
