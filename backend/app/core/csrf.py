"""CSRF double-submit cookie helpers."""

from __future__ import annotations

import hmac
import secrets

from fastapi import Request

from app.core.config import get_settings
from app.core.exceptions import ForbiddenException


def generate_csrf_token() -> str:
    return secrets.token_urlsafe(32)


def extract_csrf_header(request: Request) -> str | None:
    settings = get_settings()
    return request.headers.get(settings.csrf_header_name)


def extract_csrf_cookie(request: Request) -> str | None:
    settings = get_settings()
    return request.cookies.get(settings.csrf_cookie_name)


def verify_csrf(request: Request) -> None:
    header = extract_csrf_header(request)
    cookie = extract_csrf_cookie(request)
    if not header or not cookie:
        raise ForbiddenException("CSRF validation failed")
    if not hmac.compare_digest(header, cookie):
        raise ForbiddenException("CSRF validation failed")
