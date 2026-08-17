"""Auth action token repository — hashed email verification / password reset."""

from __future__ import annotations

from bson import ObjectId
from pymongo.asynchronous.database import AsyncDatabase

from app.db.collections import CollectionName
from app.models.auth_tokens import AuthActionTokenDocument
from app.models.enums import AuthActionPurpose
from app.models.object_id import to_object_id
from app.repositories.base import BaseRepository
from app.utils.datetime import utc_now


class AuthActionTokenRepository(BaseRepository[AuthActionTokenDocument]):
    collection_name = CollectionName.AUTH_ACTION_TOKENS.value
    model_type = AuthActionTokenDocument
    supports_soft_delete = False

    def __init__(self, database: AsyncDatabase) -> None:
        super().__init__(database)

    async def create_token(self, document: AuthActionTokenDocument) -> AuthActionTokenDocument:
        return await self.insert_one(document)

    async def get_by_hash(self, token_hash: str) -> AuthActionTokenDocument | None:
        return await self.find_one({"token_hash": token_hash})

    async def invalidate_active_for_user(
        self,
        user_id: ObjectId | str,
        purpose: AuthActionPurpose,
    ) -> int:
        now = utc_now()
        result = await self.collection.update_many(
            {
                "user_id": to_object_id(user_id),
                "purpose": purpose.value,
                "consumed_at": None,
            },
            {"$set": {"consumed_at": now, "updated_at": now}},
        )
        return int(result.modified_count)

    async def consume_atomically(self, token_id: ObjectId | str) -> AuthActionTokenDocument | None:
        now = utc_now()
        result = await self.collection.find_one_and_update(
            {
                "_id": to_object_id(token_id),
                "consumed_at": None,
                "expires_at": {"$gt": now},
            },
            {"$set": {"consumed_at": now, "updated_at": now}, "$inc": {"version": 1}},
            return_document=True,
        )
        if result is None:
            return None
        return self.model_type.model_validate(result)
