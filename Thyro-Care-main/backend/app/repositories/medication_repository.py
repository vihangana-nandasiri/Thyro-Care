"""Medication repository — ownership-enforced queries and optimistic concurrency."""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any

from bson import ObjectId
from pymongo.asynchronous.database import AsyncDatabase
from pymongo.errors import PyMongoError
from pymongo.results import UpdateResult

from app.db.collections import CollectionName
from app.models.enums import MedicationStatus
from app.models.medication import MedicationDocument
from app.models.object_id import to_object_id
from app.repositories.base import BaseRepository, to_bson_safe
from app.repositories.errors import map_pymongo_error
from app.repositories.exceptions import (
    RepositoryConflictError,
    RepositoryNotFoundError,
    RepositoryValidationError,
)
from app.utils.datetime import utc_now

_EDITABLE = frozenset(
    {
        "name",
        "dosage_text",
        "frequency",
        "reminder_times",
        "instructions",
        "start_date",
        "end_date",
        "status",
        "prescribed_by_text",
        "notes",
        "timezone",
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

_CONFLICT = "Medication information was updated elsewhere. Reload the latest record before saving."


class MedicationRepository(BaseRepository[MedicationDocument]):
    collection_name = CollectionName.MEDICATIONS.value
    model_type = MedicationDocument
    supports_soft_delete = True

    def __init__(self, database: AsyncDatabase) -> None:
        super().__init__(database)

    async def create_for_user(self, document: MedicationDocument) -> MedicationDocument:
        return await self.insert_one(document)

    async def list_for_user(
        self,
        user_id: ObjectId | str,
        *,
        status: MedicationStatus | None = None,
        page: int = 1,
        page_size: int = 20,
    ) -> list[MedicationDocument]:
        query: dict[str, Any] = {"user_id": to_object_id(user_id)}
        if status is not None:
            query["status"] = status.value
        return await self.find_many(
            query,
            page=page,
            page_size=page_size,
            sort=[("created_at", -1)],
        )

    async def count_for_user(
        self,
        user_id: ObjectId | str,
        *,
        status: MedicationStatus | None = None,
    ) -> int:
        query: dict[str, Any] = {"user_id": to_object_id(user_id)}
        if status is not None:
            query["status"] = status.value
        return await self.count(query)

    async def get_owned_by_id(
        self,
        medication_id: ObjectId | str,
        user_id: ObjectId | str,
    ) -> MedicationDocument | None:
        return await self.find_one(
            {"_id": to_object_id(medication_id), "user_id": to_object_id(user_id)},
        )

    async def list_active_for_user(self, user_id: ObjectId | str) -> list[MedicationDocument]:
        return await self.find_many(
            {
                "user_id": to_object_id(user_id),
                "status": MedicationStatus.ACTIVE.value,
            },
            page=1,
            page_size=100,
            sort=[("created_at", -1)],
        )

    async def get_with_expected_version(
        self,
        medication_id: ObjectId | str,
        user_id: ObjectId | str,
        expected_version: int,
    ) -> MedicationDocument:
        med = await self.get_owned_by_id(medication_id, user_id)
        if med is None:
            raise RepositoryNotFoundError("Medication not found")
        if med.version != expected_version:
            raise RepositoryConflictError(_CONFLICT)
        return med

    async def update_owned(
        self,
        medication_id: ObjectId | str,
        user_id: ObjectId | str,
        updates: Mapping[str, Any],
        *,
        expected_version: int,
    ) -> MedicationDocument:
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
            elif key == "reminder_times" and isinstance(value, list):
                # Store times as HH:MM strings for Mongo compatibility
                payload[key] = [v.strftime("%H:%M") if hasattr(v, "strftime") else v for v in value]
            else:
                payload[key] = value

        payload["updated_at"] = utc_now()
        payload = to_bson_safe(payload)
        filters = self._merge_filters(
            {
                "_id": to_object_id(medication_id),
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
                existing = await self.get_owned_by_id(medication_id, user_id)
                if existing is None:
                    raise RepositoryNotFoundError("Medication not found")
                raise RepositoryConflictError(_CONFLICT)
            updated = await self.get_owned_by_id(medication_id, user_id)
            if updated is None:
                raise RepositoryNotFoundError("Medication not found")
            return updated
        except PyMongoError as exc:
            raise map_pymongo_error(exc) from exc

    async def soft_delete_owned(
        self,
        medication_id: ObjectId | str,
        user_id: ObjectId | str,
    ) -> MedicationDocument:
        med = await self.get_owned_by_id(medication_id, user_id)
        if med is None:
            raise RepositoryNotFoundError("Medication not found")
        return await self.soft_delete(med.id)
