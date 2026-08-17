"""Patient self-profile API routes."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends

from app.api.dependencies import DatabaseDep, require_patient
from app.models.user import UserDocument
from app.schemas.patient_profile import PatientProfileUpdate, PatientProfileWithAccount
from app.services.profile_service import ProfileService

router = APIRouter(prefix="/profiles", tags=["profiles"])

CurrentPatient = Annotated[UserDocument, Depends(require_patient)]


def get_profile_service(database: DatabaseDep) -> ProfileService:
    return ProfileService(database)


ProfileServiceDep = Annotated[ProfileService, Depends(get_profile_service)]


@router.get(
    "/me",
    response_model=PatientProfileWithAccount,
    summary="Get my patient profile",
    description=(
        "Returns the authenticated patient's support profile and account identity. "
        "This is not a medical record and does not provide diagnosis. "
        "Requires a PATIENT access token. Ownership is derived from the token."
    ),
)
async def get_my_profile(
    user: CurrentPatient,
    service: ProfileServiceDep,
) -> PatientProfileWithAccount:
    return await service.get_my_profile(user)


@router.patch(
    "/me",
    response_model=PatientProfileWithAccount,
    summary="Update my patient profile",
    description=(
        "Partial update of editable support-profile fields. "
        "Requires expected_version for optimistic concurrency (HTTP 409 on mismatch). "
        "Consent, disclaimer, email, role, and account status cannot be changed. "
        "This profile is not a medical record."
    ),
    responses={
        409: {
            "description": "Profile version conflict — reload before saving again",
        },
    },
)
async def update_my_profile(
    payload: PatientProfileUpdate,
    user: CurrentPatient,
    service: ProfileServiceDep,
) -> PatientProfileWithAccount:
    return await service.update_my_profile(user, payload)
