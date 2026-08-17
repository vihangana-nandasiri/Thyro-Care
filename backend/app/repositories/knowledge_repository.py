"""Knowledge repository — approved documents and chunks."""

from __future__ import annotations

from typing import Any

from bson import ObjectId
from pymongo.asynchronous.database import AsyncDatabase
from pymongo.errors import PyMongoError

from app.db.collections import CollectionName
from app.models.enums import KnowledgeStatus
from app.models.knowledge import KnowledgeChunkDocument, KnowledgeDocumentDocument
from app.models.object_id import to_object_id
from app.repositories.base import BaseRepository
from app.repositories.errors import map_pymongo_error
from app.utils.datetime import utc_now


class KnowledgeRepository(BaseRepository[KnowledgeDocumentDocument]):
    collection_name = CollectionName.KNOWLEDGE_DOCUMENTS.value
    model_type = KnowledgeDocumentDocument
    supports_soft_delete = True

    def __init__(self, database: AsyncDatabase) -> None:
        super().__init__(database)
        self._chunks = database[CollectionName.KNOWLEDGE_CHUNKS.value]

    async def list_approved_active(
        self,
        *,
        page: int = 1,
        page_size: int = 20,
    ) -> list[KnowledgeDocumentDocument]:
        return await self.find_many(
            {
                "status": KnowledgeStatus.APPROVED.value,
                "active": True,
            },
            page=page,
            page_size=page_size,
            sort=[("updated_at", -1)],
        )

    async def get_approved_active_by_id(
        self,
        document_id: ObjectId | str,
    ) -> KnowledgeDocumentDocument | None:
        # Support Mongo _id or stable document_id string
        try:
            oid = to_object_id(document_id)
            found = await self.find_one(
                {
                    "_id": oid,
                    "status": KnowledgeStatus.APPROVED.value,
                    "active": True,
                },
            )
            if found is not None:
                return found
        except Exception:
            pass
        return await self.find_one(
            {
                "document_id": str(document_id),
                "status": KnowledgeStatus.APPROVED.value,
                "active": True,
            },
        )

    async def list_by_status(
        self,
        status: KnowledgeStatus,
        *,
        page: int = 1,
        page_size: int = 20,
    ) -> list[KnowledgeDocumentDocument]:
        return await self.find_many(
            {"status": status.value},
            page=page,
            page_size=page_size,
            sort=[("updated_at", -1)],
        )

    async def upsert_document(
        self, document: KnowledgeDocumentDocument
    ) -> KnowledgeDocumentDocument:
        payload = document.model_dump(by_alias=True)
        payload["updated_at"] = utc_now()
        try:
            await self._collection.update_one(
                {"document_id": document.document_id},
                {"$set": payload},
                upsert=True,
            )
        except PyMongoError as exc:
            raise map_pymongo_error(exc) from exc
        found = await self.find_one({"document_id": document.document_id}, include_deleted=True)
        assert found is not None
        return found

    async def upsert_chunks(self, chunks: list[KnowledgeChunkDocument]) -> int:
        count = 0
        for chunk in chunks:
            payload = chunk.model_dump(by_alias=True)
            payload["updated_at"] = utc_now()
            try:
                await self._chunks.update_one(
                    {"chunk_id": chunk.chunk_id},
                    {"$set": payload},
                    upsert=True,
                )
                count += 1
            except PyMongoError as exc:
                raise map_pymongo_error(exc) from exc
        return count

    async def retire_old_chunks(self, document_id: str, keep_version: str | None) -> int:
        """Retire chunks not matching `keep_version`. Pass None to retire all chunks
        for the document (e.g. when governance retires the entire document)."""
        query: dict[str, Any] = {
            "document_id": document_id,
            "is_deleted": {"$ne": True},
        }
        if keep_version is not None:
            query["document_version"] = {"$ne": keep_version}
        try:
            result = await self._chunks.update_many(
                query,
                {
                    "$set": {
                        "review_status": KnowledgeStatus.RETIRED.value,
                        "active": False,
                        "updated_at": utc_now(),
                    }
                },
            )
            return int(result.modified_count)
        except PyMongoError as exc:
            raise map_pymongo_error(exc) from exc

    async def list_approved_chunks(
        self,
        *,
        language: str | None = None,
        topic: str | None = None,
        limit: int = 500,
    ) -> list[KnowledgeChunkDocument]:
        query: dict[str, Any] = {
            "review_status": KnowledgeStatus.APPROVED.value,
            "active": True,
            "is_deleted": {"$ne": True},
        }
        if language:
            query["language"] = language
        if topic:
            query["topic"] = topic
        try:
            cursor = self._chunks.find(query).sort("chunk_index", 1).limit(min(max(1, limit), 1000))
            docs = await cursor.to_list(length=limit)
        except PyMongoError as exc:
            raise map_pymongo_error(exc) from exc
        return [KnowledgeChunkDocument.model_validate(d) for d in docs]

    async def retrieve_approved_chunks(self, **kwargs: Any) -> list[KnowledgeChunkDocument]:
        return await self.list_approved_chunks(**kwargs)

    async def get_approved_source_by_id(self, document_id: str) -> KnowledgeDocumentDocument | None:
        return await self.find_one(
            {
                "document_id": document_id,
                "status": KnowledgeStatus.APPROVED.value,
                "active": True,
            },
        )
