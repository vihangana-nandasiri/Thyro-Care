"""Knowledge governance API — draft authoring, medical-expert review, publication.

Authorization matrix (see docs/phase-12-knowledge-governance-plan.md):
- ADMIN: create/edit drafts, submit, create new versions from approved, retire.
- MEDICAL_EXPERT: approve, request changes, reject, restore; may also retire.
- PATIENT: no access (403).
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Query, status

from app.api.dependencies import (
    DatabaseDep,
    require_admin_or_medical_expert,
    require_knowledge_manager,
    require_knowledge_reviewer,
)
from app.core.exceptions import NotFoundException, ValidationException
from app.models.enums import KnowledgeReviewDecision, KnowledgeStatus
from app.models.user import UserDocument
from app.schemas.knowledge_governance import (
    KnowledgeApprovalResult,
    KnowledgeApproveRequest,
    KnowledgeCompareResponse,
    KnowledgeDocumentDetail,
    KnowledgeDocumentListResponse,
    KnowledgeDraftCreate,
    KnowledgeDraftUpdate,
    KnowledgeNewVersionRequest,
    KnowledgeRejectRequest,
    KnowledgeRequestChangesRequest,
    KnowledgeRestoreRequest,
    KnowledgeRetireRequest,
    KnowledgeRetryIngestRequest,
    KnowledgeReviewDecisionRequest,
    KnowledgeReviewQueueResponse,
    KnowledgeReviewRecordPublic,
    KnowledgeSubmitRequest,
    KnowledgeVersionPublic,
)
from app.services.knowledge_governance_service import KnowledgeGovernanceService

router = APIRouter(prefix="/governance", tags=["knowledge-governance"])

_GOVERNANCE_NOTICE = (
    "Governance content (drafts, review notes, decisions) is never exposed to patients. "
    "Only APPROVED content reaches patient-facing retrieval."
)

KnowledgeManager = Annotated[UserDocument, Depends(require_knowledge_manager)]
KnowledgeReviewer = Annotated[UserDocument, Depends(require_knowledge_reviewer)]
KnowledgeViewer = Annotated[UserDocument, Depends(require_admin_or_medical_expert)]
KnowledgeRetirer = Annotated[UserDocument, Depends(require_admin_or_medical_expert)]


def get_governance_service(database: DatabaseDep) -> KnowledgeGovernanceService:
    return KnowledgeGovernanceService(database)


GovernanceServiceDep = Annotated[KnowledgeGovernanceService, Depends(get_governance_service)]


@router.post(
    "/knowledge",
    response_model=KnowledgeDocumentDetail,
    status_code=status.HTTP_201_CREATED,
    summary="Create a knowledge draft",
    description=_GOVERNANCE_NOTICE,
)
async def create_draft(
    payload: KnowledgeDraftCreate,
    user: KnowledgeManager,
    service: GovernanceServiceDep,
) -> KnowledgeDocumentDetail:
    return await service.create_draft(user, payload)


@router.get(
    "/knowledge",
    response_model=KnowledgeDocumentListResponse,
    summary="List governance documents",
    description=_GOVERNANCE_NOTICE,
)
async def list_documents(
    user: KnowledgeViewer,
    service: GovernanceServiceDep,
    status_filter: KnowledgeStatus | None = Query(default=None, alias="status"),
    topic: str | None = Query(default=None, max_length=100),
    language: str | None = Query(default=None, max_length=32),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
) -> KnowledgeDocumentListResponse:
    _ = user
    return await service.list_documents(
        status=status_filter, topic=topic, language=language, page=page, page_size=page_size
    )


@router.get(
    "/review-queue",
    response_model=KnowledgeReviewQueueResponse,
    summary="List versions pending medical-expert review",
    description=_GOVERNANCE_NOTICE,
)
async def review_queue(
    user: KnowledgeViewer,
    service: GovernanceServiceDep,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
) -> KnowledgeReviewQueueResponse:
    _ = user
    return await service.review_queue(page=page, page_size=page_size)


@router.get(
    "/review-queue/{document_id}/{version_id}",
    response_model=KnowledgeDocumentDetail,
    summary="Inspect a review-queue item",
    description=_GOVERNANCE_NOTICE,
)
async def get_review_item(
    document_id: str,
    version_id: str,
    user: KnowledgeViewer,
    service: GovernanceServiceDep,
) -> KnowledgeDocumentDetail:
    _ = user
    detail = await service.get_document_detail(document_id)
    if detail.current_version is None or detail.current_version.version_id != version_id:
        # Still return document detail filtered to the requested version when present.
        match = next((v for v in detail.versions if v.version_id == version_id), None)
        if match is None:
            raise NotFoundException("Resource not found")
        return KnowledgeDocumentDetail(
            document=detail.document,
            current_version=match,
            versions=detail.versions,
        )
    return detail


@router.post(
    "/review-queue/{document_id}/{version_id}/decision",
    response_model=KnowledgeApprovalResult | KnowledgeDocumentDetail,
    summary="Record medical-expert review decision",
    description=_GOVERNANCE_NOTICE + " No LLM / automatic approval — human decision only.",
    responses={409: {"description": "Version or content-hash conflict"}},
)
async def submit_review_decision(
    document_id: str,
    version_id: str,
    payload: KnowledgeReviewDecisionRequest,
    user: KnowledgeReviewer,
    service: GovernanceServiceDep,
) -> KnowledgeApprovalResult | KnowledgeDocumentDetail:
    if payload.decision == KnowledgeReviewDecision.APPROVE:
        return await service.approve(
            user,
            document_id,
            version_id,
            KnowledgeApproveRequest(
                expected_version=payload.expected_version,
                expected_content_hash=payload.expected_content_hash,
                review_summary=payload.comments,
            ),
        )
    if payload.decision == KnowledgeReviewDecision.REQUEST_CHANGES:
        if not payload.comments or not payload.comments.strip():
            raise ValidationException("Comments are required when requesting changes")
        return await service.request_changes(
            user,
            document_id,
            version_id,
            KnowledgeRequestChangesRequest(
                expected_version=payload.expected_version,
                expected_content_hash=payload.expected_content_hash,
                comments=payload.comments,
            ),
        )
    if payload.decision == KnowledgeReviewDecision.REJECT:
        if not payload.comments or not payload.comments.strip():
            raise ValidationException("Comments are required when rejecting content")
        return await service.reject(
            user,
            document_id,
            version_id,
            KnowledgeRejectRequest(
                expected_version=payload.expected_version,
                expected_content_hash=payload.expected_content_hash,
                comments=payload.comments,
            ),
        )
    raise ValidationException("Unsupported review decision for this endpoint")


@router.get(
    "/knowledge/{document_id}",
    response_model=KnowledgeDocumentDetail,
    summary="Get governance document with versions",
    description=_GOVERNANCE_NOTICE,
)
async def get_document(
    document_id: str,
    user: KnowledgeViewer,
    service: GovernanceServiceDep,
) -> KnowledgeDocumentDetail:
    _ = user
    return await service.get_document_detail(document_id)


@router.get(
    "/knowledge/{document_id}/versions",
    response_model=list[KnowledgeVersionPublic],
    summary="List document versions",
    description=_GOVERNANCE_NOTICE,
)
async def list_versions(
    document_id: str,
    user: KnowledgeViewer,
    service: GovernanceServiceDep,
) -> list[KnowledgeVersionPublic]:
    _ = user
    detail = await service.get_document_detail(document_id)
    return detail.versions


@router.get(
    "/knowledge/{document_id}/versions/{version_id}",
    response_model=KnowledgeVersionPublic,
    summary="Get a single document version",
    description=_GOVERNANCE_NOTICE,
)
async def get_version(
    document_id: str,
    version_id: str,
    user: KnowledgeViewer,
    service: GovernanceServiceDep,
) -> KnowledgeVersionPublic:
    _ = user
    detail = await service.get_document_detail(document_id)
    match = next((v for v in detail.versions if v.version_id == version_id), None)
    if match is None:
        raise NotFoundException("Resource not found")
    return match


@router.get(
    "/knowledge/{document_id}/compare",
    response_model=KnowledgeCompareResponse,
    summary="Compare two versions of a document",
    description=_GOVERNANCE_NOTICE,
)
async def compare_versions(
    document_id: str,
    to_version_id: str,
    user: KnowledgeViewer,
    service: GovernanceServiceDep,
    from_version_id: str | None = None,
) -> KnowledgeCompareResponse:
    _ = user
    return await service.compare(document_id, from_version_id, to_version_id)


@router.patch(
    "/knowledge/{document_id}/versions/{version_id}",
    response_model=KnowledgeDocumentDetail,
    summary="Update a knowledge draft version",
    description=_GOVERNANCE_NOTICE,
    responses={409: {"description": "Version conflict"}},
)
async def update_draft_version(
    document_id: str,
    version_id: str,
    payload: KnowledgeDraftUpdate,
    user: KnowledgeManager,
    service: GovernanceServiceDep,
) -> KnowledgeDocumentDetail:
    detail = await service.get_document_detail(document_id)
    if detail.current_version is None or detail.current_version.version_id != version_id:
        raise ValidationException("Only the current editable draft version can be updated")
    return await service.update_draft(user, document_id, payload)


@router.post(
    "/knowledge/{document_id}/versions/{version_id}/submit",
    response_model=KnowledgeDocumentDetail,
    summary="Submit a draft for medical-expert review",
    description=_GOVERNANCE_NOTICE,
    responses={409: {"description": "Version conflict"}},
)
async def submit_for_review(
    document_id: str,
    version_id: str,
    payload: KnowledgeSubmitRequest,
    user: KnowledgeManager,
    service: GovernanceServiceDep,
) -> KnowledgeDocumentDetail:
    detail = await service.get_document_detail(document_id)
    if detail.current_version is None or detail.current_version.version_id != version_id:
        raise ValidationException("Only the current draft version can be submitted")
    return await service.submit_for_review(user, document_id, payload)


@router.post(
    "/knowledge/{document_id}/versions/new",
    response_model=KnowledgeDocumentDetail,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new draft version from approved content",
    description=_GOVERNANCE_NOTICE,
    responses={409: {"description": "Version conflict"}},
)
async def create_new_version(
    document_id: str,
    payload: KnowledgeNewVersionRequest,
    user: KnowledgeManager,
    service: GovernanceServiceDep,
) -> KnowledgeDocumentDetail:
    return await service.create_new_version(user, document_id, payload)


@router.get(
    "/knowledge/{document_id}/review-history",
    response_model=list[KnowledgeReviewRecordPublic],
    summary="List append-only review history for a document",
    description=_GOVERNANCE_NOTICE,
)
async def list_document_review_history(
    document_id: str,
    user: KnowledgeViewer,
    service: GovernanceServiceDep,
) -> list[KnowledgeReviewRecordPublic]:
    _ = user
    detail = await service.get_document_detail(document_id)
    records: list[KnowledgeReviewRecordPublic] = []
    for version in detail.versions:
        records.extend(await service.list_review_records(document_id, version.version_id))
    records.sort(key=lambda r: r.created_at)
    return records


@router.post(
    "/knowledge/{document_id}/retire",
    response_model=KnowledgeDocumentDetail,
    summary="Retire approved content (admin or medical expert)",
    description=_GOVERNANCE_NOTICE,
    responses={409: {"description": "Version conflict"}},
)
async def retire_document(
    document_id: str,
    payload: KnowledgeRetireRequest,
    user: KnowledgeRetirer,
    service: GovernanceServiceDep,
) -> KnowledgeDocumentDetail:
    return await service.retire(user, document_id, payload)


@router.post(
    "/knowledge/{document_id}/restore",
    response_model=KnowledgeApprovalResult,
    summary="Restore retired content (medical expert only)",
    description=_GOVERNANCE_NOTICE,
    responses={409: {"description": "Version or content-hash conflict"}},
)
async def restore_document(
    document_id: str,
    payload: KnowledgeRestoreRequest,
    user: KnowledgeReviewer,
    service: GovernanceServiceDep,
) -> KnowledgeApprovalResult:
    return await service.restore(user, document_id, payload)


@router.post(
    "/knowledge/{document_id}/versions/{version_id}/reingest",
    response_model=KnowledgeApprovalResult,
    summary="Retry approved-content ingestion without re-approval",
    description=_GOVERNANCE_NOTICE,
    responses={409: {"description": "Content-hash conflict"}},
)
async def retry_ingestion(
    document_id: str,
    version_id: str,
    payload: KnowledgeRetryIngestRequest,
    user: KnowledgeViewer,
    service: GovernanceServiceDep,
) -> KnowledgeApprovalResult:
    return await service.retry_ingestion(
        user,
        document_id,
        version_id,
        expected_content_hash=payload.expected_content_hash,
    )
