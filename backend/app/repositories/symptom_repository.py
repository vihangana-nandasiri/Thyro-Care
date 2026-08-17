"""Symptom repository — ownership-enforced queries and optimistic concurrency."""

from __future__ import annotations

from collections.abc import Mapping
from datetime import datetime
from typing import Any

from bson import ObjectId
from pymongo.asynchronous.database import AsyncDatabase
from pymongo.errors import PyMongoError
from pymongo.results import UpdateResult

from app.db.collections import CollectionName
from app.models.enums import SymptomSeverity, SymptomStatus, SymptomType
from app.models.object_id import to_object_id
from app.models.symptom import SymptomDocument
from app.repositories.base import BaseRepository
from app.repositories.errors import map_pymongo_error
from app.repositories.exceptions import (
    RepositoryConflictError,
    RepositoryNotFoundError,
    RepositoryValidationError,
)
from app.utils.datetime import utc_now

_EDITABLE = frozenset(
    {
        "symptom_type",
        "custom_symptom_name",
        "severity",
        "frequency",
        "started_at",
        "ended_at",
        "timezone",
        "status",
        "description",
        "notes",
        "safety_level",
        "safety_rule_version",
        "safety_checked_at",
    }
)

_PROTECTED = frozenset(
    {
        "user_id",
        "created_at",
        "is_deleted",
        "deleted_at",
        "deleted_by",
        "schema_version",
        "version",
        "_id",
        "id",
    }
)

_CONFLICT = "Symptom information was updated elsewhere. Reload the latest record before saving."


class SymptomRepository(BaseRepository[SymptomDocument]):
    collection_name = CollectionName.SYMPTOMS.value
    model_type = SymptomDocument
    supports_soft_delete = True

    def __init__(self, database: AsyncDatabase) -> None:
        super().__init__(database)

    async def create_for_user(self, document: SymptomDocument) -> SymptomDocument:
        return await self.insert_one(document)

    async def list_for_user(
        self,
        user_id: ObjectId | str,
        *,
        status: SymptomStatus | None = None,
        severity: SymptomSeverity | None = None,
        symptom_type: SymptomType | None = None,
        date_from: datetime | None = None,
        date_to: datetime | None = None,
        page: int = 1,
        page_size: int = 20,
    ) -> list[SymptomDocument]:
        page_size = min(max(1, page_size), 100)
        query: dict[str, Any] = {"user_id": to_object_id(user_id)}
        if status is not None:
            query["status"] = status.value
        if severity is not None:
            query["severity"] = severity.value
        if symptom_type is not None:
            query["symptom_type"] = symptom_type.value
        if date_from is not None or date_to is not None:
            started: dict[str, Any] = {}
            if date_from is not None:
                started["$gte"] = date_from
            if date_to is not None:
                started["$lte"] = date_to
            query["started_at"] = started
        return await self.find_many(
            query,
            page=page,
            page_size=page_size,
            sort=[("started_at", -1)],
        )

    async def count_for_user(
        self,
        user_id: ObjectId | str,
        *,
        status: SymptomStatus | None = None,
        severity: SymptomSeverity | None = None,
        symptom_type: SymptomType | None = None,
        date_from: datetime | None = None,
        date_to: datetime | None = None,
    ) -> int:
        query: dict[str, Any] = {"user_id": to_object_id(user_id)}
        if status is not None:
            query["status"] = status.value
        if severity is not None:
            query["severity"] = severity.value
        if symptom_type is not None:
            query["symptom_type"] = symptom_type.value
        if date_from is not None or date_to is not None:
            started: dict[str, Any] = {}
            if date_from is not None:
                started["$gte"] = date_from
            if date_to is not None:
                started["$lte"] = date_to
            query["started_at"] = started
        return await self.count(query)

    async def get_owned_by_id(
        self,
        symptom_id: ObjectId | str,
        user_id: ObjectId | str,
    ) -> SymptomDocument | None:
        return await self.find_one(
            {"_id": to_object_id(symptom_id), "user_id": to_object_id(user_id)},
        )

    async def list_active_for_user(self, user_id: ObjectId | str) -> list[SymptomDocument]:
        return await self.find_many(
            {
                "user_id": to_object_id(user_id),
                "status": {"$in": [SymptomStatus.ACTIVE.value, SymptomStatus.IMPROVING.value]},
            },
            page=1,
            page_size=100,
            sort=[("started_at", -1)],
        )

    async def list_for_user_range(
        self,
        user_id: ObjectId | str,
        *,
        range_start: datetime,
        range_end: datetime,
    ) -> list[SymptomDocument]:
        return await self.find_many(
            {
                "user_id": to_object_id(user_id),
                "started_at": {"$gte": range_start, "$lte": range_end},
            },
            page=1,
            page_size=500,
            sort=[("started_at", 1)],
        )

    async def get_with_expected_version(
        self,
        symptom_id: ObjectId | str,
        user_id: ObjectId | str,
        expected_version: int,
    ) -> SymptomDocument:
        doc = await self.get_owned_by_id(symptom_id, user_id)
        if doc is None:
            raise RepositoryNotFoundError("Symptom not found")
        if doc.version != expected_version:
            raise RepositoryConflictError(_CONFLICT)
        return doc

    async def update_owned(
        self,
        symptom_id: ObjectId | str,
        user_id: ObjectId | str,
        updates: Mapping[str, Any],
        *,
        expected_version: int,
    ) -> SymptomDocument:
        if any(key.startswith("$") for key in updates):
            raise RepositoryValidationError("Unsupported update operator")

        payload: dict[str, Any] = {}
        for key, value in updates.items():
            if key in _PROTECTED:
                raise RepositoryValidationError(f"Field '{key}' cannot be updated")
            if key not in _EDITABLE:
                raise RepositoryValidationError(f"Field '{key}' is not editable")
            if hasattr(value, "value"):
                payload[key] = value.value
            else:
                payload[key] = value

        payload["updated_at"] = utc_now()
        filters = self._merge_filters(
            {
                "_id": to_object_id(symptom_id),
                "user_id": to_object_id(user_id),
                "version": expected_version,
            },
            include_deleted=False,
        )
        try:
            result: UpdateResult = await self._collection.update_one(
                filters,
                {"$set": payload, "$inc": {"version": 1}},
            )
            if result.matched_count == 0:
                existing = await self.get_owned_by_id(symptom_id, user_id)
                if existing is None:
                    raise RepositoryNotFoundError("Symptom not found")
                raise RepositoryConflictError(_CONFLICT)
            updated = await self.get_owned_by_id(symptom_id, user_id)
            if updated is None:
                raise RepositoryNotFoundError("Symptom not found")
            return updated
        except PyMongoError as exc:
            raise map_pymongo_error(exc) from exc

    async def update_status_owned(
        self,
        symptom_id: ObjectId | str,
        user_id: ObjectId | str,
        *,
        status: SymptomStatus,
        ended_at: datetime | None,
        expected_version: int,
    ) -> SymptomDocument:
        updates: dict[str, Any] = {"status": status}
        if ended_at is not None or status == SymptomStatus.RESOLVED:
            updates["ended_at"] = ended_at
        return await self.update_owned(
            symptom_id,
            user_id,
            updates,
            expected_version=expected_version,
        )

    async def soft_delete_owned(
        self,
        symptom_id: ObjectId | str,
        user_id: ObjectId | str,
    ) -> SymptomDocument:
        doc = await self.get_owned_by_id(symptom_id, user_id)
        if doc is None:
            raise RepositoryNotFoundError("Symptom not found")
        return await self.soft_delete(doc.id)
