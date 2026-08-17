"""FastAPI dependencies for database, repositories, and authentication."""

from __future__ import annotations

from collections.abc import Callable
from typing import Annotated

from fastapi import Depends, Security
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pymongo.asynchronous.database import AsyncDatabase

from app.core.exceptions import (
    ForbiddenException,
    ServiceUnavailableException,
    UnauthorizedException,
)
from app.core.tokens import AccessTokenClaims, decode_access_token
from app.db.mongodb import get_database as get_mongo_database
from app.models.enums import UserRole
from app.models.user import UserDocument
from app.repositories.appointment_repository import AppointmentRepository
from app.repositories.chat_repository import ChatRepository
from app.repositories.knowledge_repository import KnowledgeRepository
from app.repositories.medication_repository import MedicationRepository
from app.repositories.patient_profile_repository import PatientProfileRepository
from app.repositories.refresh_token_repository import RefreshTokenRepository
from app.repositories.symptom_log_repository import SymptomLogRepository
from app.repositories.symptom_repository import SymptomRepository
from app.repositories.user_repository import UserRepository
from app.services.audit_service import AuditActions, AuditService
from app.services.auth_service import AuthService

bearer_scheme = HTTPBearer(auto_error=False)


def get_database() -> AsyncDatabase:
    """Return the lifespan-initialized database or raise 503."""
    database = get_mongo_database()
    if database is None:
        raise ServiceUnavailableException("Database temporarily unavailable")
    return database


DatabaseDep = Annotated[AsyncDatabase, Depends(get_database)]


def get_user_repository(database: DatabaseDep) -> UserRepository:
    return UserRepository(database)


def get_patient_profile_repository(database: DatabaseDep) -> PatientProfileRepository:
    return PatientProfileRepository(database)


def get_medication_repository(database: DatabaseDep) -> MedicationRepository:
    return MedicationRepository(database)


def get_appointment_repository(database: DatabaseDep) -> AppointmentRepository:
    return AppointmentRepository(database)


def get_symptom_repository(database: DatabaseDep) -> SymptomRepository:
    return SymptomRepository(database)


def get_symptom_log_repository(database: DatabaseDep) -> SymptomLogRepository:
    return SymptomLogRepository(database)


def get_chat_repository(database: DatabaseDep) -> ChatRepository:
    return ChatRepository(database)


def get_knowledge_repository(database: DatabaseDep) -> KnowledgeRepository:
    return KnowledgeRepository(database)


def get_refresh_token_repository(database: DatabaseDep) -> RefreshTokenRepository:
    return RefreshTokenRepository(database)


def get_auth_service(database: DatabaseDep) -> AuthService:
    return AuthService(database)


UserRepositoryDep = Annotated[UserRepository, Depends(get_user_repository)]
PatientProfileRepositoryDep = Annotated[
    PatientProfileRepository, Depends(get_patient_profile_repository)
]
MedicationRepositoryDep = Annotated[MedicationRepository, Depends(get_medication_repository)]
AppointmentRepositoryDep = Annotated[AppointmentRepository, Depends(get_appointment_repository)]
SymptomRepositoryDep = Annotated[SymptomRepository, Depends(get_symptom_repository)]
SymptomLogRepositoryDep = Annotated[SymptomLogRepository, Depends(get_symptom_log_repository)]
ChatRepositoryDep = Annotated[ChatRepository, Depends(get_chat_repository)]
KnowledgeRepositoryDep = Annotated[KnowledgeRepository, Depends(get_knowledge_repository)]
RefreshTokenRepositoryDep = Annotated[RefreshTokenRepository, Depends(get_refresh_token_repository)]
AuthServiceDep = Annotated[AuthService, Depends(get_auth_service)]


async def get_access_token_claims(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Security(bearer_scheme)],
) -> AccessTokenClaims:
    if credentials is None or credentials.scheme.lower() != "bearer" or not credentials.credentials:
        raise UnauthorizedException("Not authenticated")
    return decode_access_token(credentials.credentials)


AccessTokenClaimsDep = Annotated[AccessTokenClaims, Depends(get_access_token_claims)]


async def get_current_user(
    claims: AccessTokenClaimsDep,
    auth: AuthServiceDep,
) -> UserDocument:
    return await auth.get_user_for_claims(claims.user_id, claims.role)


async def get_current_active_user(
    user: Annotated[UserDocument, Depends(get_current_user)],
) -> UserDocument:
    return user


CurrentUser = Annotated[UserDocument, Depends(get_current_user)]
CurrentActiveUser = Annotated[UserDocument, Depends(get_current_active_user)]


def require_roles(*roles: UserRole) -> Callable[..., UserDocument]:
    allowed = set(roles)

    async def dependency(
        user: CurrentActiveUser,
        database: DatabaseDep,
    ) -> UserDocument:
        if user.role not in allowed:
            audit = AuditService(database)
            await audit.record(
                AuditActions.AUTHORIZATION_DENIED,
                actor_user_id=user.id,
                entity_id=user.id,
                changes_summary=f"required={sorted(r.value for r in allowed)}",
            )
            raise ForbiddenException("Insufficient permissions")
        return user

    return dependency


require_patient = require_roles(UserRole.PATIENT)
require_admin = require_roles(UserRole.ADMIN)
require_medical_expert = require_roles(UserRole.MEDICAL_EXPERT)
require_admin_or_medical_expert = require_roles(UserRole.ADMIN, UserRole.MEDICAL_EXPERT)

# Phase 12 knowledge governance role aliases — same authorization, clearer intent at call sites.
require_knowledge_manager = require_admin
require_knowledge_reviewer = require_medical_expert
