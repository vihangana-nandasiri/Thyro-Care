"""Patient appointment management service."""

from __future__ import annotations

from datetime import date, datetime, time
from zoneinfo import ZoneInfo

from pymongo.asynchronous.database import AsyncDatabase

from app.core.exceptions import NotFoundException, ValidationException
from app.models.appointment import AppointmentDocument
from app.models.enums import AppointmentStatus, AppointmentType
from app.models.object_id import object_id_to_string
from app.models.user import UserDocument
from app.repositories.appointment_repository import AppointmentRepository
from app.repositories.exceptions import RepositoryNotFoundError
from app.schemas.appointment import (
    AppointmentCalendarItem,
    AppointmentCreate,
    AppointmentListResponse,
    AppointmentPublic,
    AppointmentStatusUpdate,
    AppointmentUpdate,
    MessageResponse,
)
from app.services.appointment_lifecycle_service import (
    apply_lifecycle_timestamps,
    assert_transition_allowed,
)
from app.services.audit_service import AuditActions, AuditService
from app.utils.timezone import (
    ensure_utc,
    normalize_date_range,
    utc_datetime_to_local,
    utc_now_aware,
)

MAX_CALENDAR_DAYS = 62


def _to_public(doc: AppointmentDocument) -> AppointmentPublic:
    return AppointmentPublic(
        id=object_id_to_string(doc.id),
        appointment_type=doc.appointment_type,
        title=doc.title,
        scheduled_start=ensure_utc(doc.scheduled_start),
        scheduled_end=ensure_utc(doc.scheduled_end) if doc.scheduled_end else None,
        timezone=doc.timezone,
        location=doc.location,
        location_type=doc.location_type,
        provider_name=doc.provider_name,
        notes=doc.notes,
        status=doc.status,
        completed_at=ensure_utc(doc.completed_at) if doc.completed_at else None,
        cancelled_at=ensure_utc(doc.cancelled_at) if doc.cancelled_at else None,
        reminder_offsets_minutes=list(doc.reminder_offsets_minutes),
        created_at=doc.created_at,
        updated_at=doc.updated_at,
        version=doc.version,
    )


def _calendar_item(doc: AppointmentDocument) -> AppointmentCalendarItem:
    local_start = utc_datetime_to_local(ensure_utc(doc.scheduled_start), doc.timezone)
    local_end = (
        utc_datetime_to_local(ensure_utc(doc.scheduled_end), doc.timezone)
        if doc.scheduled_end
        else None
    )
    return AppointmentCalendarItem(
        appointment_id=object_id_to_string(doc.id),
        appointment_type=doc.appointment_type,
        title=doc.title,
        scheduled_start=ensure_utc(doc.scheduled_start),
        scheduled_end=ensure_utc(doc.scheduled_end) if doc.scheduled_end else None,
        local_date=local_start.date(),
        local_start_time=local_start.strftime("%H:%M"),
        local_end_time=local_end.strftime("%H:%M") if local_end else None,
        timezone=doc.timezone,
        status=doc.status,
        location=doc.location,
        provider_name=doc.provider_name,
    )


