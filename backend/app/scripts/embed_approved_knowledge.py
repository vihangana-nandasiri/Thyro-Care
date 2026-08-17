"""Embed approved knowledge chunks (idempotent). API key from environment only."""

from __future__ import annotations

import argparse
import asyncio
import sys

from app.core.config import get_settings
from app.core.logging import configure_logging, get_logger
from app.db.mongodb import close_client, get_client, get_database
from app.models.embeddings import KnowledgeChunkEmbeddingDocument
from app.models.enums import KnowledgeStatus
from app.repositories.knowledge_chunk_embedding_repository import (
    KnowledgeChunkEmbeddingRepository,
)
from app.repositories.knowledge_repository import KnowledgeRepository
from app.services.embedding_service import get_embedding_provider
from app.utils.datetime import utc_now

logger = get_logger(__name__)


async def run(
    *,
    dry_run: bool,
    document_id: str | None,
    batch_size: int,
    force_reembed: bool,
) -> int:
    settings = get_settings()
    configure_logging(settings.log_level)
    client = get_client()
    db = get_database()
    chunks_repo = KnowledgeRepository(db)
    emb_repo = KnowledgeChunkEmbeddingRepository(db)
    provider = get_embedding_provider(settings)

    chunks = await chunks_repo.list_approved_chunks(limit=5000)
    if document_id:
        chunks = [c for c in chunks if c.document_id == document_id]

    # Deactivate embeddings for retired/inactive chunks
    deactivated = 0
    skipped = 0
    embedded = 0
    considered = 0

    pending_texts: list[str] = []
    pending_meta: list = []

    for chunk in chunks:
        considered += 1
        if chunk.review_status != KnowledgeStatus.APPROVED or not chunk.active:
            deactivated += await emb_repo.deactivate_for_chunk(chunk.chunk_id)
            continue
        content_hash = chunk.content_hash
        existing = await emb_repo.find_active_by_chunk_hash_model(
            chunk_id=chunk.chunk_id,
            content_hash=content_hash,
            embedding_model=provider.model_name,
        )
        if existing is not None and not force_reembed:
            skipped += 1
            continue
        text = (chunk.text or chunk.content or "").strip()
        if not text:
            continue
        pending_texts.append(text)
        pending_meta.append(chunk)
        if len(pending_texts) >= batch_size:
            embedded += await _flush(
                pending_texts,
                pending_meta,
                emb_repo=emb_repo,
                provider=provider,
                dry_run=dry_run,
                force_reembed=force_reembed,
            )
            pending_texts.clear()
            pending_meta.clear()

    if pending_texts:
        embedded += await _flush(
            pending_texts,
            pending_meta,
            emb_repo=emb_repo,
            provider=provider,
            dry_run=dry_run,
            force_reembed=force_reembed,
        )

    logger.info(
        "embed_approved_knowledge considered=%s embedded=%s skipped=%s deactivated=%s dry_run=%s",
        considered,
        embedded,
        skipped,
        deactivated,
        dry_run,
    )
    await close_client()
    _ = client
    return 0


async def _flush(
    texts: list[str],
    chunks: list,
    *,
    emb_repo: KnowledgeChunkEmbeddingRepository,
    provider,
    dry_run: bool,
    force_reembed: bool,
) -> int:
    if dry_run:
        return len(texts)
    vectors = await provider.embed_texts(texts)
    count = 0
    for chunk, vector in zip(chunks, vectors, strict=True):
        if force_reembed:
            await emb_repo.deactivate_for_chunk(chunk.chunk_id)
        doc = KnowledgeChunkEmbeddingDocument(
            chunk_id=chunk.chunk_id,
            document_id=chunk.document_id,
            document_version=chunk.document_version,
            content_hash=chunk.content_hash,
            embedding=vector,
            embedding_model=provider.model_name,
            embedding_dimensions=len(vector),
            language=chunk.language,
            topic=chunk.topic,
            review_status=KnowledgeStatus.APPROVED,
            active=True,
            embedded_at=utc_now(),
        )
        await emb_repo.upsert_embedding(doc)
        count += 1
    return count


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Embed approved knowledge chunks")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--document-id", default=None)
    parser.add_argument("--batch-size", type=int, default=16)
    parser.add_argument("--force-reembed", action="store_true")
    args = parser.parse_args(argv)
    return asyncio.run(
        run(
            dry_run=args.dry_run,
            document_id=args.document_id,
            batch_size=max(1, min(args.batch_size, 64)),
            force_reembed=args.force_reembed,
        )
    )


if __name__ == "__main__":
    sys.exit(main())
