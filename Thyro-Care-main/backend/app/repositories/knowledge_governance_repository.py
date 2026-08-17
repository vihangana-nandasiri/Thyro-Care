"""Knowledge governance repository — documents, versions, and append-only reviews."""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any

from pymongo.asynchronous.database import AsyncDatabase
from pymongo.errors import PyMongoError
from pymongo.results import UpdateResult

from app.db.collections import CollectionName
from app.models.enums import KnowledgeStatus
from app.models.knowledge import (
    KnowledgeDocumentDocument,
    KnowledgeDocumentVersionDocument,
    KnowledgeReviewRecordDocument,
)
from app.models.object_id import to_object_id
from app.repositories.base import BaseRepository, clamp_pagination
from app.repositories.errors import map_pymongo_error
from app.repositories.exceptions import (
    RepositoryConflictError,
    RepositoryNotFoundError,
    RepositoryValidationError,
)
from app.utils.datetime import utc_now

_CONFLICT = "This content was updated elsewhere. Reload the latest version before saving."


class KnowledgeGovernanceRepository(BaseRepository[KnowledgeDocumentDocument]):
    """Governance-facing access to the shared knowledge_documents collection plus
    the version and review-record collections introduced in Phase 12."""

    collection_name = CollectionName.KNOWLEDGE_DOCUMENTS.value
    model_type = KnowledgeDocumentDocument
    supports_soft_delete = True

    def __init__(self, database: AsyncDatabase) -> None:
        super().__init__(database)
        self._versions = database[CollectionName.KNOWLEDGE_DOCUMENT_VERSIONS.value]
        self._reviews = database[CollectionName.KNOWLEDGE_REVIEW_RECORDS.value]

    # ---- Documents (parent governance record) ----------------------------------

    async def get_document(self, document_id: str) -> KnowledgeDocumentDocument | None:
        return await self.find_one({"document_id": document_id})

    async def create_document(
        self, document: KnowledgeDocumentDocument
    ) -> KnowledgeDocumentDocument:
        return await self.insert_one(document)

    async def list_documents(
        self,
        *,
        status: KnowledgeStatus | None = None,
        topic: str | None = None,
        language: str | None = None,
        page: int = 1,
        page_size: int = 20,
    ) -> list[KnowledgeDocumentDocument]:
        query: dict[str, Any] = {}
        if status is not None:
            query["current_status"] = status.value
        if topic:
            query["topic"] = topic
        if language:
            query["language"] = language
        return await self.find_many(
            query,
            page=page,
            page_size=page_size,
            sort=[("updated_at", -1)],
        )

    async def count_documents_filtered(
        self,
        *,
        status: KnowledgeStatus | None = None,
        topic: str | None = None,
        language: str | None = None,
    ) -> int:
        query: dict[str, Any] = {}
        if status is not None:
            query["current_status"] = status.value
        if topic:
            query["topic"] = topic
        if language:
            query["language"] = language
        return await self.count(query)

    async def update_document(
        self,
        document_id: str,
        updates: Mapping[str, Any],
        *,
        expected_version: int,
    ) -> KnowledgeDocumentDocument:
        if any(key.startswith("$") for key in updates):
            raise RepositoryValidationError("Unsupported update operator")
        payload = dict(updates)
        payload["updated_at"] = utc_now()
        filters = self._merge_filters(
            {"document_id": document_id, "version": expected_version},
            include_deleted=False,
        )
        try:
            result: UpdateResult = await self._collection.update_one(
                filters,
                {"$set": payload, "$inc": {"version": 1}},
            )
            if result.matched_count == 0:
                existing = await self.get_document(document_id)
                if existing is None:
                    raise RepositoryNotFoundError("Knowledge document not found")
                raise RepositoryConflictError(_CONFLICT)
            updated = await self.get_document(document_id)
            if updated is None:
                raise RepositoryNotFoundError("Knowledge document not found")
            return updated
        except PyMongoError as exc:
            raise map_pymongo_error(exc) from exc

    # ---- Versions ----------------------------------------------------------------

    async def get_version(self, version_id: str) -> KnowledgeDocumentVersionDocument | None:
        try:
            raw = await self._versions.find_one({"version_id": version_id})
        except PyMongoError as exc:
            raise map_pymongo_error(exc) from exc
        if raw is None:
            return None
        return KnowledgeDocumentVersionDocument.model_validate(raw)

    async def get_version_owned(
        self, document_id: str, version_id: str
    ) -> KnowledgeDocumentVersionDocument | None:
        try:
            raw = await self._versions.find_one(
                {"document_id": document_id, "version_id": version_id}
            )
        except PyMongoError as exc:
            raise map_pymongo_error(exc) from exc
        if raw is None:
            return None
        return KnowledgeDocumentVersionDocument.model_validate(raw)

    async def create_version(
        self, version: KnowledgeDocumentVersionDocument
    ) -> KnowledgeDocumentVersionDocument:
        payload = version.model_dump(by_alias=True)
        payload["_id"] = to_object_id(payload["_id"])
        try:
            await self._versions.insert_one(payload)
        except PyMongoError as exc:
            raise map_pymongo_error(exc) from exc
        return version

    async def upsert_seed_version(
        self, version: KnowledgeDocumentVersionDocument
    ) -> KnowledgeDocumentVersionDocument:
        """Idempotent seed sync. Never overwrite an already-approved version body."""
        existing = await self.get_version(version.version_id)
        if existing is not None and existing.review_status == KnowledgeStatus.APPROVED:
            return existing
        payload = version.model_dump(by_alias=True)
        payload["_id"] = to_object_id(payload["_id"])
        payload["updated_at"] = utc_now()
        try:
            await self._versions.update_one(
                {"version_id": version.version_id},
                {"$set": payload},
                upsert=True,
            )
        except PyMongoError as exc:
            raise map_pymongo_error(exc) from exc
        found = await self.get_version(version.version_id)
        assert found is not None
        return found

    async def list_versions(
        self,
        document_id: str,
        *,
        page: int = 1,
        page_size: int = 20,
    ) -> list[KnowledgeDocumentVersionDocument]:
        page, page_size = clamp_pagination(page, page_size)
        try:
            cursor = (
                self._versions.find({"document_id": document_id})
                .sort("version_number", -1)
                .skip((page - 1) * page_size)
                .limit(page_size)
            )
            docs = await cursor.to_list(length=page_size)
        except PyMongoError as exc:
            raise map_pymongo_error(exc) from exc
        return [KnowledgeDocumentVersionDocument.model_validate(d) for d in docs]

    async def count_versions(self, document_id: str) -> int:
        try:
            return await self._versions.count_documents({"document_id": document_id})
        except PyMongoError as exc:
            raise map_pymongo_error(exc) from exc

    async def update_version(
        self,
        version_id: str,
        updates: Mapping[str, Any],
        *,
        expected_version: int,
    ) -> KnowledgeDocumentVersionDocument:
        if any(key.startswith("$") for key in updates):
            raise RepositoryValidationError("Unsupported update operator")
        payload = dict(updates)
        payload["updated_at"] = utc_now()
        try:
            result: UpdateResult = await self._versions.update_one(
                {"version_id": version_id, "version": expected_version},
                {"$set": payload, "$inc": {"version": 1}},
            )
            if result.matched_count == 0:
                existing = await self.get_version(version_id)
                if existing is None:
                    raise RepositoryNotFoundError("Knowledge version not found")
                raise RepositoryConflictError(_CONFLICT)
            updated = await self.get_version(version_id)
            if updated is None:
                raise RepositoryNotFoundError("Knowledge version not found")
            return updated
        except PyMongoError as exc:
            raise map_pymongo_error(exc) from exc

    async def list_review_queue(
        self,
        *,
        page: int = 1,
        page_size: int = 20,
    ) -> list[KnowledgeDocumentVersionDocument]:
        page, page_size = clamp_pagination(page, page_size)
        try:
            cursor = (
                self._versions.find({"review_status": KnowledgeStatus.PENDING_REVIEW.value})
                .sort("submitted_for_review_at", 1)
                .skip((page - 1) * page_size)
                .limit(page_size)
            )
            docs = await cursor.to_list(length=page_size)
        except PyMongoError as exc:
            raise map_pymongo_error(exc) from exc
        return [KnowledgeDocumentVersionDocument.model_validate(d) for d in docs]

    async def count_review_queue(self) -> int:
        try:
            return await self._versions.count_documents(
                {"review_status": KnowledgeStatus.PENDING_REVIEW.value}
            )
        except PyMongoError as exc:
            raise map_pymongo_error(exc) from exc

    # ---- Review records (append-only) --------------------------------------------

    async def append_review_record(
        self, record: KnowledgeReviewRecordDocument
    ) -> KnowledgeReviewRecordDocument:
        payload = record.model_dump(by_alias=True)
        payload["_id"] = to_object_id(payload["_id"])
        try:
            await self._reviews.insert_one(payload)
        except PyMongoError as exc:
            raise map_pymongo_error(exc) from exc
        return record

    async def list_review_records(
        self,
        version_id: str,
        *,
        page: int = 1,
        page_size: int = 50,
    ) -> list[KnowledgeReviewRecordDocument]:
        page, page_size = clamp_pagination(page, page_size)
        try:
            cursor = (
                self._reviews.find({"version_id": version_id})
                .sort("created_at", -1)
                .skip((page - 1) * page_size)
                .limit(page_size)
            )
            docs = await cursor.to_list(length=page_size)
        except PyMongoError as exc:
            raise map_pymongo_error(exc) from exc
        return [KnowledgeReviewRecordDocument.model_validate(d) for d in docs]
