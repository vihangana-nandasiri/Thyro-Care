"""Knowledge governance workflow — drafts, review, approval, retirement.

Role enforcement happens at the API dependency layer (require_admin /
require_medical_expert / require_admin_or_medical_expert). This service assumes
the caller has already been authorized for the action being performed.
"""

from __future__ import annotations

from uuid import uuid4

from pymongo.asynchronous.database import AsyncDatabase

from app.core.exceptions import ConflictException, NotFoundException, ValidationException
from app.models.enums import KnowledgeReviewDecision, KnowledgeStatus
from app.models.knowledge import (
    KnowledgeDocumentDocument,
    KnowledgeDocumentVersionDocument,
    KnowledgeReviewRecordDocument,
)
from app.models.object_id import object_id_to_string
from app.models.user import UserDocument
from app.repositories.exceptions import RepositoryConflictError, RepositoryNotFoundError
from app.repositories.knowledge_governance_repository import KnowledgeGovernanceRepository
from app.repositories.knowledge_repository import KnowledgeRepository
from app.schemas.knowledge_governance import (
    KnowledgeApprovalResult,
    KnowledgeApproveRequest,
    KnowledgeCompareResponse,
    KnowledgeDocumentDetail,
    KnowledgeDocumentListResponse,
    KnowledgeDocumentPublic,
    KnowledgeDraftCreate,
    KnowledgeDraftUpdate,
    KnowledgeNewVersionRequest,
    KnowledgeRejectRequest,
    KnowledgeRequestChangesRequest,
    KnowledgeRestoreRequest,
    KnowledgeRetireRequest,
    KnowledgeReviewQueueItem,
    KnowledgeReviewQueueResponse,
    KnowledgeReviewRecordPublic,
    KnowledgeSubmitRequest,
    KnowledgeVersionPublic,
)
from app.services.audit_service import AuditActions, AuditService
from app.services.knowledge_diff_service import KnowledgeDiffService
from app.services.knowledge_ingestion_service import canonical_content_hash, ingest_approved_version
from app.utils.datetime import utc_now

_NOT_FOUND = "This knowledge document is no longer available."
_EDITABLE_STATES = {KnowledgeStatus.DRAFT, KnowledgeStatus.CHANGES_REQUESTED}


def _new_document_id() -> str:
    return f"kg-{uuid4().hex[:24]}"


def _hash_of(
    *,
    title: str,
    source_name: str,
    source_url: str | None,
    topic: str,
    language: str,
    body: str,
    medical_disclaimer: str,
) -> str:
    return canonical_content_hash(
        title=title,
        source_name=source_name,
        source_url=source_url,
        topic=topic,
        language=language,
        body=body,
        medical_disclaimer=medical_disclaimer,
    )


def _version_public(version: KnowledgeDocumentVersionDocument) -> KnowledgeVersionPublic:
    return KnowledgeVersionPublic(
        version_id=version.version_id,
        version_number=version.version_number,
        title=version.title,
        source_name=version.source_name,
        source_url=version.source_url,
        topic=version.topic,
        language=version.language,
        body=version.body,
        medical_disclaimer=version.medical_disclaimer,
        content_hash=version.content_hash,
        review_status=version.review_status,
        created_by_user_id=(
            object_id_to_string(version.created_by_user_id) if version.created_by_user_id else None
        ),
        created_at=version.created_at,
        submitted_for_review_at=version.submitted_for_review_at,
        submitted_by_user_id=(
            object_id_to_string(version.submitted_by_user_id)
            if version.submitted_by_user_id
            else None
        ),
        approved_at=version.approved_at,
        approved_by_user_id=(
            object_id_to_string(version.approved_by_user_id)
            if version.approved_by_user_id
            else None
        ),
        rejected_at=version.rejected_at,
        rejected_by_user_id=(
            object_id_to_string(version.rejected_by_user_id)
            if version.rejected_by_user_id
            else None
        ),
        retired_at=version.retired_at,
        retired_by_user_id=(
            object_id_to_string(version.retired_by_user_id) if version.retired_by_user_id else None
        ),
        review_summary=version.review_summary,
        supersedes_version_id=version.supersedes_version_id,
        version=version.version,
    )


