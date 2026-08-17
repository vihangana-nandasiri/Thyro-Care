"""Patient medication management service."""

from __future__ import annotations

from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from pymongo.asynchronous.database import AsyncDatabase

from app.core.exceptions import NotFoundException, ValidationException
from app.models.enums import MedicationStatus
from app.models.medication import MedicationDocument, MedicationLogDocument
from app.models.object_id import object_id_to_string, to_object_id
from app.models.user import UserDocument
from app.repositories.exceptions import RepositoryNotFoundError
from app.repositories.medication_log_repository import MedicationLogRepository
from app.repositories.medication_repository import MedicationRepository
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
from app.services.adherence_service import calculate_adherence
from app.services.audit_service import AuditActions, AuditService
from app.services.medication_schedule_service import MAX_SCHEDULE_DAYS, build_schedule
from app.utils.datetime import utc_now
from app.utils.timezone import ensure_utc


def _times_to_hhmm(values: list[time]) -> list[str]:
    return [t.strftime("%H:%M") for t in values]


def _to_public(med: MedicationDocument) -> MedicationPublic:
    return MedicationPublic(
        id=object_id_to_string(med.id),
        name=med.name,
        dosage_text=med.dosage_text,
        frequency=med.frequency,
        reminder_times=_times_to_hhmm(med.reminder_times),
        instructions=med.instructions,
        start_date=med.start_date,
        end_date=med.end_date,
        status=med.status,
        prescribed_by_text=med.prescribed_by_text,
        notes=med.notes,
        timezone=med.timezone,
        created_at=med.created_at,
        updated_at=med.updated_at,
        version=med.version,
    )


def _log_public(log: MedicationLogDocument) -> MedicationLogPublic:
    return MedicationLogPublic(
        id=object_id_to_string(log.id),
        medication_id=object_id_to_string(log.medication_id),
        scheduled_for=ensure_utc(log.scheduled_for),
        recorded_at=ensure_utc(log.recorded_at),
        status=log.status,
        note=log.note,
        created_at=log.created_at,
    )


