"""Google ID token verification (server-side only)."""

from __future__ import annotations

from dataclasses import dataclass

from google.auth.transport import requests as google_requests
from google.oauth2 import id_token

from app.core.config import Settings, get_settings
from app.core.exceptions import UnauthorizedException
from app.utils.email import normalize_email, split_display_email

GENERIC_GOOGLE_INVALID = "Google sign-in failed"


@dataclass(frozen=True, slots=True)
class VerifiedGoogleIdentity:
    provider_subject: str
    normalized_email: str
    display_email: str
    display_name: str
    email_verified: bool


class GoogleIdentityService:
    def __init__(self, settings: Settings | None = None) -> None:
        self.settings = settings or get_settings()

    def verify_id_token(self, credential: str) -> VerifiedGoogleIdentity:
        if not self.settings.google_auth_enabled:
            raise UnauthorizedException(GENERIC_GOOGLE_INVALID)
        client_id = self.settings.google_client_id.strip()
        if not client_id or not credential.strip():
            raise UnauthorizedException(GENERIC_GOOGLE_INVALID)
        try:
            claims = id_token.verify_oauth2_token(
                credential,
                google_requests.Request(),
                audience=client_id,
            )
        except Exception as exc:
            raise UnauthorizedException(GENERIC_GOOGLE_INVALID) from exc

        iss = str(claims.get("iss") or "")
        if iss not in {"accounts.google.com", "https://accounts.google.com"}:
            raise UnauthorizedException(GENERIC_GOOGLE_INVALID)
        sub = str(claims.get("sub") or "").strip()
        email = str(claims.get("email") or "").strip()
        email_verified = bool(claims.get("email_verified"))
        if not sub or not email or not email_verified:
            raise UnauthorizedException(GENERIC_GOOGLE_INVALID)
        normalized, display = split_display_email(email)
        name = str(claims.get("name") or "").strip() or normalized.split("@", 1)[0]
        return VerifiedGoogleIdentity(
            provider_subject=sub,
            normalized_email=normalize_email(normalized),
            display_email=display,
            display_name=name[:200],
            email_verified=True,
        )