def _document_public(
    document: KnowledgeDocumentDocument,
    *,
    current_version_number: int | None = None,
) -> KnowledgeDocumentPublic:
    return KnowledgeDocumentPublic(
        document_id=document.document_id,
        slug=document.slug,
        title=document.title or "",
        current_version_id=document.current_version_id,
        current_version_number=current_version_number,
        current_status=document.current_status,
        topic=document.topic,
        language=document.language,
        created_by_user_id=(
            object_id_to_string(document.created_by_user_id)
            if document.created_by_user_id
            else None
        ),
        version=document.version,
        created_at=document.created_at,
        updated_at=document.updated_at,
    )


class KnowledgeGovernanceService:
    def __init__(self, database: AsyncDatabase) -> None:
        self.repo = KnowledgeGovernanceRepository(database)
        self.knowledge = KnowledgeRepository(database)
        self.audit = AuditService(database)
        self.diff_service = KnowledgeDiffService()

    async def _require_document(self, document_id: str) -> KnowledgeDocumentDocument:
        document = await self.repo.get_document(document_id)
        if document is None:
            raise NotFoundException(_NOT_FOUND)
        return document

    async def _require_version(
        self, document_id: str, version_id: str
    ) -> KnowledgeDocumentVersionDocument:
        version = await self.repo.get_version_owned(document_id, version_id)
        if version is None:
            raise NotFoundException(_NOT_FOUND)
        return version

    async def _detail(self, document: KnowledgeDocumentDocument) -> KnowledgeDocumentDetail:
        versions = await self.repo.list_versions(document.document_id, page=1, page_size=100)
        current = None
        if document.current_version_id:
            current = next(
                (v for v in versions if v.version_id == document.current_version_id), None
            )
        return KnowledgeDocumentDetail(
            document=_document_public(
                document,
                current_version_number=current.version_number if current else None,
            ),
            current_version=_version_public(current) if current else None,
            versions=[_version_public(v) for v in versions],
        )

    # ---- Create / edit drafts (ADMIN) --------------------------------------------

    async def create_draft(
        self, user: UserDocument, payload: KnowledgeDraftCreate
    ) -> KnowledgeDocumentDetail:
        document_id = _new_document_id()
        version_id = f"{document_id}:v1"
        digest = _hash_of(
            title=payload.title,
            source_name=payload.source_name,
            source_url=payload.source_url,
            topic=payload.topic.value,
            language=payload.language.value,
            body=payload.body,
            medical_disclaimer=payload.medical_disclaimer,
        )
        version = KnowledgeDocumentVersionDocument(
            document_id=document_id,
            version_id=version_id,
            version_number=1,
            title=payload.title,
            source_name=payload.source_name,
            source_url=payload.source_url,
            topic=payload.topic.value,
            language=payload.language.value,
            body=payload.body,
            medical_disclaimer=payload.medical_disclaimer,
            content_hash=digest,
            review_status=KnowledgeStatus.DRAFT,
            created_by_user_id=user.id,
        )
        await self.repo.create_version(version)

        document = KnowledgeDocumentDocument(
            document_id=document_id,
            slug=payload.slug,
            current_version_id=version_id,
            current_status=KnowledgeStatus.DRAFT,
            topic=payload.topic.value,
            language=payload.language.value,
            created_by_user_id=user.id,
            title=payload.title,
            review_status=KnowledgeStatus.DRAFT,
            status=KnowledgeStatus.DRAFT,
            active=False,
        )
        created = await self.repo.create_document(document)

        await self.audit.record(
            AuditActions.KNOWLEDGE_DRAFT_CREATED,
            actor_user_id=user.id,
            entity_type="knowledge_document",
            changes_summary=f"document_id={document_id};version_id={version_id}",
        )
        return await self._detail(created)

    async def update_draft(
        self, user: UserDocument, document_id: str, payload: KnowledgeDraftUpdate
    ) -> KnowledgeDocumentDetail:
        document = await self._require_document(document_id)
        if not document.current_version_id:
            raise ValidationException("Document has no editable version")
        version = await self._require_version(document_id, document.current_version_id)
        if version.review_status not in _EDITABLE_STATES:
            raise ValidationException(
                "Content can only be edited while in draft or changes-requested state"
            )

        updates = payload.editable_payload()
        if not updates:
            raise ValidationException("No fields to update")

        merged = {
            "title": updates.get("title", version.title),
            "source_name": updates.get("source_name", version.source_name),
            "source_url": updates.get("source_url", version.source_url),
            "topic": (
                updates["topic"].value if "topic" in updates and updates["topic"] else version.topic
            ),
            "language": (
                updates["language"].value
                if "language" in updates and updates["language"]
                else version.language
            ),
            "body": updates.get("body", version.body),
            "medical_disclaimer": updates.get("medical_disclaimer", version.medical_disclaimer),
        }
        digest = _hash_of(**merged)
        version_updates = {
            **merged,
            "content_hash": digest,
            "review_status": KnowledgeStatus.DRAFT,
            "submitted_for_review_at": None,
            "submitted_by_user_id": None,
        }
        try:
            await self.repo.update_version(
                version.version_id, version_updates, expected_version=payload.expected_version
            )
        except RepositoryNotFoundError as exc:
            raise NotFoundException(_NOT_FOUND) from exc
        except RepositoryConflictError as exc:
            raise ConflictException(str(exc)) from exc

        try:
            await self.repo.update_document(
                document_id,
                {
                    "title": merged["title"],
                    "topic": merged["topic"],
                    "language": merged["language"],
                    "current_status": KnowledgeStatus.DRAFT,
                },
                expected_version=document.version,
            )
        except (RepositoryNotFoundError, RepositoryConflictError):
            pass  # Parent mirror fields are best-effort; version is the source of truth.

        await self.audit.record(
            AuditActions.KNOWLEDGE_DRAFT_UPDATED,
            actor_user_id=user.id,
            entity_type="knowledge_document",
            changes_summary=f"document_id={document_id};fields={','.join(sorted(updates))}",
        )
        refreshed = await self._require_document(document_id)
        return await self._detail(refreshed)

    # ---- Submit for review (ADMIN) -----------------------------------------------

    async def submit_for_review(
        self, user: UserDocument, document_id: str, payload: KnowledgeSubmitRequest
    ) -> KnowledgeDocumentDetail:
        document = await self._require_document(document_id)
        if not document.current_version_id:
            raise ValidationException("Document has no version to submit")
        version = await self._require_version(document_id, document.current_version_id)
        if version.review_status not in _EDITABLE_STATES:
            raise ValidationException("Only draft or changes-requested content can be submitted")
        if not version.body.strip():
            raise ValidationException("Body is required before submission")

        try:
            await self.repo.update_version(
                version.version_id,
                {
                    "review_status": KnowledgeStatus.PENDING_REVIEW,
                    "submitted_for_review_at": utc_now(),
                    "submitted_by_user_id": user.id,
                },
                expected_version=payload.expected_version,
            )
        except RepositoryNotFoundError as exc:
            raise NotFoundException(_NOT_FOUND) from exc
        except RepositoryConflictError as exc:
            raise ConflictException(str(exc)) from exc

        try:
            await self.repo.update_document(
                document_id,
                {"current_status": KnowledgeStatus.PENDING_REVIEW},
                expected_version=document.version,
            )
        except (RepositoryNotFoundError, RepositoryConflictError):
            pass

        await self.audit.record(
            AuditActions.KNOWLEDGE_SUBMITTED_FOR_REVIEW,
            actor_user_id=user.id,
            entity_type="knowledge_document",
            changes_summary=f"document_id={document_id};version_id={version.version_id}",
        )
        refreshed = await self._require_document(document_id)
        return await self._detail(refreshed)

    # ---- Review decisions (MEDICAL_EXPERT) ---------------------------------------

    async def approve(
        self,
        user: UserDocument,
        document_id: str,
        version_id: str,
        payload: KnowledgeApproveRequest,
    ) -> KnowledgeApprovalResult:
        document = await self._require_document(document_id)
        version = await self._require_version(document_id, version_id)
        if version.review_status != KnowledgeStatus.PENDING_REVIEW:
            raise ValidationException("Only content pending review can be approved")
        if version.content_hash != payload.expected_content_hash:
            raise ConflictException(
                "Content changed since it was queued for review. Reload and try again."
            )

        now = utc_now()
        try:
            updated_version = await self.repo.update_version(
                version_id,
                {
                    "review_status": KnowledgeStatus.APPROVED,
                    "approved_at": now,
                    "approved_by_user_id": user.id,
                    "review_summary": payload.review_summary,
                },
                expected_version=payload.expected_version,
            )
        except RepositoryNotFoundError as exc:
            raise NotFoundException(_NOT_FOUND) from exc
        except RepositoryConflictError as exc:
            raise ConflictException(str(exc)) from exc

        await self.repo.append_review_record(
            KnowledgeReviewRecordDocument(
                document_id=document_id,
                version_id=version_id,
                reviewer_user_id=user.id,
                reviewer_role=user.role.value,
                decision=KnowledgeReviewDecision.APPROVE,
                reviewed_content_hash=version.content_hash,
                comments=payload.review_summary,
            )
        )

        content_version = str(updated_version.version_number)
        try:
            updated_document = await self.repo.update_document(
                document_id,
                {
                    "current_status": KnowledgeStatus.APPROVED,
                    "title": updated_version.title,
                    "source_name": updated_version.source_name,
                    "source_url": updated_version.source_url,
                    "body": updated_version.body,
                    "medical_disclaimer": updated_version.medical_disclaimer,
                    "content_hash": updated_version.content_hash,
                    "review_status": KnowledgeStatus.APPROVED,
                    "status": KnowledgeStatus.APPROVED,
                    "active": True,
                    "content_version": content_version,
                },
                expected_version=document.version,
            )
        except RepositoryConflictError:
            updated_document = await self._require_document(document_id)
        except RepositoryNotFoundError as exc:
            raise NotFoundException(_NOT_FOUND) from exc

        await self.audit.record(
            AuditActions.KNOWLEDGE_APPROVED,
            actor_user_id=user.id,
            entity_type="knowledge_document",
            changes_summary=f"document_id={document_id};version_id={version_id};hash={version.content_hash[:12]}",
        )

        ingestion_status = "completed"
        ingestion_message: str | None = None
        try:
            await ingest_approved_version(updated_version, self.knowledge)
            await self.audit.record(
                AuditActions.KNOWLEDGE_INGESTION_COMPLETED,
                actor_user_id=user.id,
                entity_type="knowledge_document",
                changes_summary=f"document_id={document_id};version_id={version_id}",
            )
        except Exception:  # noqa: BLE001 — ingestion failure must not break approval recording
            ingestion_status = "failed"
            ingestion_message = "Ingestion failed. The approval was recorded; retry ingestion."
            await self.audit.record(
                AuditActions.KNOWLEDGE_INGESTION_FAILED,
                actor_user_id=user.id,
                entity_type="knowledge_document",
                changes_summary=f"document_id={document_id};version_id={version_id}",
            )

        return KnowledgeApprovalResult(
            document=_document_public(updated_document),
            version=_version_public(updated_version),
            ingestion_status=ingestion_status,
            ingestion_message=ingestion_message,
        )

    async def request_changes(
        self,
        user: UserDocument,
        document_id: str,
        version_id: str,
        payload: KnowledgeRequestChangesRequest,
    ) -> KnowledgeDocumentDetail:
        document = await self._require_document(document_id)
        version = await self._require_version(document_id, version_id)
        if version.review_status != KnowledgeStatus.PENDING_REVIEW:
            raise ValidationException("Only content pending review can receive changes requests")
        if version.content_hash != payload.expected_content_hash:
            raise ConflictException(
                "Content changed since it was queued for review. Reload and try again."
            )

        try:
            await self.repo.update_version(
                version_id,
                {"review_status": KnowledgeStatus.CHANGES_REQUESTED},
                expected_version=payload.expected_version,
            )
        except RepositoryNotFoundError as exc:
            raise NotFoundException(_NOT_FOUND) from exc
        except RepositoryConflictError as exc:
            raise ConflictException(str(exc)) from exc

        await self.repo.append_review_record(
            KnowledgeReviewRecordDocument(
                document_id=document_id,
                version_id=version_id,
                reviewer_user_id=user.id,
                reviewer_role=user.role.value,
                decision=KnowledgeReviewDecision.REQUEST_CHANGES,
                reviewed_content_hash=version.content_hash,
                comments=payload.comments,
            )
        )
        try:
            await self.repo.update_document(
                document_id,
                {"current_status": KnowledgeStatus.CHANGES_REQUESTED},
                expected_version=document.version,
            )
        except (RepositoryNotFoundError, RepositoryConflictError):
            pass

        await self.audit.record(
            AuditActions.KNOWLEDGE_CHANGES_REQUESTED,
            actor_user_id=user.id,
            entity_type="knowledge_document",
            changes_summary=f"document_id={document_id};version_id={version_id}",
        )
        refreshed = await self._require_document(document_id)
        return await self._detail(refreshed)

    async def reject(
        self,
        user: UserDocument,
        document_id: str,
        version_id: str,
        payload: KnowledgeRejectRequest,
    ) -> KnowledgeDocumentDetail:
        document = await self._require_document(document_id)
        version = await self._require_version(document_id, version_id)
        if version.review_status != KnowledgeStatus.PENDING_REVIEW:
            raise ValidationException("Only content pending review can be rejected")
        if version.content_hash != payload.expected_content_hash:
            raise ConflictException(
                "Content changed since it was queued for review. Reload and try again."
            )

        try:
            await self.repo.update_version(
                version_id,
                {
                    "review_status": KnowledgeStatus.REJECTED,
                    "rejected_at": utc_now(),
                    "rejected_by_user_id": user.id,
                },
                expected_version=payload.expected_version,
            )
        except RepositoryNotFoundError as exc:
            raise NotFoundException(_NOT_FOUND) from exc
        except RepositoryConflictError as exc:
            raise ConflictException(str(exc)) from exc

        await self.repo.append_review_record(
            KnowledgeReviewRecordDocument(
                document_id=document_id,
                version_id=version_id,
                reviewer_user_id=user.id,
                reviewer_role=user.role.value,
                decision=KnowledgeReviewDecision.REJECT,
                reviewed_content_hash=version.content_hash,
                comments=payload.comments,
            )
        )
        try:
            await self.repo.update_document(
                document_id,
                {"current_status": KnowledgeStatus.REJECTED},
                expected_version=document.version,
            )
        except (RepositoryNotFoundError, RepositoryConflictError):
            pass

        await self.audit.record(
            AuditActions.KNOWLEDGE_REJECTED,
            actor_user_id=user.id,
            entity_type="knowledge_document",
            changes_summary=f"document_id={document_id};version_id={version_id}",
        )
        refreshed = await self._require_document(document_id)
        return await self._detail(refreshed)

    # ---- New version from approved (ADMIN) ---------------------------------------

    async def create_new_version(
        self, user: UserDocument, document_id: str, payload: KnowledgeNewVersionRequest
    ) -> KnowledgeDocumentDetail:
        document = await self._require_document(document_id)
        if document.current_status != KnowledgeStatus.APPROVED:
            raise ValidationException("A new version can only be created from approved content")
        if not document.current_version_id:
            raise ValidationException("Document has no approved version")
        base_version = await self._require_version(document_id, document.current_version_id)

        overrides = payload.overrides()
        merged = {
            "title": overrides.get("title", base_version.title),
            "source_name": overrides.get("source_name", base_version.source_name),
            "source_url": overrides.get("source_url", base_version.source_url),
            "topic": (
                overrides["topic"].value
                if "topic" in overrides and overrides["topic"]
                else base_version.topic
            ),
            "language": (
                overrides["language"].value
                if "language" in overrides and overrides["language"]
                else base_version.language
            ),
            "body": overrides.get("body", base_version.body),
            "medical_disclaimer": overrides.get(
                "medical_disclaimer", base_version.medical_disclaimer
            ),
        }
        digest = _hash_of(**merged)
        next_number = base_version.version_number + 1
        new_version_id = f"{document_id}:v{next_number}"
        new_version = KnowledgeDocumentVersionDocument(
            document_id=document_id,
            version_id=new_version_id,
            version_number=next_number,
            supersedes_version_id=base_version.version_id,
            review_status=KnowledgeStatus.DRAFT,
            created_by_user_id=user.id,
            content_hash=digest,
            **merged,
        )
        await self.repo.create_version(new_version)

        try:
            updated = await self.repo.update_document(
                document_id,
                {
                    "current_version_id": new_version_id,
                    "current_status": KnowledgeStatus.DRAFT,
                    "topic": merged["topic"],
                    "language": merged["language"],
                },
                expected_version=payload.expected_version,
            )
        except RepositoryNotFoundError as exc:
            raise NotFoundException(_NOT_FOUND) from exc
        except RepositoryConflictError as exc:
            raise ConflictException(str(exc)) from exc

        await self.audit.record(
            AuditActions.KNOWLEDGE_VERSION_CREATED,
            actor_user_id=user.id,
            entity_type="knowledge_document",
            changes_summary=f"document_id={document_id};version_id={new_version_id}",
        )
        return await self._detail(updated)

    # ---- Retire / restore ----------------------------------------------------------

    async def retire(
        self, user: UserDocument, document_id: str, payload: KnowledgeRetireRequest
    ) -> KnowledgeDocumentDetail:
        document = await self._require_document(document_id)
        if document.current_status != KnowledgeStatus.APPROVED:
            raise ValidationException("Only approved content can be retired")

        try:
            updated = await self.repo.update_document(
                document_id,
                {
                    "current_status": KnowledgeStatus.RETIRED,
                    "status": KnowledgeStatus.RETIRED,
                    "review_status": KnowledgeStatus.RETIRED,
                    "active": False,
                },
                expected_version=payload.expected_version,
            )
        except RepositoryNotFoundError as exc:
            raise NotFoundException(_NOT_FOUND) from exc
        except RepositoryConflictError as exc:
            raise ConflictException(str(exc)) from exc

        if document.current_version_id:
            current_version = await self.repo.get_version_owned(
                document_id, document.current_version_id
            )
            if current_version is not None:
                try:
                    await self.repo.update_version(
                        current_version.version_id,
                        {
                            "review_status": KnowledgeStatus.RETIRED,
                            "retired_at": utc_now(),
                            "retired_by_user_id": user.id,
                        },
                        expected_version=current_version.version,
                    )
                except (RepositoryNotFoundError, RepositoryConflictError):
                    pass

        await self.knowledge.retire_old_chunks(document_id, None)

        await self.audit.record(
            AuditActions.KNOWLEDGE_RETIRED,
            actor_user_id=user.id,
            entity_type="knowledge_document",
            changes_summary=f"document_id={document_id};reason_len={len(payload.reason)}",
        )
        return await self._detail(updated)

    async def restore(
        self, user: UserDocument, document_id: str, payload: KnowledgeRestoreRequest
    ) -> KnowledgeApprovalResult:
        document = await self._require_document(document_id)
        if document.current_status != KnowledgeStatus.RETIRED:
            raise ValidationException("Only retired content can be restored")
        if not document.current_version_id:
            raise ValidationException("Document has no version to restore")
        version = await self._require_version(document_id, document.current_version_id)
        if version.content_hash != payload.expected_content_hash:
            raise ConflictException(
                "Approved content hash no longer matches. Reload and try again."
            )

        try:
            updated_version = await self.repo.update_version(
                version.version_id,
                {"review_status": KnowledgeStatus.APPROVED},
                expected_version=version.version,
            )
        except RepositoryNotFoundError as exc:
            raise NotFoundException(_NOT_FOUND) from exc
        except RepositoryConflictError as exc:
            raise ConflictException(str(exc)) from exc

        await self.repo.append_review_record(
            KnowledgeReviewRecordDocument(
                document_id=document_id,
                version_id=version.version_id,
                reviewer_user_id=user.id,
                reviewer_role=user.role.value,
                decision=KnowledgeReviewDecision.RESTORE,
                reviewed_content_hash=version.content_hash,
            )
        )

        try:
            updated_document = await self.repo.update_document(
                document_id,
                {
                    "current_status": KnowledgeStatus.APPROVED,
                    "status": KnowledgeStatus.APPROVED,
                    "review_status": KnowledgeStatus.APPROVED,
                    "active": True,
                },
                expected_version=payload.expected_version,
            )
        except RepositoryNotFoundError as exc:
            raise NotFoundException(_NOT_FOUND) from exc
        except RepositoryConflictError as exc:
            raise ConflictException(str(exc)) from exc

        await self.audit.record(
            AuditActions.KNOWLEDGE_RESTORED,
            actor_user_id=user.id,
            entity_type="knowledge_document",
            changes_summary=f"document_id={document_id};version_id={version.version_id}",
        )

        ingestion_status = "completed"
        ingestion_message: str | None = None
        try:
            await ingest_approved_version(updated_version, self.knowledge)
            await self.audit.record(
                AuditActions.KNOWLEDGE_INGESTION_COMPLETED,
                actor_user_id=user.id,
                entity_type="knowledge_document",
                changes_summary=f"document_id={document_id};version_id={version.version_id}",
            )
        except Exception:  # noqa: BLE001
            ingestion_status = "failed"
            ingestion_message = "Ingestion failed. The restore was recorded; retry ingestion."
            await self.audit.record(
                AuditActions.KNOWLEDGE_INGESTION_FAILED,
                actor_user_id=user.id,
                entity_type="knowledge_document",
                changes_summary=f"document_id={document_id};version_id={version.version_id}",
            )

        return KnowledgeApprovalResult(
            document=_document_public(updated_document),
            version=_version_public(updated_version),
            ingestion_status=ingestion_status,
            ingestion_message=ingestion_message,
        )

    async def retry_ingestion(
        self,
        user: UserDocument,
        document_id: str,
        version_id: str,
        *,
        expected_content_hash: str,
    ) -> KnowledgeApprovalResult:
        """Re-run deterministic ingestion for an already-approved version (no re-approval)."""
        document = await self._require_document(document_id)
        version = await self._require_version(document_id, version_id)
        if version.review_status != KnowledgeStatus.APPROVED:
            raise ValidationException("Only approved versions can be re-ingested")
        if document.current_status != KnowledgeStatus.APPROVED:
            raise ValidationException("Document must be approved before retrying ingestion")
        if version.content_hash != expected_content_hash:
            raise ConflictException("Content changed since approval. Reload and try again.")

        ingestion_status = "completed"
        ingestion_message: str | None = None
        try:
            await ingest_approved_version(version, self.knowledge)
            await self.audit.record(
                AuditActions.KNOWLEDGE_INGESTION_COMPLETED,
                actor_user_id=user.id,
                entity_type="knowledge_document",
                changes_summary=f"document_id={document_id};version_id={version_id};retry=1",
            )
        except Exception:  # noqa: BLE001
            ingestion_status = "failed"
            ingestion_message = "Ingestion failed. The approval was recorded; retry ingestion."
            await self.audit.record(
                AuditActions.KNOWLEDGE_INGESTION_FAILED,
                actor_user_id=user.id,
                entity_type="knowledge_document",
                changes_summary=f"document_id={document_id};version_id={version_id};retry=1",
            )

        return KnowledgeApprovalResult(
            document=_document_public(document),
            version=_version_public(version),
            ingestion_status=ingestion_status,
            ingestion_message=ingestion_message,
        )

    # ---- Read-only views (ADMIN + MEDICAL_EXPERT) ----------------------------------

    async def get_document_detail(self, document_id: str) -> KnowledgeDocumentDetail:
        document = await self._require_document(document_id)
        return await self._detail(document)

    async def list_documents(
        self,
        *,
        status: KnowledgeStatus | None = None,
        topic: str | None = None,
        language: str | None = None,
        page: int = 1,
        page_size: int = 20,
    ) -> KnowledgeDocumentListResponse:
        page = max(1, page)
        page_size = min(max(1, page_size), 100)
        items = await self.repo.list_documents(
            status=status, topic=topic, language=language, page=page, page_size=page_size
        )
        total = await self.repo.count_documents_filtered(
            status=status, topic=topic, language=language
        )
        return KnowledgeDocumentListResponse(
            items=[_document_public(d) for d in items],
            total=total,
            page=page,
            page_size=page_size,
        )

    async def review_queue(
        self, *, page: int = 1, page_size: int = 20
    ) -> KnowledgeReviewQueueResponse:
        page = max(1, page)
        page_size = min(max(1, page_size), 100)
        versions = await self.repo.list_review_queue(page=page, page_size=page_size)
        total = await self.repo.count_review_queue()
        items = [
            KnowledgeReviewQueueItem(
                document_id=v.document_id,
                version_id=v.version_id,
                version_number=v.version_number,
                title=v.title,
                topic=v.topic,
                language=v.language,
                content_hash=v.content_hash,
                submitted_for_review_at=v.submitted_for_review_at,
                submitted_by_user_id=(
                    object_id_to_string(v.submitted_by_user_id) if v.submitted_by_user_id else None
                ),
            )
            for v in versions
        ]
        return KnowledgeReviewQueueResponse(
            items=items, total=total, page=page, page_size=page_size
        )

    async def list_review_records(
        self, document_id: str, version_id: str
    ) -> list[KnowledgeReviewRecordPublic]:
        await self._require_version(document_id, version_id)
        records = await self.repo.list_review_records(version_id, page=1, page_size=100)
        return [
            KnowledgeReviewRecordPublic(
                id=object_id_to_string(r.id),
                document_id=r.document_id,
                version_id=r.version_id,
                reviewer_user_id=object_id_to_string(r.reviewer_user_id),
                reviewer_role=r.reviewer_role,
                decision=r.decision,
                reviewed_content_hash=r.reviewed_content_hash,
                comments=r.comments,
                created_at=r.created_at,
            )
            for r in records
        ]

    async def compare(
        self, document_id: str, from_version_id: str | None, to_version_id: str
    ) -> KnowledgeCompareResponse:
        to_version = await self._require_version(document_id, to_version_id)
        from_text = ""
        if from_version_id:
            from_version = await self._require_version(document_id, from_version_id)
            from_text = from_version.body
        lines, truncated = self.diff_service.diff(from_text, to_version.body)
        return KnowledgeCompareResponse(
            document_id=document_id,
            from_version_id=from_version_id,
            to_version_id=to_version_id,
            lines=lines,
            truncated=truncated,
        )
