"""Auth cookie helpers (refresh HttpOnly + CSRF readable)."""

from __future__ import annotations

from fastapi import Response

from app.core.config import Settings, get_settings


def _common_kwargs(settings: Settings) -> dict[str, object]:
    kwargs: dict[str, object] = {
        "secure": settings.cookie_secure,
        "samesite": settings.cookie_samesite,
        "path": settings.cookie_path,
    }
    if settings.cookie_domain:
        kwargs["domain"] = settings.cookie_domain
    return kwargs


def set_refresh_cookie(response: Response, raw_token: str, *, max_age: int) -> None:
    settings = get_settings()
    response.set_cookie(
        key=settings.refresh_cookie_name,
        value=raw_token,
        httponly=True,
        max_age=max_age,
        **_common_kwargs(settings),
    )


def clear_refresh_cookie(response: Response) -> None:
    settings = get_settings()
    response.delete_cookie(
        key=settings.refresh_cookie_name,
        httponly=True,
        **_common_kwargs(settings),
    )


def set_csrf_cookie(response: Response, csrf_token: str, *, max_age: int) -> None:
    settings = get_settings()
    # CSRF must be readable by JS; path="/" so frontend can read it for all pages.
    kwargs = _common_kwargs(settings)
    kwargs["path"] = "/"
    response.set_cookie(
        key=settings.csrf_cookie_name,
        value=csrf_token,
        httponly=False,
        max_age=max_age,
        **kwargs,
    )


def clear_csrf_cookie(response: Response) -> None:
    settings = get_settings()
    kwargs = _common_kwargs(settings)
    kwargs["path"] = "/"
    response.delete_cookie(
        key=settings.csrf_cookie_name,
        httponly=False,
        **kwargs,
    )
