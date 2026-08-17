"""Chat response feedback service."""

from __future__ import annotations

from pymongo.asynchronous.database import AsyncDatabase
from pymongo.errors import DuplicateKeyError

from app.core.exceptions import ForbiddenException, NotFoundException, ValidationException
from app.models.chat_feedback import ChatResponseFeedbackDocument
from app.models.enums import ChatMessageRole
from app.models.object_id import object_id_to_string
from app.models.user import UserDocument
from app.repositories.chat_feedback_repository import ChatResponseFeedbackRepository
from app.repositories.chat_repository import ChatMessageRepository, ChatSessionRepository
from app.schemas.chat import ChatFeedbackPublic, ChatFeedbackRequest, MessageResponse
from app.services.audit_service import AuditActions, AuditService
from app.utils.datetime import utc_now


class ChatFeedbackService:
    def __init__(self, database: AsyncDatabase) -> None:
        self.feedback = ChatResponseFeedbackRepository(database)
        self.messages = ChatMessageRepository(database)
        self.sessions = ChatSessionRepository(database)
        self.audit = AuditService(database)

    async def upsert_feedback(
        self,
        user: UserDocument,
        assistant_message_id: str,
        payload: ChatFeedbackRequest,
    ) -> ChatFeedbackPublic:
        message = await self.messages.get_by_id(assistant_message_id)
        if message is None or message.is_deleted:
            raise NotFoundException("Message not found")
        if message.user_id != user.id:
            raise ForbiddenException("Not allowed")
        if message.role != ChatMessageRole.ASSISTANT:
            raise ValidationException("Feedback is only allowed on assistant messages")

        existing = await self.feedback.find_active_for_user_message(user.id, message.id)
        now = utc_now()
        if existing is not None:
            updated = await self.feedback.update_one(
                existing.id,
                {
                    "rating": payload.rating.value,
                    "reason_code": payload.reason_code.value if payload.reason_code else None,
                    "comment": payload.comment,
                    "updated_at": now,
                },
            )
            doc = updated or existing
        else:
            doc = ChatResponseFeedbackDocument(
                user_id=user.id,
                session_id=message.session_id,
                assistant_message_id=message.id,
                rating=payload.rating,
                reason_code=payload.reason_code,
                comment=payload.comment,
                response_mode=message.response_mode.value if message.response_mode else None,
                prompt_version=message.prompt_version,
                retrieval_version=message.retrieval_version,
                provider=message.model_provider,
                model_name=message.model_name,
            )
            try:
                doc = await self.feedback.insert_one(doc)
            except DuplicateKeyError:
                existing = await self.feedback.find_active_for_user_message(user.id, message.id)
                if existing is None:
                    raise
                doc = existing

        await self.audit.record(
            AuditActions.CHAT_FEEDBACK_RECORDED,
            actor_user_id=user.id,
            entity_type="chat_message",
            entity_id=message.id,
            changes_summary=f"rating={payload.rating.value}",
        )
        return ChatFeedbackPublic(
            id=object_id_to_string(doc.id),
            assistant_message_id=object_id_to_string(message.id),
            rating=doc.rating,
            reason_code=doc.reason_code,
            comment=doc.comment,
            created_at=doc.created_at,
            updated_at=doc.updated_at,
        )

    async def delete_feedback(
        self, user: UserDocument, assistant_message_id: str
    ) -> MessageResponse:
        message = await self.messages.get_by_id(assistant_message_id)
        if message is None or message.user_id != user.id:
            raise NotFoundException("Message not found")
        existing = await self.feedback.find_active_for_user_message(user.id, message.id)
        if existing is None:
            return MessageResponse(message="Feedback removed")
        await self.feedback.soft_delete(existing.id, deleted_by=user.id)
        return MessageResponse(message="Feedback removed")