class MedicationService:
    def __init__(self, database: AsyncDatabase) -> None:
        self.medications = MedicationRepository(database)
        self.logs = MedicationLogRepository(database)
        self.audit = AuditService(database)

    async def create(self, user: UserDocument, payload: MedicationCreate) -> MedicationPublic:
        doc = MedicationDocument(
            user_id=user.id,
            name=payload.name,
            dosage_text=payload.dosage_text,
            frequency=payload.frequency,
            reminder_times=payload.reminder_times,
            instructions=payload.instructions,
            start_date=payload.start_date,
            end_date=payload.end_date,
            status=payload.status,
            prescribed_by_text=payload.prescribed_by_text,
            notes=payload.notes,
            timezone=payload.timezone,
        )
        created = await self.medications.create_for_user(doc)
        await self.audit.record(
            AuditActions.MEDICATION_CREATED,
            actor_user_id=user.id,
            entity_type="medication",
            entity_id=created.id,
            changes_summary="name,dosage_text,frequency,timezone,start_date",
        )
        return _to_public(created)

    async def list(
        self,
        user: UserDocument,
        *,
        status: MedicationStatus | None = None,
        page: int = 1,
        page_size: int = 20,
    ) -> MedicationListResponse:
        page = max(1, page)
        page_size = min(max(1, page_size), 100)
        items = await self.medications.list_for_user(
            user.id, status=status, page=page, page_size=page_size
        )
        total = await self.medications.count_for_user(user.id, status=status)
        return MedicationListResponse(
            items=[_to_public(m) for m in items],
            total=total,
            page=page,
            page_size=page_size,
        )

    async def get(self, user: UserDocument, medication_id: str) -> MedicationPublic:
        med = await self.medications.get_owned_by_id(medication_id, user.id)
        if med is None:
            raise NotFoundException("Medication not found")
        return _to_public(med)

    async def update(
        self,
        user: UserDocument,
        medication_id: str,
        payload: MedicationUpdate,
    ) -> MedicationPublic:
        updates = payload.editable_payload()
        if not updates:
            raise ValidationException("No medication fields to update")
        changed = sorted(updates.keys())
        updated = await self.medications.update_owned(
            medication_id,
            user.id,
            updates,
            expected_version=payload.expected_version,
        )
        await self.audit.record(
            AuditActions.MEDICATION_UPDATED,
            actor_user_id=user.id,
            entity_type="medication",
            entity_id=updated.id,
            changes_summary=",".join(changed),
        )
        return _to_public(updated)

    async def delete(self, user: UserDocument, medication_id: str) -> MessageResponse:
        try:
            deleted = await self.medications.soft_delete_owned(medication_id, user.id)
        except RepositoryNotFoundError as exc:
            raise NotFoundException("Medication not found") from exc
        await self.audit.record(
            AuditActions.MEDICATION_DELETED,
            actor_user_id=user.id,
            entity_type="medication",
            entity_id=deleted.id,
            changes_summary="soft_deleted",
        )
        return MessageResponse(message="Medication deleted")

    async def log_dose(
        self,
        user: UserDocument,
        medication_id: str,
        payload: MedicationLogCreate,
    ) -> MedicationLogPublic:
        med = await self.medications.get_owned_by_id(medication_id, user.id)
        if med is None:
            raise NotFoundException("Medication not found")

        scheduled = ensure_utc(payload.scheduled_for)
        log = MedicationLogDocument(
            user_id=user.id,
            medication_id=to_object_id(medication_id),
            scheduled_for=scheduled,
            recorded_at=utc_now(),
            status=payload.status,
            note=payload.note,
        )
        created = await self.logs.create_log(log)
        await self.audit.record(
            AuditActions.MEDICATION_LOG_RECORDED,
            actor_user_id=user.id,
            entity_type="medication_log",
            entity_id=created.id,
            changes_summary=f"status={payload.status.value}",
        )
        return _log_public(created)

    async def list_logs(
        self,
        user: UserDocument,
        medication_id: str,
        *,
        page: int = 1,
        page_size: int = 50,
    ) -> list[MedicationLogPublic]:
        med = await self.medications.get_owned_by_id(medication_id, user.id)
        if med is None:
            raise NotFoundException("Medication not found")
        logs = await self.logs.list_for_medication(
            user.id, medication_id, page=page, page_size=min(page_size, 100)
        )
        return [_log_public(log) for log in logs]

    async def schedule(
        self,
        user: UserDocument,
        date_from: date,
        date_to: date,
    ) -> list[MedicationScheduleItem]:
        if (date_to - date_from).days + 1 > MAX_SCHEDULE_DAYS:
            raise ValidationException(f"Date range cannot exceed {MAX_SCHEDULE_DAYS} days")
        meds = await self.medications.list_active_for_user(user.id)
        start_dt = datetime.combine(date_from, time.min, tzinfo=ZoneInfo("UTC"))
        end_dt = datetime.combine(date_to, time.max, tzinfo=ZoneInfo("UTC"))
        logs = await self.logs.list_for_user_range(user.id, date_from=start_dt, date_to=end_dt)
        occurrences = build_schedule(meds, logs, date_from, date_to)
        return [
            MedicationScheduleItem(
                medication_id=o.medication_id,
                medication_name=o.medication_name,
                dosage_text=o.dosage_text,
                scheduled_for=o.scheduled_for,
                scheduled_local_time=o.scheduled_local_time,
                timezone=o.timezone,
                log_status=o.log_status,
                log_id=o.log_id,
            )
            for o in occurrences
        ]

    async def adherence(
        self,
        user: UserDocument,
        date_from: date,
        date_to: date,
    ) -> MedicationAdherence:
        if (date_to - date_from).days + 1 > MAX_SCHEDULE_DAYS:
            raise ValidationException(f"Date range cannot exceed {MAX_SCHEDULE_DAYS} days")
        meds = await self.medications.list_for_user(user.id, page=1, page_size=100)
        start_dt = datetime.combine(date_from, time.min, tzinfo=ZoneInfo("UTC"))
        end_dt = datetime.combine(date_to + timedelta(days=1), time.min, tzinfo=ZoneInfo("UTC"))
        logs = await self.logs.list_for_user_range(user.id, date_from=start_dt, date_to=end_dt)
        result = calculate_adherence(meds, logs, date_from, date_to)
        return MedicationAdherence(
            adherence_percentage=result.adherence_percentage,
            total_eligible=result.total_eligible,
            taken_count=result.taken_count,
            missed_count=result.missed_count,
            skipped_count=result.skipped_count,
            unlogged_count=result.unlogged_count,
            date_from=result.date_from,
            date_to=result.date_to,
        )
