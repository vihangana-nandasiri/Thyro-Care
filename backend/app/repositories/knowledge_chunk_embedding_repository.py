"""Repository for approved knowledge chunk embeddings."""

from __future__ import annotations

from collections.abc import Sequence

from bson import ObjectId
from pymongo.asynchronous.database import AsyncDatabase

from app.db.collections import CollectionName
from app.models.embeddings import KnowledgeChunkEmbeddingDocument
from app.models.enums import KnowledgeStatus
from app.repositories.base import BaseRepository
from app.utils.datetime import utc_now


class KnowledgeChunkEmbeddingRepository(BaseRepository[KnowledgeChunkEmbeddingDocument]):
    collection_name = CollectionName.KNOWLEDGE_CHUNK_EMBEDDINGS.value
    model_type = KnowledgeChunkEmbeddingDocument
    supports_soft_delete = True

    def __init__(self, database: AsyncDatabase) -> None:
        super().__init__(database)

    async def find_active_by_chunk_hash_model(
        self,
        *,
        chunk_id: str,
        content_hash: str,
        embedding_model: str,
    ) -> KnowledgeChunkEmbeddingDocument | None:
        return await self.find_one(
            {
                "chunk_id": chunk_id,
                "content_hash": content_hash,
                "embedding_model": embedding_model,
                "active": True,
                "is_deleted": {"$ne": True},
            }
        )

    async def list_active(
        self,
        *,
        language: str | None = None,
        topic: str | None = None,
        limit: int = 500,
    ) -> list[KnowledgeChunkEmbeddingDocument]:
        query: dict = {
            "active": True,
            "review_status": KnowledgeStatus.APPROVED.value,
            "is_deleted": {"$ne": True},
        }
        if language:
            query["language"] = language
        if topic:
            query["topic"] = topic
        cursor = self.collection.find(query).limit(max(1, min(limit, 2000)))
        docs = await cursor.to_list(length=max(1, min(limit, 2000)))
        return [self.model_type.model_validate(d) for d in docs]

    async def deactivate_for_chunk(self, chunk_id: str) -> int:
        now = utc_now()
        result = await self.collection.update_many(
            {"chunk_id": chunk_id, "active": True},
            {"$set": {"active": False, "updated_at": now}},
        )
        return int(result.modified_count)

    async def deactivate_for_document(self, document_id: str) -> int:
        now = utc_now()
        result = await self.collection.update_many(
            {"document_id": document_id, "active": True},
            {"$set": {"active": False, "updated_at": now}},
        )
        return int(result.modified_count)

    async def upsert_embedding(
        self, document: KnowledgeChunkEmbeddingDocument
    ) -> KnowledgeChunkEmbeddingDocument:
        existing = await self.find_active_by_chunk_hash_model(
            chunk_id=document.chunk_id,
            content_hash=document.content_hash,
            embedding_model=document.embedding_model,
        )
        if existing is not None:
            return existing
        await self.deactivate_for_chunk(document.chunk_id)
        return await self.insert_one(document)

    async def get_by_ids(
        self, embedding_ids: Sequence[ObjectId | str]
    ) -> list[KnowledgeChunkEmbeddingDocument]:
        out: list[KnowledgeChunkEmbeddingDocument] = []
        for item in embedding_ids:
            doc = await self.get_by_id(item)
            if doc is not None:
                out.append(doc)
        return out
