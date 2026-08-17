"""Account recovery, verification, password change, and Google login."""

from __future__ import annotations

import secrets
from datetime import timedelta

from pymongo.asynchronous.database import AsyncDatabase
from pymongo.errors import DuplicateKeyError

from app.core.config import Settings, get_settings
from app.core.exceptions import (
    ConflictException,
    ForbiddenException,
    UnauthorizedException,
    ValidationException,
)
from app.core.passwords import hash_password, verify_password
from app.models.auth_tokens import AuthActionTokenDocument, AuthIdentityDocument
from app.models.enums import AccountStatus, AuthActionPurpose, AuthIdentityProvider, UserRole
from app.models.patient_profile import PatientProfileDocument
from app.models.user import UserDocument
from app.repositories.auth_action_token_repository import AuthActionTokenRepository
from app.repositories.auth_identity_repository import AuthIdentityRepository
from app.repositories.patient_profile_repository import PatientProfileRepository
from app.repositories.refresh_token_repository import RefreshTokenRepository
from app.repositories.user_repository import UserRepository
from app.schemas.auth import (
    ChangePasswordRequest,
    ForgotPasswordRequest,
    GoogleAuthRequest,
    MessageResponse,
    ResendVerificationRequest,
    ResetPasswordRequest,
    VerifyEmailRequest,
)
from app.services.audit_service import AuditActions, AuditService, email_fingerprint
from app.services.auth_service import AuthService, AuthSessionResult
from app.services.auth_token_crypto import (
    fingerprint_request,
    generate_raw_token,
    hash_action_token,
    tokens_match,
)
from app.services.email_service import EmailService
from app.services.google_identity_service import GENERIC_GOOGLE_INVALID, GoogleIdentityService
from app.utils.datetime import utc_now
from app.utils.email import normalize_email

GENERIC_RESET = "If an eligible account exists, password reset instructions will be sent."
GENERIC_TOKEN_INVALID = "This link is invalid or has expired"
GENERIC_VERIFY_OK = "Email verified successfully"
GENERIC_ALREADY_VERIFIED = "Email is already verified"


