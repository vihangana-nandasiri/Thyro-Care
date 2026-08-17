"""Patient medication API routes."""

from __future__ import annotations

from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, Query, status

from app.api.dependencies import DatabaseDep, require_patient
from app.models.enums import MedicationStatus
from app.models.user import UserDocument
from app.schemas.medication import (
    MedicationAdherence,
    MedicationCreate,
    MedicationListResponse,
    MedicationLogCreate,
    MedicationLogPublic,
    MedicationPublic,
    MedicationScheduleItem,
    MedicationUpdate,
    MessageResponse,
)
from app.services.medication_service import MedicationService
from app.utils.datetime import utc_now

router = APIRouter(prefix="/medications", tags=["medications"])

CurrentPatient = Annotated[UserDocument, Depends(require_patient)]


def get_medication_service(database: DatabaseDep) -> MedicationService:
    return MedicationService(database)


MedicationServiceDep = Annotated[MedicationService, Depends(get_medication_service)]

_DISCLAIMER = (
    "Medication information is for tracking purposes only. "
    "Follow your healthcare provider’s instructions. "
    "Do not change or stop medication without professional advice."
)


@router.get(
    "",
    response_model=MedicationListResponse,
    summary="List my medications",
    description=_DISCLAIMER,
)
async def list_medications(
    user: CurrentPatient,
    service: MedicationServiceDep,
    status_filter: MedicationStatus | None = Query(default=None, alias="status"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
) -> MedicationListResponse:
    return await service.list(user, status=status_filter, page=page, page_size=page_size)


@router.post(
    "",
    response_model=MedicationPublic,
    status_code=status.HTTP_201_CREATED,
    summary="Create medication",
    description=_DISCLAIMER,
)
async def create_medication(
    payload: MedicationCreate,
    user: CurrentPatient,
    service: MedicationServiceDep,
) -> MedicationPublic:
    return await service.create(user, payload)


@router.get(
    "/schedule",
    response_model=list[MedicationScheduleItem],
    summary="Medication schedule",
    description=_DISCLAIMER + " Occurrences are computed; not auto-persisted.",
)
async def medication_schedule(
    user: CurrentPatient,
    service: MedicationServiceDep,
    date_from: date | None = None,
    date_to: date | None = None,
) -> list[MedicationScheduleItem]:
    today = utc_now().date()
    start = date_from or today
    end = date_to or today
    return await service.schedule(user, start, end)


@router.get(
    "/adherence",
    response_model=MedicationAdherence,
    summary="Medication adherence metrics",
    description=_DISCLAIMER + " Metrics are informational only — not clinical advice.",
)
async def medication_adherence(
    user: CurrentPatient,
    service: MedicationServiceDep,
    date_from: date | None = None,
    date_to: date | None = None,
) -> MedicationAdherence:
    today = utc_now().date()
    end = date_to or today
    start = date_from or (end.replace(day=1) if end.day >= 1 else end)
    # Default: last 30 days inclusive
    if date_from is None:
        from datetime import timedelta

        start = end - timedelta(days=29)
    return await service.adherence(user, start, end)


@router.get(
    "/{medication_id}",
    response_model=MedicationPublic,
    summary="Get my medication",
    description=_DISCLAIMER,
)
async def get_medication(
    medication_id: str,
    user: CurrentPatient,
    service: MedicationServiceDep,
) -> MedicationPublic:
    return await service.get(user, medication_id)


@router.patch(
    "/{medication_id}",
    response_model=MedicationPublic,
    summary="Update my medication",
    description=_DISCLAIMER,
    responses={409: {"description": "Version conflict"}},
)
async def update_medication(
    medication_id: str,
    payload: MedicationUpdate,
    user: CurrentPatient,
    service: MedicationServiceDep,
) -> MedicationPublic:
    return await service.update(user, medication_id, payload)


@router.delete(
    "/{medication_id}",
    response_model=MessageResponse,
    summary="Soft-delete my medication",
    description=_DISCLAIMER,
)
async def delete_medication(
    medication_id: str,
    user: CurrentPatient,
    service: MedicationServiceDep,
) -> MessageResponse:
    return await service.delete(user, medication_id)


@router.post(
    "/{medication_id}/logs",
    response_model=MedicationLogPublic,
    status_code=status.HTTP_201_CREATED,
    summary="Record a dose status",
    description=_DISCLAIMER,
    responses={409: {"description": "Duplicate occurrence"}},
)
async def create_medication_log(
    medication_id: str,
    payload: MedicationLogCreate,
    user: CurrentPatient,
    service: MedicationServiceDep,
) -> MedicationLogPublic:
    return await service.log_dose(user, medication_id, payload)


@router.get(
    "/{medication_id}/logs",
    response_model=list[MedicationLogPublic],
    summary="List dose logs for a medication",
    description=_DISCLAIMER,
)
async def list_medication_logs(
    medication_id: str,
    user: CurrentPatient,
    service: MedicationServiceDep,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=100),
) -> list[MedicationLogPublic]:
    return await service.list_logs(user, medication_id, page=page, page_size=page_size)
