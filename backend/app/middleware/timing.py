"""Request timing middleware (pure ASGI)."""

from __future__ import annotations

import time

from starlette.datastructures import MutableHeaders
from starlette.requests import Request
from starlette.types import ASGIApp, Message, Receive, Scope, Send

from app.core.logging import get_logger

logger = get_logger(__name__)


class TimingMiddleware:
    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        request = Request(scope, receive)
        started = time.perf_counter()
        status_code = 500

        async def send_with_timing(message: Message) -> None:
            nonlocal status_code
            if message["type"] == "http.response.start":
                status_code = int(message.get("status", 500))
                duration = time.perf_counter() - started
                headers = MutableHeaders(scope=message)
                headers["X-Process-Time"] = f"{duration:.4f}"
                logger.info(
                    "%s %s -> %s (%.4fs)",
                    request.method,
                    request.url.path,
                    status_code,
                    duration,
                )
            await send(message)

        await self.app(scope, receive, send_with_timing)
