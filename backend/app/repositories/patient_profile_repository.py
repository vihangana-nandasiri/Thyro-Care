"""Patient profile repository with ownership and optimistic concurrency."""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any

from bson import ObjectId
from pymongo.asynchronous.database import AsyncDatabase
from pymongo.errors import PyMongoError
from pymongo.results import UpdateResult

from app.db.collections import CollectionName
from app.models.object_id import to_object_id
from app.models.patient_profile import PatientProfileDocument
from app.repositories.base import BaseRepository, to_bson_safe
from app.repositories.errors import map_pymongo_error
from app.repositories.exceptions import (
    RepositoryConflictError,
    RepositoryNotFoundError,
    RepositoryValidationError,
)
from app.utils.datetime import utc_now

_EDITABLE_FIELDS = frozenset(
    {
        "age_range",
        "preferred_language",
        "surgery_date",
        "rai_treatment_status",
        "treatment_stage",
        "emergency_contact_name",
        "emergency_contact_phone",
        "current_medication_summary",
    }
)

_PROFILE_CONFLICT_MSG = (
    "Your profile was updated elsewhere. Reload the latest profile before saving again."
)

_PROTECTED_FIELDS = frozenset(
    {
        "user_id",
        "consent_accepted",
        "consent_accepted_at",
        "disclaimer_accepted",
        "disclaimer_accepted_at",
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


class PatientProfileRepository(BaseRepository[PatientProfileDocument]):
    collection_name = CollectionName.PATIENT_PROFILES.value
    model_type = PatientProfileDocument
    supports_soft_delete = True

    def __init__(self, database: AsyncDatabase) -> None:
        super().__init__(database)

    async def get_by_user_id(self, user_id: ObjectId | str) -> PatientProfileDocument | None:
        return await self.find_one({"user_id": to_object_id(user_id)})

    async def profile_exists(self, user_id: ObjectId | str) -> bool:
        return await self.exists({"user_id": to_object_id(user_id)})

    async def create_profile_document(
        self,
        document: PatientProfileDocument,
    ) -> PatientProfileDocument:
        return await self.insert_one(document)

    async def get_with_expected_version(
        self,
        user_id: ObjectId | str,
        expected_version: int,
    ) -> PatientProfileDocument:
        profile = await self.get_by_user_id(user_id)
        if profile is None:
            raise RepositoryNotFoundError("Profile not found")
        if profile.version != expected_version:
            raise RepositoryConflictError(_PROFILE_CONFLICT_MSG)
        return profile

    async def update_for_user(
        self,
        user_id: ObjectId | str,
        updates: Mapping[str, Any],
        *,
        expected_version: int,
    ) -> PatientProfileDocument:
        if any(key.startswith("$") for key in updates):
            raise RepositoryValidationError("Unsupported update operator")

        payload: dict[str, Any] = {}
        for key, value in updates.items():
            if key in _PROTECTED_FIELDS:
                raise RepositoryValidationError(f"Field '{key}' cannot be updated")
            if key not in _EDITABLE_FIELDS:
                raise RepositoryValidationError(f"Field '{key}' is not editable")
            if hasattr(value, "value"):
                payload[key] = value.value
            else:
                payload[key] = value

        oid = to_object_id(user_id)
        payload["updated_at"] = utc_now()
        payload = to_bson_safe(payload)

        filters = self._merge_filters(
            {"user_id": oid, "version": expected_version},
            include_deleted=False,
        )

        try:
            result: UpdateResult = await self._collection.update_one(
                filters,
                {"$set": payload, "$inc": {"version": 1}},
            )
            if result.matched_count == 0:
                existing = await self.get_by_user_id(oid)
                if existing is None:
                    raise RepositoryNotFoundError("Profile not found")
                raise RepositoryConflictError(_PROFILE_CONFLICT_MSG)
            updated = await self.get_by_user_id(oid)
            if updated is None:
                raise RepositoryNotFoundError("Profile not found")
            return updated
        except PyMongoError as exc:
            raise map_pymongo_error(exc) from exc
