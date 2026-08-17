"""Shared SlowAPI limiter (in-memory; not multi-instance safe)."""

from __future__ import annotations

from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address, default_limits=[], enabled=False)


def configure_limiter(*, enabled: bool, default_limit: str) -> Limiter:
    """Apply settings to the shared limiter instance used by middleware and routes."""
    del default_limit  # Per-route auth limits come from settings callables.
    limiter.enabled = enabled
    return limiter
