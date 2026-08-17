"""Patient symptom management service."""

from __future__ import annotations

from datetime import datetime

from pymongo.asynchronous.database import AsyncDatabase

from app.core.exceptions import ConflictException, NotFoundException, ValidationException
from app.models.enums import SymptomSeverity, SymptomStatus, SymptomType
from app.models.object_id import object_id_to_string
from app.models.symptom import SymptomDocument
from app.models.user import UserDocument
from app.repositories.exceptions import RepositoryConflictError, RepositoryNotFoundError
from app.repositories.symptom_repository import SymptomRepository
from app.schemas.symptom import (
    MessageResponse,
    SymptomCreate,
    SymptomCreateResponse,
    SymptomListResponse,
    SymptomPublic,
    SymptomSafetyAnswers,
    SymptomSafetyCheckResponse,
    SymptomStatusUpdate,
    SymptomUpdate,
)
from app.services.audit_service import AuditActions, AuditService
from app.services.symptom_safety_service import SafetyAssessmentResult, SymptomSafetyService
from app.utils.timezone import ensure_utc, utc_now_aware

_NOT_FOUND = "This symptom record is no longer available."


def _to_public(doc: SymptomDocument) -> SymptomPublic:
    return SymptomPublic(
        id=object_id_to_string(doc.id),
        symptom_type=doc.symptom_type,
        custom_symptom_name=doc.custom_symptom_name,
        severity=doc.severity,
        frequency=doc.frequency,
        started_at=ensure_utc(doc.started_at),
        ended_at=ensure_utc(doc.ended_at) if doc.ended_at else None,
        timezone=doc.timezone,
        status=doc.status,
        description=doc.description,
        notes=doc.notes,
        safety_level=doc.safety_level,
        safety_rule_version=doc.safety_rule_version,
        safety_checked_at=ensure_utc(doc.safety_checked_at) if doc.safety_checked_at else None,
        created_at=doc.created_at,
        updated_at=doc.updated_at,
        version=doc.version,
    )


def _assessment_response(result: SafetyAssessmentResult) -> SymptomSafetyCheckResponse:
    return SymptomSafetyCheckResponse(
        safety_level=result.safety_level,
        matched_rule_codes=list(result.matched_rule_codes),
        headline=result.headline,
        user_message=result.user_message,
        recommended_action=result.recommended_action,
        emergency_page_required=result.emergency_page_required,
        rule_version=result.rule_version,
        evaluated_at=ensure_utc(result.evaluated_at),
        disclaimer=result.disclaimer,
    )


def _validate_other_name(
    symptom_type: SymptomType,
    custom_symptom_name: str | None,
) -> None:
    if symptom_type == SymptomType.OTHER:
        if not custom_symptom_name:
            raise ValidationException("custom_symptom_name is required when symptom_type is OTHER")
    elif custom_symptom_name is not None:
        raise ValidationException("custom_symptom_name is only allowed when symptom_type is OTHER")


