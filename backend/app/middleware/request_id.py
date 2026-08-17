"""Request ID middleware (pure ASGI — avoids BaseHTTPMiddleware ExceptionGroup issues)."""

from __future__ import annotations

import re
import uuid

from starlette.datastructures import MutableHeaders
from starlette.requests import Request
from starlette.types import ASGIApp, Message, Receive, Scope, Send

from app.core.logging import set_request_id

_REQUEST_ID_PATTERN = re.compile(r"^[A-Za-z0-9\-_.]{1,128}$")


def _normalize_request_id(value: str | None) -> str:
    if value and _REQUEST_ID_PATTERN.fullmatch(value.strip()):
        return value.strip()
    return str(uuid.uuid4())


class RequestIdMiddleware:
    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        request = Request(scope, receive)
        request_id = _normalize_request_id(request.headers.get("X-Request-ID"))
        request.state.request_id = request_id
        set_request_id(request_id)

        async def send_with_request_id(message: Message) -> None:
            if message["type"] == "http.response.start":
                headers = MutableHeaders(scope=message)
                headers["X-Request-ID"] = request_id
            await send(message)

        try:
            await self.app(scope, receive, send_with_request_id)
        finally:
            set_request_id(None)
