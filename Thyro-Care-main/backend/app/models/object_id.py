"""BSON ObjectId helpers compatible with Pydantic v2."""

from __future__ import annotations

from typing import Any

from bson import ObjectId
from bson.errors import InvalidId
from pydantic import GetCoreSchemaHandler, GetJsonSchemaHandler
from pydantic.json_schema import JsonSchemaValue
from pydantic_core import core_schema

from app.core.exceptions import ValidationException


class PyObjectId(ObjectId):
    """ObjectId subclass with Pydantic v2 schema support."""

    @classmethod
    def __get_pydantic_core_schema__(
        cls,
        _source_type: Any,
        _handler: GetCoreSchemaHandler,
    ) -> core_schema.CoreSchema:
        def validate(value: Any) -> ObjectId:
            if isinstance(value, ObjectId):
                return ObjectId(value)
            if isinstance(value, str) and ObjectId.is_valid(value):
                return ObjectId(value)
            raise ValueError("Invalid ObjectId")

        return core_schema.no_info_plain_validator_function(
            validate,
            serialization=core_schema.to_string_ser_schema(),
        )

    @classmethod
    def __get_pydantic_json_schema__(
        cls,
        _core_schema: core_schema.CoreSchema,
        _handler: GetJsonSchemaHandler,
    ) -> JsonSchemaValue:
        return {"type": "string", "examples": ["507f1f77bcf86cd799439011"]}


def to_object_id(value: ObjectId | str) -> ObjectId:
    """Convert a string or ObjectId to ObjectId; raise ValidationException on failure."""
    if isinstance(value, ObjectId):
        return ObjectId(value)
    try:
        return ObjectId(str(value))
    except (InvalidId, TypeError, ValueError) as exc:
        raise ValidationException(
            "Invalid identifier",
            details=[{"loc": ["id"], "msg": "Invalid ObjectId", "type": "object_id"}],
        ) from exc


def object_id_to_string(value: ObjectId | str) -> str:
    return str(value)


def new_object_id() -> ObjectId:
    return ObjectId()