class SymptomService:
    def __init__(self, database: AsyncDatabase) -> None:
        self.symptoms = SymptomRepository(database)
        self.audit = AuditService(database)
        self.safety = SymptomSafetyService()

    async def create(self, user: UserDocument, payload: SymptomCreate) -> SymptomCreateResponse:
        assessment = self.safety.assess(payload.safety_answers.as_dict())
        ended_at = payload.ended_at
        if payload.status == SymptomStatus.RESOLVED and ended_at is None:
            ended_at = utc_now_aware()

        doc = SymptomDocument(
            user_id=user.id,
            symptom_type=payload.symptom_type,
            custom_symptom_name=payload.custom_symptom_name,
            severity=payload.severity,
            frequency=payload.frequency,
            started_at=payload.started_at,
            ended_at=ended_at,
            timezone=payload.timezone,
            status=payload.status,
            description=payload.description,
            notes=payload.notes,
            safety_level=assessment.safety_level,
            safety_rule_version=assessment.rule_version,
            safety_checked_at=assessment.evaluated_at,
            version=1,
        )
        created = await self.symptoms.create_for_user(doc)
        await self.audit.record(
            AuditActions.SYMPTOM_CREATED,
            actor_user_id=user.id,
            entity_type="symptom",
            entity_id=created.id,
            changes_summary=(
                f"fields=symptom_type,severity,frequency,status,safety_level;"
                f"safety_level={assessment.safety_level.value};"
                f"rules={','.join(assessment.matched_rule_codes) or 'none'};"
                f"rule_version={assessment.rule_version}"
            ),
        )
        await self.audit.record(
            AuditActions.SYMPTOM_SAFETY_CHECKED,
            actor_user_id=user.id,
            entity_type="symptom",
            entity_id=created.id,
            changes_summary=(
                f"safety_level={assessment.safety_level.value};"
                f"rules={','.join(assessment.matched_rule_codes) or 'none'};"
                f"rule_version={assessment.rule_version}"
            ),
        )
        return SymptomCreateResponse(
            symptom=_to_public(created),
            safety_assessment=_assessment_response(assessment),
        )

    async def list(
        self,
        user: UserDocument,
        *,
        status: SymptomStatus | None = None,
        severity: SymptomSeverity | None = None,
        symptom_type: SymptomType | None = None,
        date_from: datetime | None = None,
        date_to: datetime | None = None,
        page: int = 1,
        page_size: int = 20,
    ) -> SymptomListResponse:
        items = await self.symptoms.list_for_user(
            user.id,
            status=status,
            severity=severity,
            symptom_type=symptom_type,
            date_from=date_from,
            date_to=date_to,
            page=page,
            page_size=page_size,
        )
        total = await self.symptoms.count_for_user(
            user.id,
            status=status,
            severity=severity,
            symptom_type=symptom_type,
            date_from=date_from,
            date_to=date_to,
        )
        return SymptomListResponse(
            items=[_to_public(i) for i in items],
            page=page,
            page_size=page_size,
            total=total,
        )

    async def get(self, user: UserDocument, symptom_id: str) -> SymptomPublic:
        doc = await self.symptoms.get_owned_by_id(symptom_id, user.id)
        if doc is None:
            raise NotFoundException(_NOT_FOUND)
        return _to_public(doc)

    async def list_active(self, user: UserDocument) -> list[SymptomPublic]:
        docs = await self.symptoms.list_active_for_user(user.id)
        return [_to_public(d) for d in docs]

    async def update(
        self, user: UserDocument, symptom_id: str, payload: SymptomUpdate
    ) -> SymptomCreateResponse | SymptomPublic:
        try:
            existing = await self.symptoms.get_with_expected_version(
                symptom_id, user.id, payload.expected_version
            )
        except RepositoryNotFoundError as exc:
            raise NotFoundException(_NOT_FOUND) from exc
        except RepositoryConflictError as exc:
            raise ConflictException(str(exc)) from exc

        data = payload.model_dump(
            exclude_unset=True, exclude={"expected_version", "safety_answers"}
        )
        symptom_type = data.get("symptom_type", existing.symptom_type)
        custom_name = (
            data["custom_symptom_name"]
            if "custom_symptom_name" in data
            else existing.custom_symptom_name
        )
        if "symptom_type" in data or "custom_symptom_name" in data:
            _validate_other_name(symptom_type, custom_name)

        started = data.get("started_at", existing.started_at)
        ended = existing.ended_at
        if "ended_at" in data:
            ended = data["ended_at"]
        if ended is not None and ensure_utc(ended) < ensure_utc(started):
            raise ValidationException("ended_at cannot precede started_at")

        assessment: SafetyAssessmentResult | None = None
        if payload.safety_answers is not None:
            assessment = self.safety.assess(payload.safety_answers.as_dict())
            data["safety_level"] = assessment.safety_level
            data["safety_rule_version"] = assessment.rule_version
            data["safety_checked_at"] = assessment.evaluated_at

        changed = sorted(
            k for k in data if k not in {"safety_level", "safety_rule_version", "safety_checked_at"}
        )
        try:
            updated = await self.symptoms.update_owned(
                symptom_id,
                user.id,
                data,
                expected_version=payload.expected_version,
            )
        except RepositoryNotFoundError as exc:
            raise NotFoundException(_NOT_FOUND) from exc
        except RepositoryConflictError as exc:
            raise ConflictException(str(exc)) from exc

        summary = f"fields={','.join(changed) or 'none'}"
        if assessment is not None:
            summary += (
                f";safety_level={assessment.safety_level.value};"
                f"rules={','.join(assessment.matched_rule_codes) or 'none'};"
                f"rule_version={assessment.rule_version}"
            )
        await self.audit.record(
            AuditActions.SYMPTOM_UPDATED,
            actor_user_id=user.id,
            entity_type="symptom",
            entity_id=updated.id,
            changes_summary=summary,
        )
        if assessment is not None:
            await self.audit.record(
                AuditActions.SYMPTOM_SAFETY_CHECKED,
                actor_user_id=user.id,
                entity_type="symptom",
                entity_id=updated.id,
                changes_summary=(
                    f"safety_level={assessment.safety_level.value};"
                    f"rules={','.join(assessment.matched_rule_codes) or 'none'};"
                    f"rule_version={assessment.rule_version}"
                ),
            )
            return SymptomCreateResponse(
                symptom=_to_public(updated),
                safety_assessment=_assessment_response(assessment),
            )
        return _to_public(updated)

    async def update_status(
        self, user: UserDocument, symptom_id: str, payload: SymptomStatusUpdate
    ) -> SymptomPublic:
        ended_at = payload.ended_at
        if payload.status == SymptomStatus.RESOLVED and ended_at is None:
            ended_at = utc_now_aware()
        try:
            updated = await self.symptoms.update_status_owned(
                symptom_id,
                user.id,
                status=payload.status,
                ended_at=ended_at,
                expected_version=payload.expected_version,
            )
        except RepositoryNotFoundError as exc:
            raise NotFoundException(_NOT_FOUND) from exc
        except RepositoryConflictError as exc:
            raise ConflictException(str(exc)) from exc

        await self.audit.record(
            AuditActions.SYMPTOM_STATUS_CHANGED,
            actor_user_id=user.id,
            entity_type="symptom",
            entity_id=updated.id,
            changes_summary=f"status={payload.status.value}",
        )
        return _to_public(updated)

    async def delete(self, user: UserDocument, symptom_id: str) -> MessageResponse:
        try:
            deleted = await self.symptoms.soft_delete_owned(symptom_id, user.id)
        except RepositoryNotFoundError as exc:
            raise NotFoundException(_NOT_FOUND) from exc
        await self.audit.record(
            AuditActions.SYMPTOM_DELETED,
            actor_user_id=user.id,
            entity_type="symptom",
            entity_id=deleted.id,
            changes_summary="soft_deleted=true",
        )
        return MessageResponse(message="Symptom deleted")

    async def safety_check(
        self, user: UserDocument, answers: SymptomSafetyAnswers
    ) -> SymptomSafetyCheckResponse:
        assessment = self.safety.assess(answers.as_dict())
        await self.audit.record(
            AuditActions.SYMPTOM_SAFETY_CHECKED,
            actor_user_id=user.id,
            entity_type="symptom_safety",
            entity_id=None,
            changes_summary=(
                f"safety_level={assessment.safety_level.value};"
                f"rules={','.join(assessment.matched_rule_codes) or 'none'};"
                f"rule_version={assessment.rule_version}"
            ),
        )
        return _assessment_response(assessment)
