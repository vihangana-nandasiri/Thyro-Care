"""Appointment repository — ownership-enforced queries and optimistic concurrency."""

from __future__ import annotations

from collections.abc import Mapping
from datetime import datetime
from typing import Any

from bson import ObjectId
from pymongo.asynchronous.database import AsyncDatabase
from pymongo.errors import PyMongoError
from pymongo.results import UpdateResult

from app.db.collections import CollectionName
from app.models.appointment import AppointmentDocument
from app.models.enums import AppointmentStatus, AppointmentType
from app.models.object_id import to_object_id
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
        "appointment_type",
        "title",
        "scheduled_start",
        "scheduled_end",
        "timezone",
        "location",
        "location_type",
        "provider_name",
        "notes",
        "status",
        "completed_at",
        "cancelled_at",
        "reminder_offsets_minutes",
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

_CONFLICT = "Appointment information was updated elsewhere. Reload the latest record before saving."


class AppointmentRepository(BaseRepository[AppointmentDocument]):
    collection_name = CollectionName.APPOINTMENTS.value
    model_type = AppointmentDocument
    supports_soft_delete = True

    def __init__(self, database: AsyncDatabase) -> None:
        super().__init__(database)

    async def create_for_user(self, document: AppointmentDocument) -> AppointmentDocument:
        return await self.insert_one(document)

    async def list_for_user(
        self,
        user_id: ObjectId | str,
        *,
        status: AppointmentStatus | None = None,
        appointment_type: AppointmentType | None = None,
        date_from: datetime | None = None,
        date_to: datetime | None = None,
        page: int = 1,
        page_size: int = 20,
    ) -> list[AppointmentDocument]:
        query = self._list_query(
            user_id,
            status=status,
            appointment_type=appointment_type,
            date_from=date_from,
            date_to=date_to,
        )
        return await self.find_many(
            query,
            page=page,
            page_size=page_size,
            sort=[("scheduled_start", 1)],
        )

    async def count_for_user(
        self,
        user_id: ObjectId | str,
        *,
        status: AppointmentStatus | None = None,
        appointment_type: AppointmentType | None = None,
        date_from: datetime | None = None,
        date_to: datetime | None = None,
    ) -> int:
        query = self._list_query(
            user_id,
            status=status,
            appointment_type=appointment_type,
            date_from=date_from,
            date_to=date_to,
        )
        return await self.count(query)

    def _list_query(
        self,
        user_id: ObjectId | str,
        *,
        status: AppointmentStatus | None = None,
        appointment_type: AppointmentType | None = None,
        date_from: datetime | None = None,
        date_to: datetime | None = None,
    ) -> dict[str, Any]:
        query: dict[str, Any] = {"user_id": to_object_id(user_id)}
        if status is not None:
            query["status"] = status.value
        if appointment_type is not None:
            query["appointment_type"] = appointment_type.value
        if date_from is not None or date_to is not None:
            rng: dict[str, Any] = {}
            if date_from is not None:
                rng["$gte"] = date_from
            if date_to is not None:
                rng["$lte"] = date_to
            query["scheduled_start"] = rng
        return query

    async def get_owned_by_id(
        self,
        appointment_id: ObjectId | str,
        user_id: ObjectId | str,
    ) -> AppointmentDocument | None:
        return await self.find_one(
            {"_id": to_object_id(appointment_id), "user_id": to_object_id(user_id)},
        )

    async def list_upcoming_for_user(
        self,
        user_id: ObjectId | str,
        *,
        limit: int = 10,
        now: datetime | None = None,
    ) -> list[AppointmentDocument]:
        limit = min(max(1, limit), 50)
        anchor = now or utc_now()
        return await self.find_many(
            {
                "user_id": to_object_id(user_id),
                "status": AppointmentStatus.UPCOMING.value,
                "scheduled_start": {"$gte": anchor},
            },
            page=1,
            page_size=limit,
            sort=[("scheduled_start", 1)],
        )

    async def list_past_for_user(
        self,
        user_id: ObjectId | str,
        *,
        page: int = 1,
        page_size: int = 20,
        now: datetime | None = None,
    ) -> list[AppointmentDocument]:
        anchor = now or utc_now()
        return await self.find_many(
            {
                "user_id": to_object_id(user_id),
                "scheduled_start": {"$lt": anchor},
            },
            page=page,
            page_size=page_size,
            sort=[("scheduled_start", -1)],
        )

    async def list_for_user_range(
        self,
        user_id: ObjectId | str,
        *,
        range_start: datetime,
        range_end: datetime,
    ) -> list[AppointmentDocument]:
        return await self.find_many(
            {
                "user_id": to_object_id(user_id),
                "scheduled_start": {"$gte": range_start, "$lte": range_end},
            },
            page=1,
            page_size=500,
            sort=[("scheduled_start", 1)],
        )

    async def get_with_expected_version(
        self,
        appointment_id: ObjectId | str,
        user_id: ObjectId | str,
        expected_version: int,
    ) -> AppointmentDocument:
        doc = await self.get_owned_by_id(appointment_id, user_id)
        if doc is None:
            raise RepositoryNotFoundError("Appointment not found")
        if doc.version != expected_version:
            raise RepositoryConflictError(_CONFLICT)
        return doc

    async def update_owned(
        self,
        appointment_id: ObjectId | str,
        user_id: ObjectId | str,
        updates: Mapping[str, Any],
        *,
        expected_version: int,
    ) -> AppointmentDocument:
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
                "_id": to_object_id(appointment_id),
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
                existing = await self.get_owned_by_id(appointment_id, user_id)
                if existing is None:
                    raise RepositoryNotFoundError("Appointment not found")
                raise RepositoryConflictError(_CONFLICT)
            updated = await self.get_owned_by_id(appointment_id, user_id)
            if updated is None:
                raise RepositoryNotFoundError("Appointment not found")
            return updated
        except PyMongoError as exc:
            raise map_pymongo_error(exc) from exc

    async def update_status_owned(
        self,
        appointment_id: ObjectId | str,
        user_id: ObjectId | str,
        *,
        status: AppointmentStatus,
        completed_at: datetime | None,
        cancelled_at: datetime | None,
        expected_version: int,
    ) -> AppointmentDocument:
        return await self.update_owned(
            appointment_id,
            user_id,
            {
                "status": status,
                "completed_at": completed_at,
                "cancelled_at": cancelled_at,
            },
            expected_version=expected_version,
        )

    async def soft_delete_owned(
        self,
        appointment_id: ObjectId | str,
        user_id: ObjectId | str,
    ) -> AppointmentDocument:
        doc = await self.get_owned_by_id(appointment_id, user_id)
        if doc is None:
            raise RepositoryNotFoundError("Appointment not found")
        return await self.soft_delete(doc.id)