class AccountAuthService:
    def __init__(
        self,
        database: AsyncDatabase,
        settings: Settings | None = None,
        email_service: EmailService | None = None,
        google_service: GoogleIdentityService | None = None,
        auth_service: AuthService | None = None,
    ) -> None:
        self.settings = settings or get_settings()
        self.users = UserRepository(database)
        self.profiles = PatientProfileRepository(database)
        self.refresh_tokens = RefreshTokenRepository(database)
        self.action_tokens = AuthActionTokenRepository(database)
        self.identities = AuthIdentityRepository(database)
        self.audit = AuditService(database)
        self.email = email_service or EmailService(self.settings)
        self.google = google_service or GoogleIdentityService(self.settings)
        self.auth = auth_service or AuthService(database, self.settings)

    async def _issue_action_token(
        self,
        *,
        user: UserDocument,
        purpose: AuthActionPurpose,
        ttl: timedelta,
        request_fingerprint: str | None,
    ) -> str:
        await self.action_tokens.invalidate_active_for_user(user.id, purpose)
        raw = generate_raw_token()
        document = AuthActionTokenDocument(
            user_id=user.id,
            purpose=purpose,
            token_hash=hash_action_token(raw),
            expires_at=utc_now() + ttl,
            request_fingerprint=request_fingerprint,
        )
        await self.action_tokens.create_token(document)
        return raw

    async def forgot_password(
        self,
        payload: ForgotPasswordRequest,
        *,
        ip: str | None = None,
        user_agent: str | None = None,
    ) -> MessageResponse:
        normalized = normalize_email(str(payload.email))
        fingerprint = email_fingerprint(normalized)
        await self.audit.record(
            AuditActions.PASSWORD_RESET_REQUESTED,
            changes_summary=f"request:{fingerprint}",
        )
        if not self.settings.password_reset_enabled:
            return MessageResponse(message=GENERIC_RESET)

        user = await self.users.get_by_email_normalized(normalized)
        eligible = (
            user is not None
            and not user.is_deleted
            and user.account_status == AccountStatus.ACTIVE
            and user.password_auth_enabled
        )
        if not eligible or user is None:
            return MessageResponse(message=GENERIC_RESET)

        try:
            raw = await self._issue_action_token(
                user=user,
                purpose=AuthActionPurpose.PASSWORD_RESET,
                ttl=timedelta(minutes=self.settings.password_reset_token_ttl_minutes),
                request_fingerprint=fingerprint_request(ip=ip, user_agent=user_agent),
            )
            if self.settings.email_delivery_enabled:
                await self.email.send_password_reset_email(
                    to_email=user.email_display,
                    full_name=user.full_name,
                    raw_token=raw,
                )
        except Exception:
            # Never reveal delivery/account details.
            return MessageResponse(message=GENERIC_RESET)
        return MessageResponse(message=GENERIC_RESET)

    async def reset_password(self, payload: ResetPasswordRequest) -> MessageResponse:
        if payload.new_password != payload.confirm_password:
            raise ValidationException("Passwords do not match")
        token_hash = hash_action_token(payload.token)
        record = await self.action_tokens.get_by_hash(token_hash)
        if (
            record is None
            or record.purpose != AuthActionPurpose.PASSWORD_RESET
            or record.consumed_at is not None
            or record.expires_at <= utc_now()
            or not tokens_match(payload.token, record.token_hash)
        ):
            raise ValidationException(GENERIC_TOKEN_INVALID)

        consumed = await self.action_tokens.consume_atomically(record.id)
        if consumed is None:
            raise ValidationException(GENERIC_TOKEN_INVALID)

        user = await self.users.get_by_id(record.user_id)
        if user is None or user.is_deleted or user.account_status != AccountStatus.ACTIVE:
            raise ValidationException(GENERIC_TOKEN_INVALID)

        new_hash = hash_password(payload.new_password)
        await self.users.update_one(
            user.id,
            {
                "password_hash": new_hash,
                "password_auth_enabled": True,
                "failed_login_count": 0,
                "locked_until": None,
            },
        )
        await self.refresh_tokens.revoke_all_for_user(user.id)
        await self.audit.record(
            AuditActions.PASSWORD_RESET_COMPLETED,
            actor_user_id=user.id,
            entity_id=user.id,
        )
        if self.settings.email_delivery_enabled:
            try:
                await self.email.send_password_changed_email(
                    to_email=user.email_display,
                    full_name=user.full_name,
                )
            except Exception:
                pass
        return MessageResponse(message="Password updated. Sign in with your new password.")

    async def verify_email(self, payload: VerifyEmailRequest) -> MessageResponse:
        token_hash = hash_action_token(payload.token)
        record = await self.action_tokens.get_by_hash(token_hash)
        if (
            record is None
            or record.purpose != AuthActionPurpose.EMAIL_VERIFICATION
            or record.consumed_at is not None
            or record.expires_at <= utc_now()
            or not tokens_match(payload.token, record.token_hash)
        ):
            raise ValidationException(GENERIC_TOKEN_INVALID)

        consumed = await self.action_tokens.consume_atomically(record.id)
        if consumed is None:
            raise ValidationException(GENERIC_TOKEN_INVALID)

        user = await self.users.get_by_id(record.user_id)
        if user is None or user.is_deleted:
            raise ValidationException(GENERIC_TOKEN_INVALID)
        if user.email_verified:
            return MessageResponse(message=GENERIC_ALREADY_VERIFIED)

        updates: dict[str, object] = {"email_verified": True}
        if user.account_status == AccountStatus.PENDING:
            updates["account_status"] = AccountStatus.ACTIVE
        await self.users.update_one(user.id, updates)
        await self.audit.record(
            AuditActions.EMAIL_VERIFIED,
            actor_user_id=user.id,
            entity_id=user.id,
        )
        return MessageResponse(message=GENERIC_VERIFY_OK)

    async def resend_verification(
        self,
        *,
        user: UserDocument | None = None,
        payload: ResendVerificationRequest | None = None,
        ip: str | None = None,
        user_agent: str | None = None,
    ) -> MessageResponse:
        generic = MessageResponse(message="If verification is required, instructions will be sent.")
        if not self.settings.email_verification_enabled:
            return generic

        target = user
        if target is None and payload is not None and payload.email:
            target = await self.users.get_by_email_normalized(normalize_email(str(payload.email)))
        if target is None or target.is_deleted:
            return generic
        if target.email_verified:
            return MessageResponse(message=GENERIC_ALREADY_VERIFIED)

        try:
            raw = await self._issue_action_token(
                user=target,
                purpose=AuthActionPurpose.EMAIL_VERIFICATION,
                ttl=timedelta(hours=self.settings.email_verification_token_ttl_hours),
                request_fingerprint=fingerprint_request(ip=ip, user_agent=user_agent),
            )
            if self.settings.email_delivery_enabled:
                await self.email.send_verification_email(
                    to_email=target.email_display,
                    full_name=target.full_name,
                    raw_token=raw,
                )
            await self.audit.record(
                AuditActions.EMAIL_VERIFICATION_SENT,
                actor_user_id=target.id,
                entity_id=target.id,
            )
        except Exception:
            return generic
        return generic

    async def change_password(
        self,
        user: UserDocument,
        payload: ChangePasswordRequest,
    ) -> MessageResponse:
        if not user.password_auth_enabled:
            raise ValidationException(
                "Password login is not enabled for this account. Use Forgot password to set one."
            )
        if payload.new_password != payload.confirm_password:
            raise ValidationException("Passwords do not match")
        if not verify_password(payload.current_password, user.password_hash):
            raise UnauthorizedException("Current password is incorrect")
        if verify_password(payload.new_password, user.password_hash):
            raise ValidationException("New password must be different from the current password")

        new_hash = hash_password(payload.new_password)
        await self.users.update_one(user.id, {"password_hash": new_hash})
        await self.refresh_tokens.revoke_all_for_user(user.id)
        await self.audit.record(
            AuditActions.PASSWORD_CHANGED,
            actor_user_id=user.id,
            entity_id=user.id,
        )
        if self.settings.email_delivery_enabled:
            try:
                await self.email.send_password_changed_email(
                    to_email=user.email_display,
                    full_name=user.full_name,
                )
            except Exception:
                pass
        return MessageResponse(message="Password updated. Please sign in again.")

    async def maybe_send_registration_verification(self, user: UserDocument) -> None:
        if not self.settings.email_verification_enabled:
            return
        try:
            raw = await self._issue_action_token(
                user=user,
                purpose=AuthActionPurpose.EMAIL_VERIFICATION,
                ttl=timedelta(hours=self.settings.email_verification_token_ttl_hours),
                request_fingerprint=None,
            )
            if self.settings.email_delivery_enabled:
                await self.email.send_verification_email(
                    to_email=user.email_display,
                    full_name=user.full_name,
                    raw_token=raw,
                )
            await self.audit.record(
                AuditActions.EMAIL_VERIFICATION_SENT,
                actor_user_id=user.id,
                entity_id=user.id,
            )
        except Exception:
            return

    async def google_login(
        self,
        payload: GoogleAuthRequest,
        *,
        user_agent: str | None = None,
    ) -> AuthSessionResult:
        if not self.settings.google_auth_enabled:
            await self.audit.record(AuditActions.GOOGLE_LOGIN_FAILED, changes_summary="disabled")
            raise UnauthorizedException(GENERIC_GOOGLE_INVALID)

        try:
            identity = self.google.verify_id_token(payload.credential)
        except UnauthorizedException:
            await self.audit.record(
                AuditActions.GOOGLE_LOGIN_FAILED,
                changes_summary="invalid_token",
            )
            raise

        existing_identity = await self.identities.get_by_provider_subject(
            AuthIdentityProvider.GOOGLE,
            identity.provider_subject,
        )
        if existing_identity is not None:
            user = await self.users.get_by_id(existing_identity.user_id)
            if user is None or user.is_deleted:
                await self.audit.record(
                    AuditActions.GOOGLE_LOGIN_FAILED,
                    changes_summary="missing_user",
                )
                raise UnauthorizedException(GENERIC_GOOGLE_INVALID)
            if user.account_status in {AccountStatus.SUSPENDED, AccountStatus.INACTIVE}:
                raise ForbiddenException("Account unavailable")
            await self.identities.touch_login(existing_identity.id)
            await self.users.update_one(user.id, {"last_login_at": utc_now()})
            session = await self.auth._issue_session(user, user_agent=user_agent, new_family=True)
            await self.audit.record(
                AuditActions.GOOGLE_LOGIN_SUCCEEDED,
                actor_user_id=user.id,
                entity_id=user.id,
                changes_summary="returning",
            )
            return session

        local = await self.users.get_by_email_normalized(identity.normalized_email)
        if local is not None and not local.is_deleted:
            await self.audit.record(
                AuditActions.GOOGLE_ACCOUNT_CONFLICT,
                actor_user_id=local.id,
                entity_id=local.id,
                changes_summary=email_fingerprint(identity.normalized_email),
            )
            raise ConflictException(
                "An account already exists with this email. "
                "Sign in with your password before linking Google."
            )

        random_password = secrets.token_urlsafe(48)
        password_hash = hash_password(random_password)
        user = UserDocument(
            email_normalized=identity.normalized_email,
            email_display=identity.display_email,
            password_hash=password_hash,
            full_name=identity.display_name,
            role=UserRole.PATIENT,
            account_status=AccountStatus.ACTIVE,
            email_verified=True,
            password_auth_enabled=False,
            last_login_at=utc_now(),
        )
        try:
            user = await self.users.create_user_document(user)
        except DuplicateKeyError:
            # Concurrent Google signup or pre-existing local account.
            raced = await self.identities.get_by_provider_subject(
                AuthIdentityProvider.GOOGLE,
                identity.provider_subject,
            )
            if raced is not None:
                raced_user = await self.users.get_by_id(raced.user_id)
                if raced_user is None or raced_user.is_deleted:
                    raise UnauthorizedException(GENERIC_GOOGLE_INVALID) from None
                session = await self.auth._issue_session(
                    raced_user, user_agent=user_agent, new_family=True
                )
                return session
            await self.audit.record(
                AuditActions.GOOGLE_ACCOUNT_CONFLICT,
                changes_summary=email_fingerprint(identity.normalized_email),
            )
            raise ConflictException(
                "An account already exists with this email. "
                "Sign in with your password before linking Google."
            ) from None

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

        link = AuthIdentityDocument(
            user_id=user.id,
            provider=AuthIdentityProvider.GOOGLE,
            provider_subject=identity.provider_subject,
            provider_email_at_link=identity.display_email,
            email_verified=True,
            last_login_at=now,
        )
        try:
            await self.identities.create_identity(link)
        except DuplicateKeyError:
            # Concurrent first login — load winner identity
            existing_identity = await self.identities.get_by_provider_subject(
                AuthIdentityProvider.GOOGLE,
                identity.provider_subject,
            )
            if existing_identity is None:
                raise
            winner = await self.users.get_by_id(existing_identity.user_id)
            if winner is None:
                raise UnauthorizedException(GENERIC_GOOGLE_INVALID) from None
            if winner.id != user.id:
                await self.users.soft_delete(user.id)
            session = await self.auth._issue_session(winner, user_agent=user_agent, new_family=True)
            return session

        session = await self.auth._issue_session(user, user_agent=user_agent, new_family=True)
        await self.audit.record(
            AuditActions.GOOGLE_LOGIN_SUCCEEDED,
            actor_user_id=user.id,
            entity_id=user.id,
            changes_summary="created_patient",
        )
        return session
