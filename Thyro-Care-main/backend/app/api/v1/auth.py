"""Authentication API routes."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Request, Response, Security, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.api.dependencies import CurrentActiveUser, DatabaseDep, get_auth_service
from app.core.config import get_settings
from app.core.cookies import (
    clear_csrf_cookie,
    clear_refresh_cookie,
    set_csrf_cookie,
    set_refresh_cookie,
)
from app.core.csrf import generate_csrf_token, verify_csrf
from app.core.exceptions import UnauthorizedException
from app.core.rate_limit import limiter
from app.core.tokens import decode_access_token
from app.models.object_id import object_id_to_string, to_object_id
from app.models.user import UserDocument
from app.schemas.auth import (
    AuthUserPublic,
    ChangePasswordRequest,
    ForgotPasswordRequest,
    GoogleAuthRequest,
    LoginRequest,
    MessageResponse,
    RegisterRequest,
    ResendVerificationRequest,
    ResetPasswordRequest,
    TokenResponse,
    VerifyEmailRequest,
)
from app.services.account_auth_service import AccountAuthService
from app.services.auth_service import AuthService

router = APIRouter(prefix="/auth", tags=["auth"])
_optional_bearer = HTTPBearer(auto_error=False)

AuthServiceDep = Annotated[AuthService, Depends(get_auth_service)]


def get_account_auth_service(database: DatabaseDep) -> AccountAuthService:
    return AccountAuthService(database)


AccountAuthServiceDep = Annotated[AccountAuthService, Depends(get_account_auth_service)]


def _login_limit() -> str:
    return get_settings().auth_rate_limit_login


def _register_limit() -> str:
    return get_settings().auth_rate_limit_register


def _refresh_limit() -> str:
    return get_settings().auth_rate_limit_refresh


def _forgot_limit() -> str:
    return get_settings().auth_rate_limit_forgot_password


def _reset_limit() -> str:
    return get_settings().auth_rate_limit_reset_password


def _verify_limit() -> str:
    return get_settings().auth_rate_limit_verify_email


def _resend_limit() -> str:
    return get_settings().auth_rate_limit_resend_verification


def _change_password_limit() -> str:
    return get_settings().auth_rate_limit_change_password


def _google_limit() -> str:
    return get_settings().auth_rate_limit_google


def _apply_session_cookies(
    response: Response,
    *,
    raw_refresh: str,
    refresh_max_age: int,
) -> None:
    csrf = generate_csrf_token()
    set_refresh_cookie(response, raw_refresh, max_age=refresh_max_age)
    set_csrf_cookie(response, csrf, max_age=refresh_max_age)


def _user_public(user: UserDocument) -> AuthUserPublic:
    return AuthUserPublic(
        id=object_id_to_string(user.id),
        full_name=user.full_name,
        email=user.email_display,
        role=user.role,
        account_status=user.account_status,
        email_verified=user.email_verified,
        created_at=user.created_at,
    )


def _client_ip(request: Request) -> str | None:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",", 1)[0].strip()
    if request.client:
        return request.client.host
    return None


@router.post(
    "/register",
    response_model=TokenResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a patient account",
)
@limiter.limit(_register_limit)
async def register(
    payload: RegisterRequest,
    request: Request,
    response: Response,
    auth: AuthServiceDep,
    account: AccountAuthServiceDep,
) -> TokenResponse:
    """Create a PATIENT account only. Role cannot be chosen by the client."""
    session = await auth.register(
        payload,
        user_agent=request.headers.get("user-agent"),
    )
    user = await account.users.get_by_id(to_object_id(session.response.user.id))
    if user is not None:
        await account.maybe_send_registration_verification(user)
    _apply_session_cookies(
        response,
        raw_refresh=session.raw_refresh_token,
        refresh_max_age=session.refresh_max_age,
    )
    return session.response


@router.post("/login", response_model=TokenResponse, summary="Login")
@limiter.limit(_login_limit)
async def login(
    payload: LoginRequest,
    request: Request,
    response: Response,
    auth: AuthServiceDep,
) -> TokenResponse:
    session = await auth.login(
        payload,
        user_agent=request.headers.get("user-agent"),
    )
    _apply_session_cookies(
        response,
        raw_refresh=session.raw_refresh_token,
        refresh_max_age=session.refresh_max_age,
    )
    return session.response


@router.post("/refresh", response_model=TokenResponse, summary="Refresh access token")
@limiter.limit(_refresh_limit)
async def refresh(
    request: Request,
    response: Response,
    auth: AuthServiceDep,
) -> TokenResponse:
    """Requires HttpOnly refresh cookie + X-CSRF-Token header."""
    verify_csrf(request)
    settings = get_settings()
    raw = request.cookies.get(settings.refresh_cookie_name)
    if not raw:
        raise UnauthorizedException("Invalid refresh token")
    session = await auth.refresh(
        raw,
        user_agent=request.headers.get("user-agent"),
    )
    _apply_session_cookies(
        response,
        raw_refresh=session.raw_refresh_token,
        refresh_max_age=session.refresh_max_age,
    )
    return session.response


@router.post("/logout", response_model=MessageResponse, summary="Logout")
async def logout(
    request: Request,
    response: Response,
    auth: AuthServiceDep,
) -> MessageResponse:
    settings = get_settings()
    raw = request.cookies.get(settings.refresh_cookie_name)
    if raw:
        verify_csrf(request)
        await auth.logout(raw)
    clear_refresh_cookie(response)
    clear_csrf_cookie(response)
    return MessageResponse(message="Logged out")


@router.get(
    "/me",
    response_model=AuthUserPublic,
    summary="Current authenticated user",
)
async def me(user: CurrentActiveUser) -> AuthUserPublic:
    return _user_public(user)


@router.post("/forgot-password", response_model=MessageResponse, summary="Request password reset")
@limiter.limit(_forgot_limit)
async def forgot_password(
    payload: ForgotPasswordRequest,
    request: Request,
    account: AccountAuthServiceDep,
) -> MessageResponse:
    return await account.forgot_password(
        payload,
        ip=_client_ip(request),
        user_agent=request.headers.get("user-agent"),
    )


@router.post("/reset-password", response_model=MessageResponse, summary="Reset password with token")
@limiter.limit(_reset_limit)
async def reset_password(
    payload: ResetPasswordRequest,
    request: Request,
    account: AccountAuthServiceDep,
) -> MessageResponse:
    _ = request
    return await account.reset_password(payload)


@router.post("/verify-email", response_model=MessageResponse, summary="Verify email with token")
@limiter.limit(_verify_limit)
async def verify_email(
    payload: VerifyEmailRequest,
    request: Request,
    account: AccountAuthServiceDep,
) -> MessageResponse:
    _ = request
    return await account.verify_email(payload)


@router.post(
    "/resend-verification",
    response_model=MessageResponse,
    summary="Resend email verification",
)
@limiter.limit(_resend_limit)
async def resend_verification(
    request: Request,
    account: AccountAuthServiceDep,
    auth: AuthServiceDep,
    payload: ResendVerificationRequest | None = None,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Security(_optional_bearer)] = None,
) -> MessageResponse:
    user: UserDocument | None = None
    if credentials is not None and credentials.scheme.lower() == "bearer":
        try:
            claims = decode_access_token(credentials.credentials)
            user = await auth.get_user_for_claims(claims.user_id, claims.role)
        except Exception:
            user = None
    return await account.resend_verification(
        user=user,
        payload=payload or ResendVerificationRequest(),
        ip=_client_ip(request),
        user_agent=request.headers.get("user-agent"),
    )


@router.post(
    "/change-password",
    response_model=MessageResponse,
    summary="Change password for authenticated user",
)
@limiter.limit(_change_password_limit)
async def change_password(
    payload: ChangePasswordRequest,
    request: Request,
    user: CurrentActiveUser,
    account: AccountAuthServiceDep,
) -> MessageResponse:
    _ = request
    return await account.change_password(user, payload)


@router.post("/google", response_model=TokenResponse, summary="Sign in with Google ID token")
@limiter.limit(_google_limit)
async def google_login(
    payload: GoogleAuthRequest,
    request: Request,
    response: Response,
    account: AccountAuthServiceDep,
) -> TokenResponse:
    session = await account.google_login(
        payload,
        user_agent=request.headers.get("user-agent"),
    )
    _apply_session_cookies(
        response,
        raw_refresh=session.raw_refresh_token,
        refresh_max_age=session.refresh_max_age,
    )
    return session.response
