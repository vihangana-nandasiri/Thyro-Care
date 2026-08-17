"""Repository-layer exceptions (mapped from PyMongo errors)."""

from __future__ import annotations

from app.core.exceptions import (
    AppException,
    ConflictException,
    NotFoundException,
    ServiceUnavailableException,
    ValidationException,
)


class RepositoryError(AppException):
    def __init__(self, message: str = "Repository error") -> None:
        super().__init__(message, code="repository_error", status_code=500)


class RepositoryNotFoundError(NotFoundException):
    def __init__(self, message: str = "Resource not found") -> None:
        super().__init__(message)


class RepositoryConflictError(ConflictException):
    def __init__(self, message: str = "Resource conflict") -> None:
        super().__init__(message)


class RepositoryValidationError(ValidationException):
    def __init__(self, message: str = "Invalid repository input") -> None:
        super().__init__(message)


class RepositoryUnavailableError(ServiceUnavailableException):
    def __init__(self, message: str = "Database temporarily unavailable") -> None:
        super().__init__(message)
