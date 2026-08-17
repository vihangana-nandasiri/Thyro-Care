"""Chat response feedback repository."""

from __future__ import annotations

from bson import ObjectId
from pymongo.asynchronous.database import AsyncDatabase

from app.db.collections import CollectionName
from app.models.chat_feedback import ChatResponseFeedbackDocument
from app.models.object_id import to_object_id
from app.repositories.base import BaseRepository


class ChatResponseFeedbackRepository(BaseRepository[ChatResponseFeedbackDocument]):
    collection_name = CollectionName.CHAT_RESPONSE_FEEDBACK.value
    model_type = ChatResponseFeedbackDocument
    supports_soft_delete = True

    def __init__(self, database: AsyncDatabase) -> None:
        super().__init__(database)

    async def find_active_for_user_message(
        self,
        user_id: ObjectId | str,
        assistant_message_id: ObjectId | str,
    ) -> ChatResponseFeedbackDocument | None:
        return await self.find_one(
            {
                "user_id": to_object_id(user_id),
                "assistant_message_id": to_object_id(assistant_message_id),
                "is_deleted": {"$ne": True},
            }
        )
