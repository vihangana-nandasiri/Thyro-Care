"""Patient appointment API routes."""

from __future__ import annotations

from datetime import date, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, Query, status

from app.api.dependencies import DatabaseDep, require_patient
from app.models.enums import AppointmentStatus, AppointmentType
from app.models.user import UserDocument
from app.schemas.appointment import (
    AppointmentCalendarItem,
    AppointmentCreate,
    AppointmentListResponse,
    AppointmentPublic,
    AppointmentStatusUpdate,
    AppointmentUpdate,
    MessageResponse,
)
from app.services.appointment_service import AppointmentService
from app.utils.datetime import utc_now
from app.utils.timezone import ensure_utc

router = APIRouter(prefix="/appointments", tags=["appointments"])

CurrentPatient = Annotated[UserDocument, Depends(require_patient)]


def get_appointment_service(database: DatabaseDep) -> AppointmentService:
    return AppointmentService(database)


AppointmentServiceDep = Annotated[AppointmentService, Depends(get_appointment_service)]

_DISCLAIMER = (
    "Appointment information is for personal organization only. "
    "Follow the schedule and instructions provided by your healthcare team. "
    "Reminders are not sent automatically in this phase."
)


@router.get(
    "",
    response_model=AppointmentListResponse,
    summary="List my appointments",
    description=_DISCLAIMER,
)
async def list_appointments(
    user: CurrentPatient,
    service: AppointmentServiceDep,
    status_filter: AppointmentStatus | None = Query(default=None, alias="status"),
    appointment_type: AppointmentType | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
) -> AppointmentListResponse:
    return await service.list(
        user,
        status=status_filter,
        appointment_type=appointment_type,
        date_from=ensure_utc(date_from) if date_from else None,
        date_to=ensure_utc(date_to) if date_to else None,
        page=page,
        page_size=page_size,
    )


@router.post(
    "",
    response_model=AppointmentPublic,
    status_code=status.HTTP_201_CREATED,
    summary="Create appointment",
    description=_DISCLAIMER,
)
async def create_appointment(
    payload: AppointmentCreate,
    user: CurrentPatient,
    service: AppointmentServiceDep,
) -> AppointmentPublic:
    return await service.create(user, payload)


@router.get(
    "/calendar",
    response_model=list[AppointmentCalendarItem],
    summary="Appointment calendar range",
    description=_DISCLAIMER + " Status is not mutated by viewing the calendar.",
)
async def appointment_calendar(
    user: CurrentPatient,
    service: AppointmentServiceDep,
    date_from: date | None = None,
    date_to: date | None = None,
) -> list[AppointmentCalendarItem]:
    today = utc_now().date()
    start = date_from or today
    end = date_to or today
    return await service.calendar(user, start, end)


@router.get(
    "/upcoming",
    response_model=list[AppointmentPublic],
    summary="Upcoming appointments",
    description=_DISCLAIMER + " Informational list only — not a medical schedule of record.",
)
async def upcoming_appointments(
    user: CurrentPatient,
    service: AppointmentServiceDep,
    limit: int = Query(default=5, ge=1, le=20),
) -> list[AppointmentPublic]:
    return await service.upcoming(user, limit=limit)


@router.get(
    "/{appointment_id}",
    response_model=AppointmentPublic,
    summary="Get appointment",
    description=_DISCLAIMER,
)
async def get_appointment(
    appointment_id: str,
    user: CurrentPatient,
    service: AppointmentServiceDep,
) -> AppointmentPublic:
    return await service.get(user, appointment_id)


@router.patch(
    "/{appointment_id}",
    response_model=AppointmentPublic,
    summary="Update appointment",
    description=_DISCLAIMER + " Requires expected_version for optimistic concurrency.",
)
async def update_appointment(
    appointment_id: str,
    payload: AppointmentUpdate,
    user: CurrentPatient,
    service: AppointmentServiceDep,
) -> AppointmentPublic:
    return await service.update(user, appointment_id, payload)


@router.patch(
    "/{appointment_id}/status",
    response_model=AppointmentPublic,
    summary="Update appointment status",
    description=_DISCLAIMER + " Status values are patient tracking labels only.",
)
async def update_appointment_status(
    appointment_id: str,
    payload: AppointmentStatusUpdate,
    user: CurrentPatient,
    service: AppointmentServiceDep,
) -> AppointmentPublic:
    return await service.update_status(user, appointment_id, payload)


@router.delete(
    "/{appointment_id}",
    response_model=MessageResponse,
    summary="Soft-delete appointment",
    description=_DISCLAIMER,
)
async def delete_appointment(
    appointment_id: str,
    user: CurrentPatient,
    service: AppointmentServiceDep,
) -> MessageResponse:
    return await service.delete(user, appointment_id)
