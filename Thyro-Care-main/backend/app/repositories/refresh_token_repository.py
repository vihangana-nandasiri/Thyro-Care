"""Refresh-token repository."""

from __future__ import annotations

from datetime import UTC, datetime

from bson import ObjectId
from pymongo.asynchronous.database import AsyncDatabase

from app.db.collections import CollectionName
from app.models.object_id import to_object_id
from app.models.supporting import RefreshTokenDocument
from app.repositories.base import BaseRepository
from app.utils.datetime import utc_now


class RefreshTokenRepository(BaseRepository[RefreshTokenDocument]):
    collection_name = CollectionName.REFRESH_TOKENS.value
    model_type = RefreshTokenDocument
    supports_soft_delete = False

    def __init__(self, database: AsyncDatabase) -> None:
        super().__init__(database)

    async def create_token_record(self, document: RefreshTokenDocument) -> RefreshTokenDocument:
        return await self.insert_one(document)

    async def get_by_token_hash(self, token_hash: str) -> RefreshTokenDocument | None:
        return await self.find_one({"token_hash": token_hash})

    async def revoke_token(self, token_id: ObjectId | str) -> RefreshTokenDocument | None:
        now = utc_now()
        try:
            return await self.update_one(token_id, {"revoked_at": now})
        except Exception:
            return None

    async def revoke_family(self, family_id: str) -> int:
        now = utc_now()
        result = await self.collection.update_many(
            {"family_id": family_id, "revoked_at": None},
            {"$set": {"revoked_at": now, "updated_at": now}},
        )
        return int(result.modified_count)

    async def revoke_all_for_user(self, user_id: ObjectId | str) -> int:
        now = utc_now()
        result = await self.collection.update_many(
            {"user_id": to_object_id(user_id), "revoked_at": None},
            {"$set": {"revoked_at": now, "updated_at": now}},
        )
        return int(result.modified_count)

    async def mark_reuse_detected(self, family_id: str) -> int:
        return await self.revoke_family(family_id)

    async def rotate_token(
        self,
        *,
        current: RefreshTokenDocument,
        new_document: RefreshTokenDocument,
    ) -> RefreshTokenDocument | None:
        """Atomically revoke current token and insert the replacement.

        Returns None if the current token was already revoked/used (race/reuse).
        """
        now = utc_now()
        result = await self.collection.update_one(
            {
                "_id": current.id,
                "revoked_at": None,
                "expires_at": {"$gt": now},
            },
            {
                "$set": {
                    "revoked_at": now,
                    "replaced_by_token_id": new_document.id,
                    "updated_at": now,
                }
            },
        )
        if result.modified_count != 1:
            return None
        return await self.insert_one(new_document)

    async def list_active_families_for_user(self, user_id: ObjectId | str) -> list[str]:
        now = utc_now()
        cursor = self.collection.find(
            {
                "user_id": to_object_id(user_id),
                "revoked_at": None,
                "expires_at": {"$gt": now},
            },
            projection={"family_id": 1},
        )
        families: set[str] = set()
        async for doc in cursor:
            family = doc.get("family_id")
            if isinstance(family, str):
                families.add(family)
        return sorted(families)

    @staticmethod
    def is_active(document: RefreshTokenDocument, *, now: datetime | None = None) -> bool:
        current = now or datetime.now(UTC)
        if document.revoked_at is not None:
            return False
        expires = document.expires_at
        if expires.tzinfo is None:
            expires = expires.replace(tzinfo=UTC)
        return expires > current
