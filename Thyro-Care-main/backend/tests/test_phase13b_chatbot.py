"""Phase 13B chatbot upgrades — hybrid retrieval, grounding, context, provider."""

from __future__ import annotations

import pytest
from app.content.multilingual_messages import detect_dominant_language
from app.core.config import get_settings
from app.models.chat import ChatMessageDocument
from app.models.enums import ChatMessageRole, KnowledgeStatus
from app.models.knowledge import KnowledgeChunkDocument
from app.services.conversation_context import build_conversation_context
from app.services.embedding_service import FakeEmbeddingProvider, cosine_similarity
from app.services.grounding_validation_service import (
    GroundingValidationService,
    RetrievedChunk,
)
from app.services.hybrid_retrieval_service import reciprocal_rank_fusion
from app.services.knowledge_retrieval_service import KnowledgeRetrievalService
from app.services.llm_provider import DisabledLLMProvider, FakeLLMProvider, get_llm_provider
from bson import ObjectId


@pytest.mark.asyncio
async def test_ai_disabled_provider_unavailable() -> None:
    provider = get_llm_provider("openai", assistant_enabled=False)
    assert provider.health_check() is False
    answer = await provider.generate_grounded_answer(
        user_message="hello",
        evidence=[],
        max_output_tokens=100,
    )
    assert answer.available is False


@pytest.mark.asyncio
async def test_fake_provider_cites_first_chunk() -> None:
    provider = FakeLLMProvider()
    evidence = [
        RetrievedChunk(
            chunk_id="c1",
            document_id="d1",
            title="Title",
            source_name="Org",
            source_url=None,
            document_version="1",
            text="Fatigue education content from approved source.",
            language="english",
            topic="recovery",
            review_status=KnowledgeStatus.APPROVED,
            score=1.0,
        )
    ]
    answer = await provider.generate_grounded_answer(
        user_message="fatigue?",
        evidence=evidence,
        max_output_tokens=128,
    )
    assert answer.available is True
    assert answer.citation_ids == ["c1"]


def test_unknown_provider_disabled() -> None:
    provider = get_llm_provider("unknown-cloud", assistant_enabled=True)
    assert isinstance(provider, DisabledLLMProvider)


def test_invented_citation_rejected() -> None:
    grounding = GroundingValidationService()
    evidence = [
        RetrievedChunk(
            chunk_id="real",
            document_id="d1",
            title="T",
            source_name="S",
            source_url=None,
            document_version="1",
            text="Approved text",
            language="english",
            topic="x",
            review_status=KnowledgeStatus.APPROVED,
            score=1.0,
        )
    ]
    result = grounding.validate(
        answer_text="Something [fake]",
        citation_ids=["fake"],
        retrieved=evidence,
        require_citation=True,
    )
    assert result.ok is False


def test_pending_citation_rejected() -> None:
    grounding = GroundingValidationService()
    evidence = [
        RetrievedChunk(
            chunk_id="p1",
            document_id="d1",
            title="T",
            source_name="S",
            source_url=None,
            document_version="1",
            text="Pending text",
            language="english",
            topic="x",
            review_status=KnowledgeStatus.PENDING_REVIEW,
            score=1.0,
            active=True,
        )
    ]
    result = grounding.validate(
        answer_text="claim",
        citation_ids=["p1"],
        retrieved=evidence,
    )
    assert result.ok is False


def test_context_bounded() -> None:
    msgs = [
        ChatMessageDocument(
            session_id=ObjectId(),
            user_id=ObjectId(),
            role=ChatMessageRole.USER,
            content=f"m{i}",
        )
        for i in range(20)
    ]
    ctx = build_conversation_context(msgs, max_messages=5)
    assert len(ctx) == 5
    assert ctx[0].content == "m15"


def test_deleted_messages_excluded_from_context() -> None:
    msgs = [
        ChatMessageDocument(
            session_id=ObjectId(),
            user_id=ObjectId(),
            role=ChatMessageRole.USER,
            content="keep",
        ),
        ChatMessageDocument(
            session_id=ObjectId(),
            user_id=ObjectId(),
            role=ChatMessageRole.USER,
            content="gone",
            is_deleted=True,
        ),
    ]
    ctx = build_conversation_context(msgs, max_messages=10)
    assert [c.content for c in ctx] == ["keep"]


def test_rrf_dedupes_chunks() -> None:
    a = RetrievedChunk(
        chunk_id="c1",
        document_id="d1",
        title="T",
        source_name="S",
        source_url=None,
        document_version="1",
        text="a",
        language="english",
        topic="t",
        review_status=KnowledgeStatus.APPROVED,
        score=0.9,
    )
    b = RetrievedChunk(
        chunk_id="c1",
        document_id="d1",
        title="T",
        source_name="S",
        source_url=None,
        document_version="1",
        text="a",
        language="english",
        topic="t",
        review_status=KnowledgeStatus.APPROVED,
        score=0.8,
    )
    fused = reciprocal_rank_fusion([[a], [b]], limit=5)
    assert len(fused) == 1
    assert fused[0].chunk_id == "c1"


@pytest.mark.asyncio
async def test_fake_embeddings_deterministic() -> None:
    provider = FakeEmbeddingProvider(dimensions=16)
    v1 = (await provider.embed_texts(["hello world"]))[0]
    v2 = (await provider.embed_texts(["hello world"]))[0]
    assert v1 == v2
    assert cosine_similarity(v1, v2) > 0.99


def test_lexical_still_works() -> None:
    service = KnowledgeRetrievalService()
    chunk = KnowledgeChunkDocument(
        document_id="doc1",
        mongo_document_id=ObjectId(),
        version_id="v1",
        chunk_id="chunk-1",
        chunk_index=0,
        document_version="1",
        content_hash="abc12345",
        text="Low iodine diet education for thyroid cancer survivors",
        topic="diet",
        language="english",
        source_title="Diet Guide",
        source_name="ThyroCare",
        source_url=None,
        review_status=KnowledgeStatus.APPROVED,
        active=True,
    )
    hits = service.retrieve("low iodine diet", [chunk], max_chunks=3, min_score=0.1)
    assert hits and hits[0].chunk_id == "chunk-1"


def test_language_detection_sinhala() -> None:
    assert detect_dominant_language("මට උදව් කරන්න කරුණාකර") == "si"
    assert detect_dominant_language("What is fatigue education?") == "en"


def test_openai_store_responses_default_false() -> None:
    get_settings.cache_clear()
    settings = get_settings()
    assert settings.openai_store_responses is False
