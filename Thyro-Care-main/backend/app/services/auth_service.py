"""Authentication workflows: register, login, refresh, logout."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import timedelta

from bson import ObjectId
from pymongo.asynchronous.database import AsyncDatabase
from pymongo.errors import DuplicateKeyError

from app.core.config import Settings, get_settings
from app.core.exceptions import (
    ConflictException,
    ForbiddenException,
    UnauthorizedException,
    ValidationException,
)
from app.core.passwords import hash_password, verify_and_update_password
from app.core.tokens import create_access_token
from app.models.enums import AccountStatus, UserRole
from app.models.object_id import object_id_to_string
from app.models.patient_profile import PatientProfileDocument
from app.models.supporting import RefreshTokenDocument
from app.models.user import UserDocument
from app.repositories.patient_profile_repository import PatientProfileRepository
from app.repositories.refresh_token_repository import RefreshTokenRepository
from app.repositories.user_repository import UserRepository
from app.schemas.auth import AuthUserPublic, LoginRequest, RegisterRequest, TokenResponse
from app.services.audit_service import AuditActions, AuditService, email_fingerprint
from app.services.refresh_token_crypto import (
    hash_refresh_token,
    hash_user_agent,
    issue_refresh_token,
)
from app.utils.datetime import utc_now
from app.utils.email import normalize_email, split_display_email

GENERIC_INVALID = "Invalid email or password."
ACCOUNT_UNAVAILABLE = "Account is unavailable."


@dataclass(frozen=True, slots=True)
class AuthSessionResult:
    response: TokenResponse
    raw_refresh_token: str
    refresh_max_age: int


class AuthService:
    def __init__(self, database: AsyncDatabase, settings: Settings | None = None) -> None:
        self.settings = settings or get_settings()
        self.users = UserRepository(database)
        self.profiles = PatientProfileRepository(database)
        self.refresh_tokens = RefreshTokenRepository(database)
        self.audit = AuditService(database)

    def _to_public(self, user: UserDocument) -> AuthUserPublic:
        return AuthUserPublic(
            id=object_id_to_string(user.id),
            full_name=user.full_name,
            email=user.email_display,
            role=user.role,
            account_status=user.account_status,
            email_verified=user.email_verified,
            created_at=user.created_at,
        )

    def _ensure_login_allowed(self, user: UserDocument) -> None:
        if user.is_deleted:
            raise UnauthorizedException(GENERIC_INVALID)
        now = utc_now()
        if user.locked_until is not None and user.locked_until > now:
            raise UnauthorizedException(GENERIC_INVALID)
        if user.account_status in {AccountStatus.SUSPENDED, AccountStatus.INACTIVE}:
            raise ForbiddenException(ACCOUNT_UNAVAILABLE)
        if (
            user.account_status == AccountStatus.PENDING
            and self.settings.require_email_verification
            and not user.email_verified
        ):
            raise ForbiddenException(ACCOUNT_UNAVAILABLE)

    async def _issue_session(
        self,
        user: UserDocument,
        *,
        user_agent: str | None,
        new_family: bool,
        family_id: str | None = None,
    ) -> AuthSessionResult:
        access, expires_in = create_access_token(
            user_id=user.id,
            role=user.role,
            settings=self.settings,
        )
        issued = issue_refresh_token(
            family_id=None if new_family else family_id,
            settings=self.settings,
        )
        record = RefreshTokenDocument(
            user_id=user.id,
            token_hash=issued.token_hash,
            family_id=issued.family_id,
            issued_at=issued.issued_at,
            expires_at=issued.expires_at,
            user_agent_hash=hash_user_agent(user_agent),
        )
        await self.refresh_tokens.create_token_record(record)
        return AuthSessionResult(
            response=TokenResponse(
                access_token=access,
                expires_in=expires_in,
                user=self._to_public(user),
            ),
            raw_refresh_token=issued.raw_token,
            refresh_max_age=issued.max_age_seconds,
        )

    async def register(
        self,
        payload: RegisterRequest,
        *,
        user_agent: str | None = None,
    ) -> AuthSessionResult:
        try:
            password_hash = hash_password(payload.password)
        except ValidationException:
            raise
        normalized, display = split_display_email(str(payload.email))

        if await self.users.email_exists(normalized):
            raise ConflictException("An account with this email already exists")

        initial_status = (
            AccountStatus.PENDING
            if self.settings.require_email_verification
            else AccountStatus.ACTIVE
        )
        user = UserDocument(
            email_normalized=normalized,
            email_display=display,
            password_hash=password_hash,
            full_name=payload.full_name,
            role=UserRole.PATIENT,
            account_status=initial_status,
            email_verified=not self.settings.require_email_verification,
        )
        try:
            user = await self.users.create_user_document(user)
        except DuplicateKeyError as exc:
            raise ConflictException("An account with this email already exists") from exc

        now = utc_now()
        profile = PatientProfileDocument(
            user_id=user.id,
            consent_accepted=True,
            consent_accepted_at=now,
            disclaimer_accepted=True,
            disclaimer_accepted_at=now,
        )
        try:
            await self.profiles.create_profile_document(profile)
        except Exception:
            await self.users.soft_delete(user.id)
            raise

        session = await self._issue_session(user, user_agent=user_agent, new_family=True)
        await self.audit.record(
            AuditActions.USER_REGISTERED,
            actor_user_id=user.id,
            entity_id=user.id,
            changes_summary="patient_registered",
        )
        return session

    async def login(
        self,
        payload: LoginRequest,
        *,
        user_agent: str | None = None,
    ) -> AuthSessionResult:
        normalized = normalize_email(str(payload.email))
        user = await self.users.get_by_email_normalized(normalized)

        if user is None or user.is_deleted:
            await self.audit.record(
                AuditActions.LOGIN_FAILED,
                changes_summary=f"unknown_or_deleted:{email_fingerprint(normalized)}",
            )
            raise UnauthorizedException(GENERIC_INVALID)

        now = utc_now()
        if user.locked_until is not None and user.locked_until > now:
            raise UnauthorizedException(GENERIC_INVALID)

        if user.account_status in {AccountStatus.SUSPENDED, AccountStatus.INACTIVE}:
            await self.audit.record(
                AuditActions.LOGIN_FAILED,
                actor_user_id=user.id,
                entity_id=user.id,
                changes_summary="blocked_status",
            )
            raise ForbiddenException(ACCOUNT_UNAVAILABLE)

        if not user.password_auth_enabled:
            await self.audit.record(
                AuditActions.LOGIN_FAILED,
                actor_user_id=user.id,
                entity_id=user.id,
                changes_summary="password_auth_disabled",
            )
            raise UnauthorizedException(GENERIC_INVALID)

        if (
            user.account_status == AccountStatus.PENDING
            and self.settings.require_email_verification
            and not user.email_verified
        ):
            raise ForbiddenException(ACCOUNT_UNAVAILABLE)

        ok, updated_hash = verify_and_update_password(payload.password, user.password_hash)
        if not ok:
            failed = user.failed_login_count + 1
            updates: dict[str, object] = {"failed_login_count": failed}
            if failed >= self.settings.login_max_failed_attempts:
                updates["locked_until"] = now + timedelta(minutes=self.settings.login_lock_minutes)
                await self.audit.record(
                    AuditActions.ACCOUNT_TEMPORARILY_LOCKED,
                    actor_user_id=user.id,
                    entity_id=user.id,
                )
            await self.users.update_one(user.id, updates)
            await self.audit.record(
                AuditActions.LOGIN_FAILED,
                actor_user_id=user.id,
                entity_id=user.id,
                changes_summary=f"bad_password:{email_fingerprint(normalized)}",
            )
            raise UnauthorizedException(GENERIC_INVALID)

        login_updates: dict[str, object] = {
            "failed_login_count": 0,
            "locked_until": None,
            "last_login_at": now,
        }
        if updated_hash:
            login_updates["password_hash"] = updated_hash
        user = await self.users.update_one(user.id, login_updates)

        session = await self._issue_session(user, user_agent=user_agent, new_family=True)
        await self.audit.record(
            AuditActions.LOGIN_SUCCEEDED,
            actor_user_id=user.id,
            entity_id=user.id,
        )
        return session

    async def refresh(
        self,
        raw_refresh_token: str,
        *,
        user_agent: str | None = None,
    ) -> AuthSessionResult:
        token_hash = hash_refresh_token(raw_refresh_token)
        record = await self.refresh_tokens.get_by_token_hash(token_hash)
        if record is None:
            raise UnauthorizedException("Invalid refresh token")

        if record.revoked_at is not None:
            await self.refresh_tokens.mark_reuse_detected(record.family_id)
            await self.audit.record(
                AuditActions.REFRESH_TOKEN_REUSE_DETECTED,
                actor_user_id=record.user_id,
                entity_type="refresh_token_family",
                changes_summary=record.family_id,
            )
            await self.audit.record(
                AuditActions.TOKEN_FAMILY_REVOKED,
                actor_user_id=record.user_id,
                changes_summary=record.family_id,
            )
            raise UnauthorizedException("Invalid refresh token")

        if not RefreshTokenRepository.is_active(record):
            raise UnauthorizedException("Invalid refresh token")

        user = await self.users.get_by_id(record.user_id)
        if user is None or user.is_deleted:
            raise UnauthorizedException("Invalid refresh token")
        self._ensure_login_allowed(user)

        issued = issue_refresh_token(family_id=record.family_id, settings=self.settings)
        replacement = RefreshTokenDocument(
            user_id=user.id,
            token_hash=issued.token_hash,
            family_id=issued.family_id,
            issued_at=issued.issued_at,
            expires_at=issued.expires_at,
            user_agent_hash=hash_user_agent(user_agent),
        )
        created = await self.refresh_tokens.rotate_token(current=record, new_document=replacement)
        if created is None:
            await self.refresh_tokens.mark_reuse_detected(record.family_id)
            await self.audit.record(
                AuditActions.REFRESH_TOKEN_REUSE_DETECTED,
                actor_user_id=record.user_id,
                changes_summary=record.family_id,
            )
            raise UnauthorizedException("Invalid refresh token")

        access, expires_in = create_access_token(
            user_id=user.id,
            role=user.role,
            settings=self.settings,
        )
        await self.audit.record(
            AuditActions.TOKEN_REFRESHED,
            actor_user_id=user.id,
            entity_id=user.id,
        )
        return AuthSessionResult(
            response=TokenResponse(
                access_token=access,
                expires_in=expires_in,
                user=self._to_public(user),
            ),
            raw_refresh_token=issued.raw_token,
            refresh_max_age=issued.max_age_seconds,
        )

    async def logout(self, raw_refresh_token: str | None) -> None:
        if not raw_refresh_token:
            return
        token_hash = hash_refresh_token(raw_refresh_token)
        record = await self.refresh_tokens.get_by_token_hash(token_hash)
        if record is None:
            return
        await self.refresh_tokens.revoke_token(record.id)
        await self.audit.record(
            AuditActions.LOGOUT_COMPLETED,
            actor_user_id=record.user_id,
            entity_id=record.user_id,
        )

    async def get_user_for_claims(self, user_id: ObjectId, jwt_role: UserRole) -> UserDocument:
        user = await self.users.get_by_id(user_id)
        if user is None or user.is_deleted:
            raise UnauthorizedException("Invalid or expired access token")
        self._ensure_login_allowed(user)
        if user.role != jwt_role:
            raise ForbiddenException("Insufficient permissions")
        return user
