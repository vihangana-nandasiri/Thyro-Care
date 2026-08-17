"""Audit-log repository."""

from __future__ import annotations

from pymongo.asynchronous.database import AsyncDatabase

from app.db.collections import CollectionName
from app.models.supporting import AuditLogDocument
from app.repositories.base import BaseRepository


class AuditLogRepository(BaseRepository[AuditLogDocument]):
    collection_name = CollectionName.AUDIT_LOGS.value
    model_type = AuditLogDocument
    supports_soft_delete = False

    def __init__(self, database: AsyncDatabase) -> None:
        super().__init__(database)

    async def create_event(self, document: AuditLogDocument) -> AuditLogDocument:
        return await self.insert_one(document)
