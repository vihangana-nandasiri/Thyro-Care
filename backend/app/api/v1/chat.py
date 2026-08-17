"""Patient chat API routes."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Query, Request, status
from fastapi.responses import StreamingResponse

from app.api.dependencies import DatabaseDep, require_patient
from app.content.assistant_policy import ASSISTANT_DISCLAIMER
from app.core.config import get_settings
from app.core.exceptions import NotFoundException
from app.core.rate_limit import limiter
from app.models.user import UserDocument
from app.repositories.knowledge_repository import KnowledgeRepository
from app.schemas.chat import (
    ChatAssistantResponse,
    ChatExportResponse,
    ChatFeedbackPublic,
    ChatFeedbackRequest,
    ChatMessageCreate,
    ChatSessionCreate,
    ChatSessionDetail,
    ChatSessionListResponse,
    ChatSessionPublic,
    ChatSessionUpdate,
    KnowledgeSourcePublic,
    MessageResponse,
)
from app.services.chat_feedback_service import ChatFeedbackService
from app.services.chat_service import ChatService

router = APIRouter(prefix="/chat", tags=["chat"])
knowledge_router = APIRouter(prefix="/knowledge", tags=["knowledge"])

CurrentPatient = Annotated[UserDocument, Depends(require_patient)]


def get_chat_service(database: DatabaseDep) -> ChatService:
    return ChatService(database)


def get_feedback_service(database: DatabaseDep) -> ChatFeedbackService:
    return ChatFeedbackService(database)


ChatServiceDep = Annotated[ChatService, Depends(get_chat_service)]
FeedbackServiceDep = Annotated[ChatFeedbackService, Depends(get_feedback_service)]

_DISCLAIMER = ASSISTANT_DISCLAIMER + (
    " Answers use approved educational sources only. "
    "Free-text chat is not an emergency classifier — use the structured safety check."
)


def _chat_limit() -> str:
    return get_settings().chat_rate_limit


@router.get(
    "/sessions",
    response_model=ChatSessionListResponse,
    summary="List my chat sessions",
    description=_DISCLAIMER,
)
async def list_sessions(
    user: CurrentPatient,
    service: ChatServiceDep,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
) -> ChatSessionListResponse:
    return await service.list_sessions(user, page=page, page_size=page_size)


@router.post(
    "/sessions",
    response_model=ChatSessionPublic,
    status_code=status.HTTP_201_CREATED,
    summary="Create chat session",
    description=_DISCLAIMER,
)
async def create_session(
    payload: ChatSessionCreate,
    user: CurrentPatient,
    service: ChatServiceDep,
) -> ChatSessionPublic:
    return await service.create_session(user, payload)


@router.get(
    "/sessions/{session_id}",
    response_model=ChatSessionDetail,
    summary="Get chat session with messages",
    description=_DISCLAIMER,
)
async def get_session(
    session_id: str,
    user: CurrentPatient,
    service: ChatServiceDep,
) -> ChatSessionDetail:
    return await service.get_session(user, session_id)


@router.patch(
    "/sessions/{session_id}",
    response_model=ChatSessionPublic,
    summary="Update chat session title",
    description=_DISCLAIMER,
)
async def update_session(
    session_id: str,
    payload: ChatSessionUpdate,
    user: CurrentPatient,
    service: ChatServiceDep,
) -> ChatSessionPublic:
    return await service.update_session_title(user, session_id, payload)


@router.delete(
    "/sessions/{session_id}",
    response_model=MessageResponse,
    summary="Soft-delete chat session",
    description=_DISCLAIMER,
)
async def delete_session(
    session_id: str,
    user: CurrentPatient,
    service: ChatServiceDep,
) -> MessageResponse:
    return await service.delete_session(user, session_id)


@router.delete(
    "/sessions",
    response_model=MessageResponse,
    summary="Soft-delete all my chat sessions",
    description=_DISCLAIMER,
)
async def delete_all_sessions(
    user: CurrentPatient,
    service: ChatServiceDep,
) -> MessageResponse:
    return await service.delete_all_sessions(user)


@router.get(
    "/export",
    response_model=ChatExportResponse,
    summary="Export my conversations",
    description=_DISCLAIMER,
)
async def export_conversations(
    user: CurrentPatient,
    service: ChatServiceDep,
) -> ChatExportResponse:
    return await service.export_conversations(user)


@router.post(
    "/sessions/{session_id}/messages",
    response_model=ChatAssistantResponse,
    summary="Send chat message",
    description=_DISCLAIMER,
)
@limiter.limit(_chat_limit)
async def send_message(
    request: Request,
    session_id: str,
    payload: ChatMessageCreate,
    user: CurrentPatient,
    service: ChatServiceDep,
) -> ChatAssistantResponse:
    _ = request
    return await service.send_message(user, session_id, payload.content)


@router.post(
    "/sessions/{session_id}/messages/stream",
    summary="Send chat message (SSE stream)",
    description=_DISCLAIMER,
)
@limiter.limit(_chat_limit)
async def send_message_stream(
    request: Request,
    session_id: str,
    payload: ChatMessageCreate,
    user: CurrentPatient,
    service: ChatServiceDep,
) -> StreamingResponse:
    _ = request
    settings = get_settings()
    if not settings.chat_streaming_enabled:

        async def _disabled():
            yield (
                "event: response.error\n"
                'data: {"message":"Streaming is disabled. Use the standard message endpoint."}\n\n'
            )

        return StreamingResponse(_disabled(), media_type="text/event-stream")

    async def event_generator():
        async for chunk in service.stream_message_events(user, session_id, payload.content):
            if await request.is_disconnected():
                break
            yield chunk

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@router.post(
    "/messages/{assistant_message_id}/feedback",
    response_model=ChatFeedbackPublic,
    summary="Rate an assistant message",
)
async def upsert_feedback(
    assistant_message_id: str,
    payload: ChatFeedbackRequest,
    user: CurrentPatient,
    service: FeedbackServiceDep,
) -> ChatFeedbackPublic:
    return await service.upsert_feedback(user, assistant_message_id, payload)


@router.delete(
    "/messages/{assistant_message_id}/feedback",
    response_model=MessageResponse,
    summary="Remove feedback for an assistant message",
)
async def delete_feedback(
    assistant_message_id: str,
    user: CurrentPatient,
    service: FeedbackServiceDep,
) -> MessageResponse:
    return await service.delete_feedback(user, assistant_message_id)


@knowledge_router.get(
    "/sources/{document_id}",
    response_model=KnowledgeSourcePublic,
    summary="Get approved knowledge source metadata",
    description="Approved public metadata only. Draft/pending content is not exposed.",
)
async def get_knowledge_source(
    document_id: str,
    user: CurrentPatient,
    database: DatabaseDep,
) -> KnowledgeSourcePublic:
    _ = user
    repo = KnowledgeRepository(database)
    doc = await repo.get_approved_source_by_id(document_id)
    if doc is None:
        raise NotFoundException("This resource is no longer available.")
    return KnowledgeSourcePublic(
        document_id=doc.document_id,
        title=doc.title,
        source_name=doc.source_name,
        source_url=doc.source_url,
        topic=doc.topic,
        language=doc.language,
        version=doc.content_version,
        medical_disclaimer=doc.medical_disclaimer,
    )
