"""Patient self-profile service."""

from __future__ import annotations

from pymongo.asynchronous.database import AsyncDatabase

from app.core.exceptions import NotFoundException, ValidationException
from app.models.object_id import object_id_to_string
from app.models.patient_profile import PatientProfileDocument
from app.models.user import UserDocument
from app.repositories.patient_profile_repository import PatientProfileRepository
from app.repositories.user_repository import UserRepository
from app.schemas.patient_profile import (
    PatientAccountPublic,
    PatientProfilePublic,
    PatientProfileUpdate,
    PatientProfileWithAccount,
)
from app.services.audit_service import AuditActions, AuditService
from app.services.profile_completion_service import calculate_profile_completion

_PROFILE_MISSING_MSG = (
    "Profile is not initialized. Please contact support if this continues after registration."
)


class ProfileService:
    def __init__(self, database: AsyncDatabase) -> None:
        self.users = UserRepository(database)
        self.profiles = PatientProfileRepository(database)
        self.audit = AuditService(database)

    def _account_public(self, user: UserDocument) -> PatientAccountPublic:
        return PatientAccountPublic(
            id=object_id_to_string(user.id),
            full_name=user.full_name,
            email=user.email_display,
            role=user.role.value if hasattr(user.role, "value") else str(user.role),
            account_status=(
                user.account_status.value
                if hasattr(user.account_status, "value")
                else str(user.account_status)
            ),
            email_verified=user.email_verified,
            created_at=user.created_at,
        )

    def _profile_public(self, profile: PatientProfileDocument) -> PatientProfilePublic:
        return PatientProfilePublic(
            id=object_id_to_string(profile.id),
            age_range=profile.age_range,
            preferred_language=profile.preferred_language,
            surgery_date=profile.surgery_date,
            rai_treatment_status=profile.rai_treatment_status,
            treatment_stage=profile.treatment_stage,
            emergency_contact_name=profile.emergency_contact_name,
            emergency_contact_phone=profile.emergency_contact_phone,
            current_medication_summary=profile.current_medication_summary,
            consent_accepted=profile.consent_accepted,
            consent_accepted_at=profile.consent_accepted_at,
            disclaimer_accepted=profile.disclaimer_accepted,
            disclaimer_accepted_at=profile.disclaimer_accepted_at,
            profile_completion_percentage=calculate_profile_completion(profile),
            created_at=profile.created_at,
            updated_at=profile.updated_at,
            version=profile.version,
        )

    def _to_response(
        self, profile: PatientProfileDocument, user: UserDocument
    ) -> PatientProfileWithAccount:
        return PatientProfileWithAccount(
            profile=self._profile_public(profile),
            account=self._account_public(user),
        )

    async def get_my_profile(self, user: UserDocument) -> PatientProfileWithAccount:
        profile = await self.profiles.get_by_user_id(user.id)
        if profile is None:
            # Legacy / incomplete registration: do not fabricate consent.
            raise NotFoundException(_PROFILE_MISSING_MSG)
        return self._to_response(profile, user)

    async def update_my_profile(
        self,
        user: UserDocument,
        payload: PatientProfileUpdate,
    ) -> PatientProfileWithAccount:
        existing = await self.profiles.get_by_user_id(user.id)
        if existing is None:
            raise NotFoundException(_PROFILE_MISSING_MSG)

        updates = payload.editable_payload()
        if not updates:
            raise ValidationException("No profile fields to update")

        changed_fields = sorted(updates.keys())
        updated = await self.profiles.update_for_user(
            user.id,
            updates,
            expected_version=payload.expected_version,
        )

        await self.audit.record(
            AuditActions.PROFILE_UPDATED,
            actor_user_id=user.id,
            entity_type="patient_profile",
            entity_id=updated.id,
            changes_summary=",".join(changed_fields),
        )
        return self._to_response(updated, user)
