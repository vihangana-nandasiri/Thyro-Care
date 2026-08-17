"""Unit tests for database dependency unavailability."""

from __future__ import annotations

import pytest
from app.api.dependencies import get_database
from app.core.exceptions import ServiceUnavailableException
from app.db import mongodb as mongodb_module


def test_get_database_raises_when_unavailable(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(mongodb_module, "get_database", lambda: None)
    # dependencies.get_database calls get_mongo_database from mongodb module at import;
    # patch the symbol used inside dependencies.
    import app.api.dependencies as deps

    monkeypatch.setattr(deps, "get_mongo_database", lambda: None)
    with pytest.raises(ServiceUnavailableException):
        get_database()
