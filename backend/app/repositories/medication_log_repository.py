"""Medication log repository — ownership-enforced dose records."""

from __future__ import annotations

from datetime import datetime

from bson import ObjectId
from pymongo.asynchronous.database import AsyncDatabase
from pymongo.errors import DuplicateKeyError, PyMongoError

from app.db.collections import CollectionName
from app.models.medication import MedicationLogDocument
from app.models.object_id import to_object_id
from app.repositories.base import BaseRepository
from app.repositories.errors import map_pymongo_error
from app.repositories.exceptions import RepositoryConflictError, RepositoryNotFoundError
from app.utils.datetime import utc_now
from app.utils.timezone import ensure_utc


class MedicationLogRepository(BaseRepository[MedicationLogDocument]):
    collection_name = CollectionName.MEDICATION_LOGS.value
    model_type = MedicationLogDocument
    supports_soft_delete = False

    def __init__(self, database: AsyncDatabase) -> None:
        super().__init__(database)

    async def create_log(self, document: MedicationLogDocument) -> MedicationLogDocument:
        try:
            return await self.insert_one(document)
        except DuplicateKeyError as exc:
            raise RepositoryConflictError(
                "This dose status has already been recorded. "
                "Refresh the schedule to view the latest status."
            ) from exc
        except Exception as exc:  # noqa: BLE001
            mapped = map_pymongo_error(exc)
            if isinstance(mapped, RepositoryConflictError):
                raise RepositoryConflictError(
                    "This dose status has already been recorded. "
                    "Refresh the schedule to view the latest status."
                ) from exc
            raise mapped from exc

    async def get_owned_log(
        self,
        log_id: ObjectId | str,
        user_id: ObjectId | str,
    ) -> MedicationLogDocument | None:
        return await self.find_one(
            {"_id": to_object_id(log_id), "user_id": to_object_id(user_id)},
            include_deleted=True,
        )

    async def get_by_occurrence(
        self,
        *,
        user_id: ObjectId | str,
        medication_id: ObjectId | str,
        scheduled_for: datetime,
    ) -> MedicationLogDocument | None:
        return await self.find_one(
            {
                "user_id": to_object_id(user_id),
                "medication_id": to_object_id(medication_id),
                "scheduled_for": ensure_utc(scheduled_for),
            },
            include_deleted=True,
        )

    async def list_for_user_range(
        self,
        user_id: ObjectId | str,
        *,
        date_from: datetime,
        date_to: datetime,
        page: int = 1,
        page_size: int = 500,
    ) -> list[MedicationLogDocument]:
        return await self.find_many(
            {
                "user_id": to_object_id(user_id),
                "scheduled_for": {
                    "$gte": ensure_utc(date_from),
                    "$lte": ensure_utc(date_to),
                },
            },
            page=page,
            page_size=page_size,
            sort=[("scheduled_for", 1)],
            include_deleted=True,
        )

    async def list_for_medication(
        self,
        user_id: ObjectId | str,
        medication_id: ObjectId | str,
        *,
        page: int = 1,
        page_size: int = 100,
    ) -> list[MedicationLogDocument]:
        return await self.find_many(
            {
                "user_id": to_object_id(user_id),
                "medication_id": to_object_id(medication_id),
            },
            page=page,
            page_size=page_size,
            sort=[("scheduled_for", -1)],
            include_deleted=True,
        )

    async def update_owned_log(
        self,
        log_id: ObjectId | str,
        user_id: ObjectId | str,
        *,
        status: str,
        note: str | None,
        expected_version: int,
    ) -> MedicationLogDocument:
        filters = {
            "_id": to_object_id(log_id),
            "user_id": to_object_id(user_id),
            "version": expected_version,
        }
        try:
            result = await self._collection.update_one(
                filters,
                {
                    "$set": {
                        "status": status,
                        "note": note,
                        "recorded_at": utc_now(),
                        "updated_at": utc_now(),
                    },
                    "$inc": {"version": 1},
                },
            )
            if result.matched_count == 0:
                existing = await self.get_owned_log(log_id, user_id)
                if existing is None:
                    raise RepositoryNotFoundError("Medication log not found")
                raise RepositoryConflictError(
                    "This dose status has already been recorded. "
                    "Refresh the schedule to view the latest status."
                )
            updated = await self.get_owned_log(log_id, user_id)
            if updated is None:
                raise RepositoryNotFoundError("Medication log not found")
            return updated
        except PyMongoError as exc:
            raise map_pymongo_error(exc) from exc
