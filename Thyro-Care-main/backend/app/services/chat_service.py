"""Safe chat orchestration service (Phase 13B hybrid RAG)."""

from __future__ import annotations

import json
from collections.abc import AsyncIterator

from pymongo.asynchronous.database import AsyncDatabase

from app.content.assistant_policy import (
    ASSISTANT_DISCLAIMER,
    INSUFFICIENT_EVIDENCE_MESSAGE,
    PROMPT_VERSION,
    PROVIDER_UNAVAILABLE_MESSAGE,
    RETRIEVAL_VERSION,
)
from app.content.multilingual_messages import detect_dominant_language, localized_message
from app.core.config import get_settings
from app.core.exceptions import NotFoundException
from app.models.chat import ChatMessageDocument, ChatSessionDocument
from app.models.enums import ChatMessageRole, ChatResponseMode, ChatSessionStatus
from app.models.object_id import object_id_to_string
from app.models.user import UserDocument
from app.repositories.chat_repository import ChatMessageRepository, ChatSessionRepository
from app.repositories.exceptions import RepositoryNotFoundError
from app.repositories.knowledge_chunk_embedding_repository import (
    KnowledgeChunkEmbeddingRepository,
)
from app.repositories.knowledge_repository import KnowledgeRepository
from app.schemas.chat import (
    ChatAssistantResponse,
    ChatCitationPublic,
    ChatExportResponse,
    ChatMessagePublic,
    ChatSessionCreate,
    ChatSessionDetail,
    ChatSessionListResponse,
    ChatSessionPublic,
    ChatSessionUpdate,
    MessageResponse,
)
from app.services.audit_service import AuditActions, AuditService
from app.services.chat_safety_policy_service import ChatSafetyPolicyService
from app.services.conversation_context import build_conversation_context
from app.services.embedding_service import get_embedding_provider
from app.services.grounding_validation_service import GroundingValidationService
from app.services.hybrid_retrieval_service import HybridRetrievalService
from app.services.knowledge_retrieval_service import KnowledgeRetrievalService
from app.services.llm_provider import get_llm_provider
from app.services.prompt_security_service import PromptSecurityService, normalize_user_text
from app.utils.datetime import utc_now

_NOT_FOUND = "This chat session is no longer available."


def _session_public(doc: ChatSessionDocument) -> ChatSessionPublic:
    return ChatSessionPublic(
        id=object_id_to_string(doc.id),
        title=doc.title,
        status=doc.status,
        created_at=doc.created_at,
        updated_at=doc.updated_at,
        last_message_at=doc.last_message_at,
        version=doc.version,
    )


def _citations_from_stored(raw: list) -> list[ChatCitationPublic]:
    out: list[ChatCitationPublic] = []
    for item in raw:
        if not isinstance(item, dict):
            continue
        try:
            out.append(ChatCitationPublic.model_validate(item))
        except Exception:
            continue
    return out


def _message_public(doc: ChatMessageDocument) -> ChatMessagePublic:
    return ChatMessagePublic(
        id=object_id_to_string(doc.id),
        role=doc.role,
        content=doc.content,
        response_mode=doc.response_mode,
        citations=_citations_from_stored(doc.source_citations),
        safety_notice=doc.safety_notice,
        created_at=doc.created_at,
    )


