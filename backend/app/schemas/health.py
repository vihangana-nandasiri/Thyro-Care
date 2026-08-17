from typing import Literal

from pydantic import BaseModel, Field

from app.utils.datetime import utc_isoformat

HealthStatus = Literal["healthy", "degraded", "unhealthy"]
DatabaseStatus = Literal["connected", "disconnected", "unknown"]


class HealthResponse(BaseModel):
    status: HealthStatus
    service: str
    version: str
    environment: str
    timestamp: str = Field(default_factory=utc_isoformat)
    database_status: DatabaseStatus = "unknown"
    uptime_seconds: float = 0.0
