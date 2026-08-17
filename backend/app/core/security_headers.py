"""API security header helpers."""

from __future__ import annotations

from starlette.datastructures import MutableHeaders
from starlette.requests import Request
from starlette.responses import Response


def _is_docs_path(path: str) -> bool:
    return path in {"/docs", "/redoc", "/openapi.json"} or path.startswith("/docs")


def apply_security_header_values(path: str, headers: MutableHeaders) -> None:
    """Attach restrictive API headers without breaking OpenAPI docs."""
    headers.setdefault("X-Content-Type-Options", "nosniff")
    headers.setdefault("X-Frame-Options", "DENY")
    headers.setdefault("Referrer-Policy", "no-referrer")
    headers.setdefault(
        "Permissions-Policy",
        "geolocation=(), microphone=(), camera=()",
    )
    if not _is_docs_path(path):
        headers.setdefault("Cache-Control", "no-store")


def apply_security_headers(request: Request, response: Response) -> None:
    apply_security_header_values(request.url.path, response.headers)
