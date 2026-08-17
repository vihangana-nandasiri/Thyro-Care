"""Deterministic lexical knowledge retrieval (approved chunks only)."""

from __future__ import annotations

import re
from collections.abc import Sequence

from app.models.enums import KnowledgeStatus
from app.models.knowledge import KnowledgeChunkDocument
from app.services.grounding_validation_service import RetrievedChunk

_TOKEN = re.compile(r"[a-z0-9]+", re.IGNORECASE)


def _tokenize(text: str) -> set[str]:
    return {t.lower() for t in _TOKEN.findall(text) if len(t) > 2}


def score_chunk(query: str, chunk_text: str) -> float:
    q = _tokenize(query)
    if not q:
        return 0.0
    c = _tokenize(chunk_text)
    if not c:
        return 0.0
    overlap = len(q & c)
    return overlap / len(q)


class KnowledgeRetrievalService:
    def retrieve(
        self,
        query: str,
        chunks: Sequence[KnowledgeChunkDocument],
        *,
        max_chunks: int = 5,
        min_score: float = 0.15,
        language: str | None = None,
        topic: str | None = None,
    ) -> list[RetrievedChunk]:
        scored: list[RetrievedChunk] = []
        for chunk in chunks:
            if chunk.review_status != KnowledgeStatus.APPROVED or not chunk.active:
                continue
            if language and chunk.language.lower() != language.lower():
                continue
            if topic and chunk.topic.lower() != topic.lower():
                continue
            text = chunk.text or chunk.content
            score = score_chunk(query, text)
            if score < min_score:
                continue
            scored.append(
                RetrievedChunk(
                    chunk_id=chunk.chunk_id,
                    document_id=chunk.document_id,
                    title=chunk.source_title or chunk.document_id,
                    source_name=chunk.source_name,
                    source_url=chunk.source_url,
                    document_version=chunk.document_version,
                    text=text,
                    language=chunk.language,
                    topic=chunk.topic,
                    review_status=chunk.review_status,
                    score=score,
                    active=bool(chunk.active),
                )
            )
        scored.sort(key=lambda r: (-r.score, r.chunk_id))
        return scored[: max(1, max_chunks)]
