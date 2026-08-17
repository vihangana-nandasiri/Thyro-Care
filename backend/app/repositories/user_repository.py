"""User repository foundation (no auth workflows)."""

from __future__ import annotations

from pymongo.asynchronous.database import AsyncDatabase

from app.db.collections import CollectionName
from app.models.user import UserDocument, normalize_email
from app.repositories.base import BaseRepository


class UserRepository(BaseRepository[UserDocument]):
    collection_name = CollectionName.USERS.value
    model_type = UserDocument
    supports_soft_delete = True

    def __init__(self, database: AsyncDatabase) -> None:
        super().__init__(database)

    async def get_by_email_normalized(self, email: str) -> UserDocument | None:
        return await self.find_one({"email_normalized": normalize_email(email)})

    async def email_exists(self, email: str) -> bool:
        return await self.exists({"email_normalized": normalize_email(email)})

    async def create_user_document(self, document: UserDocument) -> UserDocument:
        """Insert a user document. Does not hash passwords or issue tokens."""
        document.email_normalized = normalize_email(document.email_normalized)
        return await self.insert_one(document)
