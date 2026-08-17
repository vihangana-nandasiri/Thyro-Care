"""Legacy symptom_log repository foundation (append-oriented)."""

from __future__ import annotations

from bson import ObjectId
from pymongo.asynchronous.database import AsyncDatabase

from app.db.collections import CollectionName
from app.models.object_id import to_object_id
from app.models.symptom_log import SymptomLogDocument
from app.repositories.base import BaseRepository


class SymptomLogRepository(BaseRepository[SymptomLogDocument]):
    collection_name = CollectionName.SYMPTOM_LOGS.value
    model_type = SymptomLogDocument
    supports_soft_delete = False

    def __init__(self, database: AsyncDatabase) -> None:
        super().__init__(database)

    async def list_for_user(
        self,
        user_id: ObjectId | str,
        *,
        page: int = 1,
        page_size: int = 20,
    ) -> list[SymptomLogDocument]:
        return await self.find_many(
            {"user_id": to_object_id(user_id)},
            page=page,
            page_size=page_size,
            sort=[("created_at", -1)],
        )

    async def create_log_document(self, document: SymptomLogDocument) -> SymptomLogDocument:
        return await self.insert_one(document)
