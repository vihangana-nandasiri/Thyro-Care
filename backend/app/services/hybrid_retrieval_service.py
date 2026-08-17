"""Hybrid lexical + semantic retrieval with RRF fusion."""

from __future__ import annotations

from collections import defaultdict
from collections.abc import Sequence

from app.core.config import Settings, get_settings
from app.models.enums import KnowledgeStatus
from app.models.knowledge import KnowledgeChunkDocument
from app.repositories.knowledge_chunk_embedding_repository import (
    KnowledgeChunkEmbeddingRepository,
)
from app.services.embedding_service import EmbeddingProvider, cosine_similarity
from app.services.grounding_validation_service import RetrievedChunk
from app.services.knowledge_retrieval_service import KnowledgeRetrievalService


class HybridRetrievalService:
    def __init__(
        self,
        *,
        lexical: KnowledgeRetrievalService | None = None,
        embeddings: KnowledgeChunkEmbeddingRepository | None = None,
        embedding_provider: EmbeddingProvider | None = None,
        settings: Settings | None = None,
    ) -> None:
        self.lexical = lexical or KnowledgeRetrievalService()
        self.embeddings = embeddings
        self.embedding_provider = embedding_provider
        self.settings = settings or get_settings()

    async def retrieve(
        self,
        query: str,
        chunks: Sequence[KnowledgeChunkDocument],
        *,
        language: str | None = None,
        topic: str | None = None,
    ) -> tuple[list[RetrievedChunk], str]:
        mode = self.settings.knowledge_retrieval_mode.strip().lower()
        final_k = self.settings.knowledge_final_top_k or self.settings.knowledge_max_chunks
        lexical_hits = self.lexical.retrieve(
            query,
            chunks,
            max_chunks=self.settings.knowledge_lexical_top_k,
            min_score=self.settings.knowledge_min_lexical_score
            or self.settings.knowledge_min_score,
            language=language,
            topic=topic,
        )

        if mode in {"", "lexical"} or self.embeddings is None or self.embedding_provider is None:
            return lexical_hits[:final_k], "lexical"

        try:
            vector_hits = await self._vector_retrieve(query, chunks, language=language, topic=topic)
        except Exception:
            return lexical_hits[:final_k], "lexical_fallback"

        if not vector_hits:
            return lexical_hits[:final_k], "lexical_fallback"

        if mode == "vector":
            return vector_hits[:final_k], "vector"

        fused = reciprocal_rank_fusion(
            [lexical_hits, vector_hits],
            k=self.settings.knowledge_rrf_k,
            limit=final_k,
        )
        return fused, "hybrid"

    async def _vector_retrieve(
        self,
        query: str,
        chunks: Sequence[KnowledgeChunkDocument],
        *,
        language: str | None,
        topic: str | None,
    ) -> list[RetrievedChunk]:
        assert self.embeddings is not None
        assert self.embedding_provider is not None
        query_vec = (await self.embedding_provider.embed_texts([query]))[0]
        # Bounded in-app search when Atlas Vector Search is unavailable.
        stored = await self.embeddings.list_active(
            language=language,
            topic=topic,
            limit=500,
        )
        by_chunk = {
            c.chunk_id: c
            for c in chunks
            if c.review_status == KnowledgeStatus.APPROVED and c.active
        }
        scored: list[RetrievedChunk] = []
        min_score = self.settings.knowledge_min_vector_score
        for emb in stored:
            chunk = by_chunk.get(emb.chunk_id)
            if chunk is None:
                continue
            if emb.review_status != KnowledgeStatus.APPROVED or not emb.active:
                continue
            score = cosine_similarity(query_vec, emb.embedding)
            if score < min_score:
                continue
            text = chunk.text or chunk.content
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
        # Limit repeated chunks from the same document
        limited: list[RetrievedChunk] = []
        per_doc: dict[str, int] = defaultdict(int)
        for item in scored:
            if per_doc[item.document_id] >= 2:
                continue
            per_doc[item.document_id] += 1
            limited.append(item)
            if len(limited) >= self.settings.knowledge_vector_top_k:
                break
        return limited


def reciprocal_rank_fusion(
    ranked_lists: list[list[RetrievedChunk]],
    *,
    k: int = 60,
    limit: int = 5,
) -> list[RetrievedChunk]:
    scores: dict[str, float] = defaultdict(float)
    best: dict[str, RetrievedChunk] = {}
    for ranked in ranked_lists:
        for rank, item in enumerate(ranked, start=1):
            scores[item.chunk_id] += 1.0 / (k + rank)
            prev = best.get(item.chunk_id)
            if prev is None or item.score > prev.score:
                best[item.chunk_id] = item
    ordered = sorted(scores.items(), key=lambda kv: (-kv[1], kv[0]))
    out: list[RetrievedChunk] = []
    for chunk_id, fused in ordered[:limit]:
        item = best[chunk_id]
        out.append(
            RetrievedChunk(
                chunk_id=item.chunk_id,
                document_id=item.document_id,
                title=item.title,
                source_name=item.source_name,
                source_url=item.source_url,
                document_version=item.document_version,
                text=item.text,
                language=item.language,
                topic=item.topic,
                review_status=item.review_status,
                score=fused,
                active=item.active,
            )
        )
    return out
