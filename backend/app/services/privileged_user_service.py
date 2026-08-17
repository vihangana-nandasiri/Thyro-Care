"""Trusted CLI provisioning for ADMIN and MEDICAL_EXPERT accounts.

Public registration always creates PATIENT. Privileged roles must be created
only through this trusted backend environment (e.g. Render Shell).
"""

from __future__ import annotations

from dataclasses import dataclass

from pymongo.asynchronous.database import AsyncDatabase
from pymongo.errors import DuplicateKeyError

from app.core.exceptions import ConflictException, ValidationException
from app.core.passwords import hash_password
from app.models.enums import AccountStatus, UserRole
from app.models.user import UserDocument
from app.repositories.user_repository import UserRepository
from app.services.audit_service import AuditActions, AuditService, email_fingerprint
from app.utils.email import split_display_email

PRIVILEGED_ROLES: frozenset[UserRole] = frozenset(
    {UserRole.ADMIN, UserRole.MEDICAL_EXPERT},
)


@dataclass(frozen=True, slots=True)
class PrivilegedUserProvisionResult:
    """Safe success summary — never includes secrets or password hashes."""

    role: UserRole
    account_status: AccountStatus
    email_verified: bool
    user_id: str


class PrivilegedUserService:
    """Create privileged users using existing repository and password policy."""

    def __init__(self, database: AsyncDatabase) -> None:
        self.users = UserRepository(database)
        self.audit = AuditService(database)

    async def create_privileged_user(
        self,
        *,
        role: UserRole | str,
        full_name: str,
        email: str,
        password: str,
        confirm_password: str,
    ) -> PrivilegedUserProvisionResult:
        resolved_role = self._parse_privileged_role(role)
        cleaned_name = full_name.strip()
        if len(cleaned_name) < 2:
            raise ValidationException("Enter a full name")
        if password != confirm_password:
            raise ValidationException("Passwords do not match")

        password_hash = hash_password(password)
        if password in password_hash or password == password_hash:
            raise ValidationException("Password hashing failed safety check")

        normalized, display = split_display_email(email)
        if await self.users.email_exists(normalized):
            # Refuse duplicates and refuse silently changing any existing role.
            raise ConflictException("An account with this email already exists")

        # Administrative policy: trusted CLI provisioning yields an active,
        # verified account (no patient self-registration path).
        user = UserDocument(
            email_normalized=normalized,
            email_display=display,
            password_hash=password_hash,
            full_name=cleaned_name,
            role=resolved_role,
            account_status=AccountStatus.ACTIVE,
            email_verified=True,
        )
        try:
            created = await self.users.create_user_document(user)
        except DuplicateKeyError as exc:
            raise ConflictException("An account with this email already exists") from exc

        await self.audit.record(
            AuditActions.PRIVILEGED_USER_PROVISIONED,
            actor_user_id=None,
            entity_id=created.id,
            changes_summary=(
                f"role={resolved_role.value};fingerprint={email_fingerprint(normalized)}"
            ),
        )
        return PrivilegedUserProvisionResult(
            role=created.role,
            account_status=created.account_status,
            email_verified=created.email_verified,
            user_id=str(created.id),
        )

    @staticmethod
    def _parse_privileged_role(role: UserRole | str) -> UserRole:
        if isinstance(role, UserRole):
            resolved = role
        else:
            raw = str(role).strip().lower().replace("-", "_")
            try:
                resolved = UserRole(raw)
            except ValueError as exc:
                raise ValidationException(
                    "Role must be admin or medical_expert",
                ) from exc
        if resolved == UserRole.PATIENT:
            raise ValidationException(
                "Patient accounts must use public registration; "
                "privileged CLI rejects patient role",
            )
        if resolved not in PRIVILEGED_ROLES:
            raise ValidationException("Role must be admin or medical_expert")
        return resolved
