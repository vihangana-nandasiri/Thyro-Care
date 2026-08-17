"""Patient symptom API routes."""

from __future__ import annotations

from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, Query, status

from app.api.dependencies import DatabaseDep, require_patient
from app.content.symptom_safety_rules import MEDICAL_SAFETY_DISCLAIMER
from app.models.enums import SymptomSeverity, SymptomStatus, SymptomType
from app.models.user import UserDocument
from app.schemas.symptom import (
    MessageResponse,
    SymptomCreate,
    SymptomCreateResponse,
    SymptomListResponse,
    SymptomPublic,
    SymptomSafetyCheckRequest,
    SymptomSafetyCheckResponse,
    SymptomStatusUpdate,
    SymptomUpdate,
)
from app.services.symptom_service import SymptomService
from app.utils.timezone import ensure_utc

router = APIRouter(prefix="/symptoms", tags=["symptoms"])

CurrentPatient = Annotated[UserDocument, Depends(require_patient)]


def get_symptom_service(database: DatabaseDep) -> SymptomService:
    return SymptomService(database)


SymptomServiceDep = Annotated[SymptomService, Depends(get_symptom_service)]

_DISCLAIMER = (
    MEDICAL_SAFETY_DISCLAIMER
    + " Safety classification uses structured yes/no answers and versioned "
    "deterministic rules only. Free-text notes are never used for safety decisions. "
    "No diagnosis or treatment advice is provided."
)


@router.get(
    "",
    response_model=SymptomListResponse,
    summary="List my symptoms",
    description=_DISCLAIMER,
)
async def list_symptoms(
    user: CurrentPatient,
    service: SymptomServiceDep,
    status_filter: SymptomStatus | None = Query(default=None, alias="status"),
    severity: SymptomSeverity | None = None,
    symptom_type: SymptomType | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
) -> SymptomListResponse:
    return await service.list(
        user,
        status=status_filter,
        severity=severity,
        symptom_type=symptom_type,
        date_from=ensure_utc(date_from) if date_from else None,
        date_to=ensure_utc(date_to) if date_to else None,
        page=page,
        page_size=page_size,
    )


@router.post(
    "",
    response_model=SymptomCreateResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create symptom entry",
    description=_DISCLAIMER + " Requires structured safety_answers.",
)
async def create_symptom(
    payload: SymptomCreate,
    user: CurrentPatient,
    service: SymptomServiceDep,
) -> SymptomCreateResponse:
    return await service.create(user, payload)


@router.post(
    "/safety-check",
    response_model=SymptomSafetyCheckResponse,
    summary="Run structured safety check",
    description=(
        _DISCLAIMER + " Does not persist a symptom. Does not interpret free text. "
        "Emergency results set emergency_page_required."
    ),
)
async def safety_check(
    payload: SymptomSafetyCheckRequest,
    user: CurrentPatient,
    service: SymptomServiceDep,
) -> SymptomSafetyCheckResponse:
    return await service.safety_check(user, payload)


@router.get(
    "/active",
    response_model=list[SymptomPublic],
    summary="List active symptoms",
    description=_DISCLAIMER + " Excludes resolved and soft-deleted records.",
)
async def active_symptoms(
    user: CurrentPatient,
    service: SymptomServiceDep,
) -> list[SymptomPublic]:
    return await service.list_active(user)


@router.get(
    "/{symptom_id}",
    response_model=SymptomPublic,
    summary="Get symptom",
    description=_DISCLAIMER,
)
async def get_symptom(
    symptom_id: str,
    user: CurrentPatient,
    service: SymptomServiceDep,
) -> SymptomPublic:
    return await service.get(user, symptom_id)


@router.patch(
    "/{symptom_id}",
    response_model=SymptomPublic | SymptomCreateResponse,
    summary="Update symptom",
    description=_DISCLAIMER + " Requires expected_version. Soft concurrency conflict returns 409.",
)
async def update_symptom(
    symptom_id: str,
    payload: SymptomUpdate,
    user: CurrentPatient,
    service: SymptomServiceDep,
) -> SymptomPublic | SymptomCreateResponse:
    return await service.update(user, symptom_id, payload)


@router.patch(
    "/{symptom_id}/status",
    response_model=SymptomPublic,
    summary="Update symptom status",
    description=_DISCLAIMER + " Status values are patient tracking labels only.",
)
async def update_symptom_status(
    symptom_id: str,
    payload: SymptomStatusUpdate,
    user: CurrentPatient,
    service: SymptomServiceDep,
) -> SymptomPublic:
    return await service.update_status(user, symptom_id, payload)


@router.delete(
    "/{symptom_id}",
    response_model=MessageResponse,
    summary="Soft-delete symptom",
    description=_DISCLAIMER,
)
async def delete_symptom(
    symptom_id: str,
    user: CurrentPatient,
    service: SymptomServiceDep,
) -> MessageResponse:
    return await service.delete(user, symptom_id)