class ChatService:
    def __init__(self, database: AsyncDatabase) -> None:
        self.sessions = ChatSessionRepository(database)
        self.messages = ChatMessageRepository(database)
        self.knowledge = KnowledgeRepository(database)
        self.audit = AuditService(database)
        self.prompt_security = PromptSecurityService()
        self.safety_policy = ChatSafetyPolicyService()
        self.lexical = KnowledgeRetrievalService()
        self.grounding = GroundingValidationService()
        settings = get_settings()
        self.provider = get_llm_provider(
            settings.llm_provider,
            assistant_enabled=settings.ai_assistant_enabled,
            settings=settings,
        )
        self.settings = settings
        self.embeddings = KnowledgeChunkEmbeddingRepository(database)
        self.hybrid = HybridRetrievalService(
            lexical=self.lexical,
            embeddings=self.embeddings,
            embedding_provider=get_embedding_provider(settings),
            settings=settings,
        )

    async def create_session(
        self, user: UserDocument, payload: ChatSessionCreate
    ) -> ChatSessionPublic:
        title = (payload.title or "Conversation").strip() or "Conversation"
        doc = ChatSessionDocument(
            user_id=user.id,
            title=title[:200],
            status=ChatSessionStatus.ACTIVE,
            version=1,
        )
        created = await self.sessions.create_for_user(doc)
        await self.audit.record(
            AuditActions.CHAT_SESSION_CREATED,
            actor_user_id=user.id,
            entity_type="chat_session",
            entity_id=created.id,
            changes_summary="session_created=true",
        )
        return _session_public(created)

    async def list_sessions(
        self, user: UserDocument, *, page: int = 1, page_size: int = 20
    ) -> ChatSessionListResponse:
        items = await self.sessions.list_for_user(user.id, page=page, page_size=page_size)
        total = len(items) if page == 1 and len(items) < page_size else page * page_size
        return ChatSessionListResponse(
            items=[_session_public(i) for i in items],
            page=page,
            page_size=page_size,
            total=total,
        )

    async def get_session(self, user: UserDocument, session_id: str) -> ChatSessionDetail:
        session = await self.sessions.get_owned_by_id(session_id, user.id)
        if session is None:
            raise NotFoundException(_NOT_FOUND)
        messages = await self.messages.list_for_owned_session(
            session_id,
            user.id,
            page=1,
            page_size=self.settings.chat_max_history_messages,
        )
        return ChatSessionDetail(
            session=_session_public(session),
            messages=[_message_public(m) for m in messages],
        )

    async def update_session_title(
        self, user: UserDocument, session_id: str, payload: ChatSessionUpdate
    ) -> ChatSessionPublic:
        try:
            updated = await self.sessions.update_owned(
                session_id, user.id, {"title": payload.title.strip()}
            )
        except RepositoryNotFoundError as exc:
            raise NotFoundException(_NOT_FOUND) from exc
        return _session_public(updated)

    async def delete_session(self, user: UserDocument, session_id: str) -> MessageResponse:
        try:
            deleted = await self.sessions.soft_delete_owned(session_id, user.id)
            await self.messages.soft_delete_for_session(session_id, user.id)
        except RepositoryNotFoundError as exc:
            raise NotFoundException(_NOT_FOUND) from exc
        await self.audit.record(
            AuditActions.CHAT_SESSION_DELETED,
            actor_user_id=user.id,
            entity_type="chat_session",
            entity_id=deleted.id,
            changes_summary="soft_deleted=true",
        )
        return MessageResponse(message="Chat session deleted")

    async def delete_all_sessions(self, user: UserDocument) -> MessageResponse:
        listed = await self.sessions.list_for_user(user.id, page=1, page_size=100)
        for session in listed:
            await self.delete_session(user, object_id_to_string(session.id))
        return MessageResponse(message="All chat sessions deleted")

    async def export_conversations(self, user: UserDocument) -> ChatExportResponse:
        listed = await self.sessions.list_for_user(user.id, page=1, page_size=100)
        details: list[ChatSessionDetail] = []
        for session in listed:
            detail = await self.get_session(user, object_id_to_string(session.id))
            details.append(detail)
        return ChatExportResponse(exported_at=utc_now(), sessions=details)

    async def send_message(
        self, user: UserDocument, session_id: str, content: str
    ) -> ChatAssistantResponse:
        return await self._generate(user, session_id, content)

    async def stream_message_events(
        self, user: UserDocument, session_id: str, content: str
    ) -> AsyncIterator[str]:
        """Yield SSE event lines. Persists only the final validated answer."""
        yield _sse("message.accepted", {"ok": True})
        result = await self._generate(user, session_id, content)
        # Stream final answer as deltas for progressive UX without exposing unvalidated text early.
        text = result.assistant_message.content
        chunk_size = 48
        for i in range(0, len(text), chunk_size):
            yield _sse("response.delta", {"text": text[i : i + chunk_size]})
        if result.response_mode in {
            ChatResponseMode.POLICY_REFUSAL,
            ChatResponseMode.SAFETY_REDIRECT,
            ChatResponseMode.PROVIDER_UNAVAILABLE,
            ChatResponseMode.INSUFFICIENT_EVIDENCE,
        }:
            yield _sse(
                "response.refused",
                {
                    "response_mode": result.response_mode.value,
                    "message": result.assistant_message.content[:300],
                },
            )
        yield _sse("response.completed", json.loads(result.model_dump_json()))

    async def _generate(
        self, user: UserDocument, session_id: str, content: str
    ) -> ChatAssistantResponse:
        session = await self.sessions.get_owned_by_id(session_id, user.id)
        if session is None:
            raise NotFoundException(_NOT_FOUND)

        max_len = self.settings.chat_max_message_length
        ok, refusal, mode = self.prompt_security.evaluate(content, max_length=max_len)
        normalized = normalize_user_text(content, max_length=max_len)
        language = detect_dominant_language(normalized)

        await self.audit.record(
            AuditActions.CHAT_MESSAGE_SUBMITTED,
            actor_user_id=user.id,
            entity_type="chat_session",
            entity_id=session.id,
            changes_summary=f"message_len={len(normalized)}",
        )

        if not ok and mode is not None and refusal:
            return await self._finalize(
                user=user,
                session=session,
                user_text=normalized or content[:max_len],
                assistant_text=localized_message(
                    "policy_refusal", language=language, english_fallback=refusal
                ),
                mode=mode,
                citations=[],
                safety_notice=ASSISTANT_DISCLAIMER,
                audit_action=AuditActions.CHAT_POLICY_REFUSAL,
            )

        pre_mode, pre_msg, pre_notice = self.safety_policy.pre_check(normalized)
        if pre_mode is not None and pre_msg:
            key = "emergency" if pre_mode == ChatResponseMode.SAFETY_REDIRECT else "policy_refusal"
            action = (
                AuditActions.CHAT_SAFETY_REDIRECT
                if pre_mode == ChatResponseMode.SAFETY_REDIRECT
                else AuditActions.CHAT_POLICY_REFUSAL
            )
            return await self._finalize(
                user=user,
                session=session,
                user_text=normalized,
                assistant_text=localized_message(key, language=language, english_fallback=pre_msg),
                mode=pre_mode,
                citations=[],
                safety_notice=pre_notice,
                audit_action=action,
            )

        history = await self.messages.list_for_owned_session(
            session_id,
            user.id,
            page=1,
            page_size=self.settings.chat_max_history_messages,
        )
        context = build_conversation_context(
            history,
            max_messages=self.settings.chat_context_max_messages,
        )

        chunks = await self.knowledge.list_approved_chunks(limit=500)
        evidence, retrieval_mode = await self.hybrid.retrieve(normalized, chunks)

        if not evidence:
            return await self._finalize(
                user=user,
                session=session,
                user_text=normalized,
                assistant_text=localized_message(
                    "insufficient_evidence",
                    language=language,
                    english_fallback=INSUFFICIENT_EVIDENCE_MESSAGE,
                ),
                mode=ChatResponseMode.INSUFFICIENT_EVIDENCE,
                citations=[],
                safety_notice=ASSISTANT_DISCLAIMER,
                audit_action=AuditActions.CHAT_INSUFFICIENT_EVIDENCE,
                retrieval_mode=retrieval_mode,
            )

        if not self.provider.health_check():
            return await self._finalize(
                user=user,
                session=session,
                user_text=normalized,
                assistant_text=localized_message(
                    "provider_unavailable",
                    language=language,
                    english_fallback=PROVIDER_UNAVAILABLE_MESSAGE,
                ),
                mode=ChatResponseMode.PROVIDER_UNAVAILABLE,
                citations=[],
                safety_notice=ASSISTANT_DISCLAIMER,
                audit_action=AuditActions.CHAT_RESPONSE_GENERATED,
                provider="disabled",
                retrieval_mode=retrieval_mode,
            )

        answer = await self.provider.generate_grounded_answer(
            user_message=normalized,
            evidence=evidence,
            max_output_tokens=self.settings.llm_max_output_tokens,
            conversation_context=context,
            language=language,
        )
        if not answer.available:
            return await self._finalize(
                user=user,
                session=session,
                user_text=normalized,
                assistant_text=localized_message(
                    "provider_unavailable",
                    language=language,
                    english_fallback=PROVIDER_UNAVAILABLE_MESSAGE,
                ),
                mode=ChatResponseMode.PROVIDER_UNAVAILABLE,
                citations=[],
                safety_notice=ASSISTANT_DISCLAIMER,
                audit_action=AuditActions.CHAT_RESPONSE_GENERATED,
                provider=answer.provider,
                retrieval_mode=retrieval_mode,
            )

        grounding = self.grounding.validate(
            answer_text=answer.text,
            citation_ids=answer.citation_ids,
            retrieved=evidence,
            require_citation=True,
        )
        if not grounding.ok:
            await self.audit.record(
                AuditActions.CHAT_CITATION_VALIDATION_FAILED,
                actor_user_id=user.id,
                entity_type="chat_session",
                entity_id=session.id,
                changes_summary="grounding_failed=true",
            )
            return await self._finalize(
                user=user,
                session=session,
                user_text=normalized,
                assistant_text=grounding.message
                or localized_message(
                    "insufficient_evidence",
                    language=language,
                    english_fallback=INSUFFICIENT_EVIDENCE_MESSAGE,
                ),
                mode=grounding.mode or ChatResponseMode.INSUFFICIENT_EVIDENCE,
                citations=[],
                safety_notice=ASSISTANT_DISCLAIMER,
                audit_action=AuditActions.CHAT_INSUFFICIENT_EVIDENCE,
                provider=answer.provider,
                retrieval_mode=retrieval_mode,
            )

        post_ok, replacement = self.safety_policy.post_check(answer.text)
        if not post_ok:
            return await self._finalize(
                user=user,
                session=session,
                user_text=normalized,
                assistant_text=replacement
                or localized_message(
                    "policy_refusal",
                    language=language,
                    english_fallback=INSUFFICIENT_EVIDENCE_MESSAGE,
                ),
                mode=ChatResponseMode.POLICY_REFUSAL,
                citations=[],
                safety_notice=ASSISTANT_DISCLAIMER,
                audit_action=AuditActions.CHAT_POLICY_REFUSAL,
                provider=answer.provider,
                retrieval_mode=retrieval_mode,
            )

        coverage = (
            answer.evidence_coverage.value if answer.evidence_coverage is not None else "high"
        )
        return await self._finalize(
            user=user,
            session=session,
            user_text=normalized,
            assistant_text=answer.text,
            mode=ChatResponseMode.GROUNDED_ANSWER,
            citations=grounding.citations,
            safety_notice=ASSISTANT_DISCLAIMER,
            audit_action=AuditActions.CHAT_RESPONSE_GENERATED,
            provider=answer.provider,
            model_name=answer.model_name,
            evidence_coverage=coverage,
            follow_up_suggestions=list(answer.follow_up_suggestions),
            retrieval_mode=retrieval_mode,
        )

    async def _finalize(
        self,
        *,
        user: UserDocument,
        session: ChatSessionDocument,
        user_text: str,
        assistant_text: str,
        mode: ChatResponseMode,
        citations: list,
        safety_notice: str | None,
        audit_action: str,
        provider: str | None = None,
        model_name: str | None = None,
        evidence_coverage: str | None = None,
        follow_up_suggestions: list[str] | None = None,
        retrieval_mode: str | None = None,
    ) -> ChatAssistantResponse:
        now = utc_now()
        prompt_version = self.settings.prompt_version or PROMPT_VERSION
        retrieval_version = self.settings.retrieval_version or RETRIEVAL_VERSION
        user_msg = await self.messages.create_for_user_session(
            ChatMessageDocument(
                session_id=session.id,
                user_id=user.id,
                role=ChatMessageRole.USER,
                content=user_text,
            )
        )
        assistant_msg = await self.messages.create_for_user_session(
            ChatMessageDocument(
                session_id=session.id,
                user_id=user.id,
                role=ChatMessageRole.ASSISTANT,
                content=assistant_text,
                response_mode=mode,
                source_citations=list(citations),
                safety_notice=safety_notice,
                model_provider=provider,
                model_name=model_name,
                prompt_version=prompt_version,
                retrieval_version=retrieval_version,
                fallback_used=mode
                in {
                    ChatResponseMode.INSUFFICIENT_EVIDENCE,
                    ChatResponseMode.PROVIDER_UNAVAILABLE,
                    ChatResponseMode.POLICY_REFUSAL,
                    ChatResponseMode.SAFETY_REDIRECT,
                },
                emergency_detected=mode == ChatResponseMode.SAFETY_REDIRECT,
            )
        )
        await self.sessions.update_owned(
            object_id_to_string(session.id),
            user.id,
            {
                "last_message_at": now,
                "message_count": session.message_count + 2,
            },
        )
        await self.audit.record(
            audit_action,
            actor_user_id=user.id,
            entity_type="chat_session",
            entity_id=session.id,
            changes_summary=(
                f"mode={mode.value};citations={len(citations)};"
                f"prompt={prompt_version};retrieval={retrieval_version};"
                f"provider={provider or 'none'};retrieval_mode={retrieval_mode or 'n/a'}"
            ),
        )
        pub_citations = [ChatCitationPublic.model_validate(c) for c in citations]
        return ChatAssistantResponse(
            user_message=_message_public(user_msg),
            assistant_message=_message_public(assistant_msg),
            response_mode=mode,
            citations=pub_citations,
            safety_notice=safety_notice,
            safety_check_url="/symptoms",
            emergency_page_url="/emergency",
            disclaimer=ASSISTANT_DISCLAIMER,
            evidence_coverage=evidence_coverage,
            follow_up_suggestions=follow_up_suggestions or [],
            retrieval_mode=retrieval_mode,
        )


def _sse(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data, default=str)}\n\n"
