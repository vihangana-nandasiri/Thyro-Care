"""ObjectId helper unit tests."""

from __future__ import annotations

import pytest
from app.core.exceptions import ValidationException
from app.models.object_id import (
    PyObjectId,
    object_id_to_string,
    to_object_id,
)
from bson import ObjectId
from pydantic import BaseModel, ValidationError


class _IdModel(BaseModel):
    id: PyObjectId


def test_valid_object_id_conversion() -> None:
    oid = ObjectId()
    assert to_object_id(oid) == oid
    assert to_object_id(str(oid)) == oid


def test_invalid_object_id_rejection() -> None:
    with pytest.raises(ValidationException):
        to_object_id("not-an-object-id")


def test_api_safe_object_id_serialization() -> None:
    oid = ObjectId()
    model = _IdModel(id=oid)
    payload = model.model_dump(mode="json")
    assert payload["id"] == str(oid)
    assert object_id_to_string(oid) == str(oid)


def test_pydantic_rejects_invalid_object_id() -> None:
    with pytest.raises(ValidationError):
        _IdModel(id="bad")
