"""Chat session and message repositories with ownership enforcement."""

from __future__ import annotations

from typing import Any

from bson import ObjectId
from pymongo.asynchronous.database import AsyncDatabase
from pymongo.errors import PyMongoError

from app.db.collections import CollectionName
from app.models.chat import ChatMessageDocument, ChatSessionDocument
from app.models.object_id import to_object_id
from app.repositories.base import BaseRepository
from app.repositories.errors import map_pymongo_error
from app.repositories.exceptions import RepositoryNotFoundError
from app.utils.datetime import utc_now


class ChatSessionRepository(BaseRepository[ChatSessionDocument]):
    collection_name = CollectionName.CHAT_SESSIONS.value
    model_type = ChatSessionDocument
    supports_soft_delete = True

    def __init__(self, database: AsyncDatabase) -> None:
        super().__init__(database)

    async def create_for_user(self, document: ChatSessionDocument) -> ChatSessionDocument:
        return await self.insert_one(document)

    async def list_for_user(
        self,
        user_id: ObjectId | str,
        *,
        page: int = 1,
        page_size: int = 20,
    ) -> list[ChatSessionDocument]:
        return await self.find_many(
            {"user_id": to_object_id(user_id)},
            page=page,
            page_size=min(max(1, page_size), 100),
            sort=[("last_message_at", -1), ("updated_at", -1)],
        )

    async def get_owned_by_id(
        self,
        session_id: ObjectId | str,
        user_id: ObjectId | str,
    ) -> ChatSessionDocument | None:
        return await self.find_one(
            {"_id": to_object_id(session_id), "user_id": to_object_id(user_id)},
        )

    async def list_sessions_for_user(
        self,
        user_id: ObjectId | str,
        *,
        page: int = 1,
        page_size: int = 20,
    ) -> list[ChatSessionDocument]:
        return await self.list_for_user(user_id, page=page, page_size=page_size)

    async def get_owned_session(
        self,
        session_id: ObjectId | str,
        user_id: ObjectId | str,
    ) -> ChatSessionDocument | None:
        return await self.get_owned_by_id(session_id, user_id)

    async def update_owned(
        self,
        session_id: ObjectId | str,
        user_id: ObjectId | str,
        updates: dict[str, Any],
    ) -> ChatSessionDocument:
        payload = {**updates, "updated_at": utc_now()}
        filters = self._merge_filters(
            {"_id": to_object_id(session_id), "user_id": to_object_id(user_id)},
            include_deleted=False,
        )
        try:
            result = await self._collection.update_one(filters, {"$set": payload})
            if result.matched_count == 0:
                raise RepositoryNotFoundError("Chat session not found")
            updated = await self.get_owned_by_id(session_id, user_id)
            if updated is None:
                raise RepositoryNotFoundError("Chat session not found")
            return updated
        except PyMongoError as exc:
            raise map_pymongo_error(exc) from exc

    async def soft_delete_owned(
        self,
        session_id: ObjectId | str,
        user_id: ObjectId | str,
    ) -> ChatSessionDocument:
        doc = await self.get_owned_by_id(session_id, user_id)
        if doc is None:
            raise RepositoryNotFoundError("Chat session not found")
        return await self.soft_delete(doc.id)


class ChatMessageRepository(BaseRepository[ChatMessageDocument]):
    collection_name = CollectionName.CHAT_MESSAGES.value
    model_type = ChatMessageDocument
    supports_soft_delete = True

    def __init__(self, database: AsyncDatabase) -> None:
        super().__init__(database)

    async def create_for_user_session(self, document: ChatMessageDocument) -> ChatMessageDocument:
        return await self.insert_one(document)

    async def list_for_owned_session(
        self,
        session_id: ObjectId | str,
        user_id: ObjectId | str,
        *,
        page: int = 1,
        page_size: int = 50,
    ) -> list[ChatMessageDocument]:
        return await self.find_many(
            {
                "session_id": to_object_id(session_id),
                "user_id": to_object_id(user_id),
            },
            page=page,
            page_size=min(max(1, page_size), 100),
            sort=[("created_at", 1)],
        )

    async def list_messages_for_session(
        self,
        session_id: ObjectId | str,
        user_id: ObjectId | str,
        *,
        page: int = 1,
        page_size: int = 50,
    ) -> list[ChatMessageDocument]:
        return await self.list_for_owned_session(
            session_id, user_id, page=page, page_size=page_size
        )

    async def count_for_session(
        self,
        session_id: ObjectId | str,
        user_id: ObjectId | str,
    ) -> int:
        return await self.count(
            {
                "session_id": to_object_id(session_id),
                "user_id": to_object_id(user_id),
            }
        )

    async def soft_delete_for_session(
        self,
        session_id: ObjectId | str,
        user_id: ObjectId | str,
    ) -> int:
        filters = self._merge_filters(
            {
                "session_id": to_object_id(session_id),
                "user_id": to_object_id(user_id),
            },
            include_deleted=False,
        )
        try:
            result = await self._collection.update_many(
                filters,
                {
                    "$set": {
                        "is_deleted": True,
                        "deleted_at": utc_now(),
                        "updated_at": utc_now(),
                    }
                },
            )
            return int(result.modified_count)
        except PyMongoError as exc:
            raise map_pymongo_error(exc) from exc


class ChatRepository:
    """Facade combining session and message repositories."""

    def __init__(self, database: AsyncDatabase) -> None:
        self.sessions = ChatSessionRepository(database)
        self.messages = ChatMessageRepository(database)

    async def list_sessions_for_user(
        self,
        user_id: ObjectId | str,
        *,
        page: int = 1,
        page_size: int = 20,
    ) -> list[ChatSessionDocument]:
        return await self.sessions.list_for_user(user_id, page=page, page_size=page_size)

    async def get_owned_session(
        self,
        session_id: ObjectId | str,
        user_id: ObjectId | str,
    ) -> ChatSessionDocument | None:
        return await self.sessions.get_owned_by_id(session_id, user_id)

    async def list_messages_for_session(
        self,
        session_id: ObjectId | str,
        user_id: ObjectId | str,
        *,
        page: int = 1,
        page_size: int = 50,
    ) -> list[ChatMessageDocument]:
        return await self.messages.list_for_owned_session(
            session_id, user_id, page=page, page_size=page_size
        )
