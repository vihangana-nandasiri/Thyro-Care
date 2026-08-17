"""External auth identity repository (Google)."""

from __future__ import annotations

from bson import ObjectId
from pymongo.asynchronous.database import AsyncDatabase

from app.db.collections import CollectionName
from app.models.auth_tokens import AuthIdentityDocument
from app.models.enums import AuthIdentityProvider
from app.models.object_id import to_object_id
from app.repositories.base import BaseRepository
from app.utils.datetime import utc_now


class AuthIdentityRepository(BaseRepository[AuthIdentityDocument]):
    collection_name = CollectionName.AUTH_IDENTITIES.value
    model_type = AuthIdentityDocument
    supports_soft_delete = False

    def __init__(self, database: AsyncDatabase) -> None:
        super().__init__(database)

    async def create_identity(self, document: AuthIdentityDocument) -> AuthIdentityDocument:
        return await self.insert_one(document)

    async def get_by_provider_subject(
        self,
        provider: AuthIdentityProvider,
        provider_subject: str,
    ) -> AuthIdentityDocument | None:
        return await self.find_one(
            {"provider": provider.value, "provider_subject": provider_subject}
        )

    async def get_for_user_provider(
        self,
        user_id: ObjectId | str,
        provider: AuthIdentityProvider,
    ) -> AuthIdentityDocument | None:
        return await self.find_one({"user_id": to_object_id(user_id), "provider": provider.value})

    async def touch_login(self, identity_id: ObjectId | str) -> None:
        now = utc_now()
        await self.collection.update_one(
            {"_id": to_object_id(identity_id)},
            {"$set": {"last_login_at": now, "updated_at": now}},
        )
