"""API v1 router aggregator."""

from fastapi import APIRouter

from app.api.v1 import (
    appointments,
    auth,
    chat,
    health,
    knowledge_governance,
    medications,
    profiles,
    symptoms,
)

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(auth.router)
api_router.include_router(profiles.router)
api_router.include_router(medications.router)
api_router.include_router(appointments.router)
api_router.include_router(symptoms.router)
api_router.include_router(chat.router)
api_router.include_router(chat.knowledge_router)
api_router.include_router(knowledge_governance.router)