class AppointmentService:
    def __init__(self, database: AsyncDatabase) -> None:
        self.appointments = AppointmentRepository(database)
        self.audit = AuditService(database)

    async def create(self, user: UserDocument, payload: AppointmentCreate) -> AppointmentPublic:
        status = payload.status
        completed_at = None
        cancelled_at = None
        if status == AppointmentStatus.COMPLETED:
            completed_at, cancelled_at = apply_lifecycle_timestamps(
                previous_status=AppointmentStatus.UPCOMING,
                new_status=status,
                completed_at=None,
                cancelled_at=None,
            )
        elif status == AppointmentStatus.CANCELLED:
            completed_at, cancelled_at = apply_lifecycle_timestamps(
                previous_status=AppointmentStatus.UPCOMING,
                new_status=status,
                completed_at=None,
                cancelled_at=None,
            )
        elif status == AppointmentStatus.MISSED:
            assert_transition_allowed(AppointmentStatus.UPCOMING, status)

        doc = AppointmentDocument(
            user_id=user.id,
            appointment_type=payload.appointment_type,
            title=payload.title,
            scheduled_start=payload.scheduled_start,
            scheduled_end=payload.scheduled_end,
            timezone=payload.timezone,
            location=payload.location,
            location_type=payload.location_type,
            provider_name=payload.provider_name,
            notes=payload.notes,
            status=status,
            completed_at=completed_at,
            cancelled_at=cancelled_at,
            reminder_offsets_minutes=payload.reminder_offsets_minutes,
        )
        created = await self.appointments.create_for_user(doc)
        await self.audit.record(
            AuditActions.APPOINTMENT_CREATED,
            actor_user_id=user.id,
            entity_type="appointment",
            entity_id=created.id,
            changes_summary="appointment_type,title,timezone,scheduled_start,status",
        )
        return _to_public(created)

    async def list(
        self,
        user: UserDocument,
        *,
        status: AppointmentStatus | None = None,
        appointment_type: AppointmentType | None = None,
        date_from: datetime | None = None,
        date_to: datetime | None = None,
        page: int = 1,
        page_size: int = 20,
    ) -> AppointmentListResponse:
        page = max(1, page)
        page_size = min(max(1, page_size), 100)
        items = await self.appointments.list_for_user(
            user.id,
            status=status,
            appointment_type=appointment_type,
            date_from=date_from,
            date_to=date_to,
            page=page,
            page_size=page_size,
        )
        total = await self.appointments.count_for_user(
            user.id,
            status=status,
            appointment_type=appointment_type,
            date_from=date_from,
            date_to=date_to,
        )
        return AppointmentListResponse(
            items=[_to_public(i) for i in items],
            total=total,
            page=page,
            page_size=page_size,
        )

    async def get(self, user: UserDocument, appointment_id: str) -> AppointmentPublic:
        doc = await self.appointments.get_owned_by_id(appointment_id, user.id)
        if doc is None:
            raise NotFoundException("Appointment not found")
        return _to_public(doc)

    async def update(
        self,
        user: UserDocument,
        appointment_id: str,
        payload: AppointmentUpdate,
    ) -> AppointmentPublic:
        updates = payload.editable_payload()
        if not updates:
            raise ValidationException("No appointment fields to update")

        current = await self.appointments.get_owned_by_id(appointment_id, user.id)
        if current is None:
            raise NotFoundException("Appointment not found")

        start = updates.get("scheduled_start", current.scheduled_start)
        end = updates.get("scheduled_end", current.scheduled_end)
        if "scheduled_end" in updates or "scheduled_start" in updates:
            if end is not None and ensure_utc(end) <= ensure_utc(start):
                raise ValidationException("scheduled_end must be after scheduled_start")

        if "status" in updates:
            new_status = updates["status"]
            if not isinstance(new_status, AppointmentStatus):
                new_status = AppointmentStatus(new_status)
            completed_at, cancelled_at = apply_lifecycle_timestamps(
                previous_status=current.status,
                new_status=new_status,
                completed_at=current.completed_at,
                cancelled_at=current.cancelled_at,
            )
            updates["completed_at"] = completed_at
            updates["cancelled_at"] = cancelled_at

        changed = sorted(k for k in updates if k not in {"completed_at", "cancelled_at"})
        if "status" in updates:
            changed = sorted(set(changed) | {"status"})

        try:
            updated = await self.appointments.update_owned(
                appointment_id,
                user.id,
                updates,
                expected_version=payload.expected_version,
            )
        except RepositoryNotFoundError as exc:
            raise NotFoundException("Appointment not found") from exc

        await self.audit.record(
            AuditActions.APPOINTMENT_UPDATED,
            actor_user_id=user.id,
            entity_type="appointment",
            entity_id=updated.id,
            changes_summary=",".join(changed),
        )
        return _to_public(updated)

    async def update_status(
        self,
        user: UserDocument,
        appointment_id: str,
        payload: AppointmentStatusUpdate,
    ) -> AppointmentPublic:
        current = await self.appointments.get_owned_by_id(appointment_id, user.id)
        if current is None:
            raise NotFoundException("Appointment not found")

        completed_at, cancelled_at = apply_lifecycle_timestamps(
            previous_status=current.status,
            new_status=payload.status,
            completed_at=current.completed_at,
            cancelled_at=current.cancelled_at,
        )
        try:
            updated = await self.appointments.update_status_owned(
                appointment_id,
                user.id,
                status=payload.status,
                completed_at=completed_at,
                cancelled_at=cancelled_at,
                expected_version=payload.expected_version,
            )
        except RepositoryNotFoundError as exc:
            raise NotFoundException("Appointment not found") from exc

        await self.audit.record(
            AuditActions.APPOINTMENT_STATUS_CHANGED,
            actor_user_id=user.id,
            entity_type="appointment",
            entity_id=updated.id,
            changes_summary=f"status:{current.status.value}->{payload.status.value}",
        )
        return _to_public(updated)

    async def delete(self, user: UserDocument, appointment_id: str) -> MessageResponse:
        try:
            deleted = await self.appointments.soft_delete_owned(appointment_id, user.id)
        except RepositoryNotFoundError as exc:
            raise NotFoundException("Appointment not found") from exc
        await self.audit.record(
            AuditActions.APPOINTMENT_DELETED,
            actor_user_id=user.id,
            entity_type="appointment",
            entity_id=deleted.id,
            changes_summary="soft_deleted",
        )
        return MessageResponse(message="Appointment deleted")

    async def calendar(
        self,
        user: UserDocument,
        date_from: date,
        date_to: date,
    ) -> list[AppointmentCalendarItem]:
        try:
            start_d, end_d = normalize_date_range(date_from, date_to, max_days=MAX_CALENDAR_DAYS)
        except ValueError as exc:
            raise ValidationException(str(exc)) from exc

        # Inclusive UTC window covering local midnights is complex; use UTC day bounds.
        range_start = datetime.combine(start_d, time.min, tzinfo=ZoneInfo("UTC"))
        range_end = datetime.combine(end_d, time.max, tzinfo=ZoneInfo("UTC"))
        docs = await self.appointments.list_for_user_range(
            user.id,
            range_start=range_start,
            range_end=range_end,
        )
        return [_calendar_item(d) for d in docs]

    async def upcoming(
        self,
        user: UserDocument,
        *,
        limit: int = 5,
    ) -> list[AppointmentPublic]:
        limit = min(max(1, limit), 20)
        docs = await self.appointments.list_upcoming_for_user(
            user.id,
            limit=limit,
            now=utc_now_aware(),
        )
        return [_to_public(d) for d in docs]
