from __future__ import annotations

from typing import Generic, TypeVar

from pydantic import BaseModel, Field

from app.utils.datetime import utc_isoformat

T = TypeVar("T")


class ErrorDetail(BaseModel):
    loc: list[str] = Field(default_factory=list)
    msg: str
    type: str = "error"


class ValidationErrorDetail(ErrorDetail):
    type: str = "validation_error"


class ApiErrorResponse(BaseModel):
    success: bool = False
    message: str
    code: str = "error"
    details: list[ErrorDetail] = Field(default_factory=list)
    request_id: str | None = None
    timestamp: str = Field(default_factory=utc_isoformat)


class ApiSuccessResponse(BaseModel, Generic[T]):
    success: bool = True
    message: str = "OK"
    data: T | None = None
    request_id: str | None = None
    timestamp: str = Field(default_factory=utc_isoformat)


class PaginationMeta(BaseModel):
    page: int
    page_size: int
    total: int
    has_more: bool


class PaginatedResponse(BaseModel, Generic[T]):
    success: bool = True
    message: str = "OK"
    data: list[T] = Field(default_factory=list)
    meta: PaginationMeta
    request_id: str | None = None
    timestamp: str = Field(default_factory=utc_isoformat)
