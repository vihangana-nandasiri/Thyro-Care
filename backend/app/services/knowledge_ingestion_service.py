"""Load and chunk controlled local knowledge files; ingest approved governance versions."""

from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path
from typing import TYPE_CHECKING, Any

from app.models.enums import KnowledgeStatus
from app.models.knowledge import (
    KnowledgeChunkDocument,
    KnowledgeChunkMetadata,
    KnowledgeDocumentDocument,
    KnowledgeDocumentVersionDocument,
)
from app.utils.datetime import utc_now

if TYPE_CHECKING:
    from app.repositories.knowledge_repository import KnowledgeRepository

CHUNK_SIZE = 800
CHUNK_OVERLAP = 100

_DEFAULT_DIR = Path(__file__).resolve().parent.parent / "content" / "approved_knowledge"


def content_hash(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def canonical_content_hash(
    *,
    title: str,
    source_name: str,
    source_url: str | None,
    topic: str,
    language: str,
    body: str,
    medical_disclaimer: str,
) -> str:
    """Stable SHA-256 hash covering all medically relevant fields of a version."""
    canonical = "|".join(
        [title, source_name, source_url or "", topic, language, body, medical_disclaimer]
    )
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def deterministic_chunks(
    body: str, *, size: int = CHUNK_SIZE, overlap: int = CHUNK_OVERLAP
) -> list[str]:
    text = re.sub(r"\s+", " ", body.strip())
    if not text:
        return []
    if len(text) <= size:
        return [text]
    chunks: list[str] = []
    start = 0
    while start < len(text):
        end = min(len(text), start + size)
        chunks.append(text[start:end].strip())
        if end >= len(text):
            break
        start = max(0, end - overlap)
    return [c for c in chunks if c]


def _parse_status(value: str) -> KnowledgeStatus:
    return KnowledgeStatus(value)


def load_knowledge_file(path: Path) -> dict[str, Any]:
    data = json.loads(path.read_text(encoding="utf-8"))
    required = {
        "document_id",
        "title",
        "slug",
        "source_name",
        "topic",
        "language",
        "version",
        "review_status",
        "body",
    }
    missing = required - set(data)
    if missing:
        raise ValueError(f"Missing fields in {path.name}: {sorted(missing)}")
    return data


def build_document(data: dict[str, Any]) -> KnowledgeDocumentDocument:
    body = str(data["body"])
    status = _parse_status(str(data["review_status"]))
    content_version = str(data.get("version") or "1")
    version_number = int(content_version) if str(content_version).isdigit() else 1
    version_id = f"{data['document_id']}:v{version_number}"
    digest = canonical_content_hash(
        title=str(data["title"]),
        source_name=str(data["source_name"]),
        source_url=data.get("source_url"),
        topic=str(data["topic"]),
        language=str(data.get("language") or "english"),
        body=body,
        medical_disclaimer=str(data.get("medical_disclaimer") or ""),
    )
    return KnowledgeDocumentDocument(
        document_id=str(data["document_id"]),
        title=str(data["title"]),
        slug=str(data["slug"]),
        source_name=str(data["source_name"]),
        source_url=data.get("source_url"),
        topic=str(data["topic"]),
        language=str(data.get("language") or "english"),
        version=1,
        content_version=content_version,
        current_version_id=version_id,
        current_status=status,
        review_status=status,
        reviewed_at=None,
        reviewed_by_role=data.get("reviewed_by_role"),
        content_hash=digest,
        body=body,
        medical_disclaimer=str(data.get("medical_disclaimer") or ""),
        category=str(data.get("topic") or "general"),
        content=body,
        source_organization=str(data["source_name"]),
        source_reference=data.get("source_url"),
        status=status,
        active=status == KnowledgeStatus.APPROVED,
        updated_at=utc_now(),
    )


def build_version_from_seed(data: dict[str, Any]) -> KnowledgeDocumentVersionDocument:
    """Create a governance version row for a seed file so it appears on the review queue."""
    body = str(data["body"])
    status = _parse_status(str(data["review_status"]))
    content_version = str(data.get("version") or "1")
    version_number = int(content_version) if str(content_version).isdigit() else 1
    document_id = str(data["document_id"])
    version_id = f"{document_id}:v{version_number}"
    digest = canonical_content_hash(
        title=str(data["title"]),
        source_name=str(data["source_name"]),
        source_url=data.get("source_url"),
        topic=str(data["topic"]),
        language=str(data.get("language") or "english"),
        body=body,
        medical_disclaimer=str(data.get("medical_disclaimer") or ""),
    )
    now = utc_now()
    return KnowledgeDocumentVersionDocument(
        document_id=document_id,
        version_id=version_id,
        version_number=version_number,
        title=str(data["title"]),
        source_name=str(data["source_name"]),
        source_url=data.get("source_url"),
        topic=str(data["topic"]),
        language=str(data.get("language") or "english"),
        body=body,
        medical_disclaimer=str(data.get("medical_disclaimer") or ""),
        content_hash=digest,
        review_status=status,
        submitted_for_review_at=now if status == KnowledgeStatus.PENDING_REVIEW else None,
        version=1,
    )


def build_chunks(
    doc: KnowledgeDocumentDocument, *, version_id: str | None = None
) -> list[KnowledgeChunkDocument]:
    parts = deterministic_chunks(doc.body)
    out: list[KnowledgeChunkDocument] = []
    resolved_version_id = version_id or doc.current_version_id
    for idx, part in enumerate(parts):
        chunk_id = f"{doc.document_id}:c{idx}"
        out.append(
            KnowledgeChunkDocument(
                document_id=doc.document_id,
                version_id=resolved_version_id,
                chunk_id=chunk_id,
                chunk_index=idx,
                text=part,
                topic=doc.topic,
                language=doc.language,
                source_title=doc.title,
                source_name=doc.source_name,
                source_url=doc.source_url,
                document_version=doc.content_version,
                review_status=doc.review_status,
                content_hash=content_hash(part),
                content=part,
                metadata=KnowledgeChunkMetadata(category=doc.topic, language=doc.language),
                active=doc.review_status == KnowledgeStatus.APPROVED,
            )
        )
    return out


class KnowledgeIngestionService:
    def __init__(self, content_dir: Path | None = None) -> None:
        self.content_dir = content_dir or _DEFAULT_DIR

    def load_all(
        self,
    ) -> tuple[
        list[KnowledgeDocumentDocument],
        list[KnowledgeChunkDocument],
        list[KnowledgeDocumentVersionDocument],
    ]:
        docs: list[KnowledgeDocumentDocument] = []
        chunks: list[KnowledgeChunkDocument] = []
        versions: list[KnowledgeDocumentVersionDocument] = []
        if not self.content_dir.exists():
            return docs, chunks, versions
        for path in sorted(self.content_dir.glob("*.json")):
            data = load_knowledge_file(path)
            doc = build_document(data)
            version = build_version_from_seed(data)
            docs.append(doc)
            versions.append(version)
            chunks.extend(build_chunks(doc, version_id=version.version_id))
        return docs, chunks, versions

    def approved_only_chunks(
        self, chunks: list[KnowledgeChunkDocument]
    ) -> list[KnowledgeChunkDocument]:
        return [c for c in chunks if c.review_status == KnowledgeStatus.APPROVED and c.active]


async def ingest_approved_version(
    version: KnowledgeDocumentVersionDocument,
    knowledge_repo: KnowledgeRepository,
) -> int:
    """Deterministically chunk and upsert an APPROVED version; retire superseded chunks.

    Idempotent: safe to call again (e.g. on ingestion retry or restore).
    """
    doc_for_chunks = KnowledgeDocumentDocument(
        document_id=version.document_id,
        title=version.title,
        slug=version.document_id,
        source_name=version.source_name,
        source_url=version.source_url,
        topic=version.topic,
        language=version.language,
        content_version=str(version.version_number),
        review_status=KnowledgeStatus.APPROVED,
        content_hash=version.content_hash,
        body=version.body,
        medical_disclaimer=version.medical_disclaimer,
        status=KnowledgeStatus.APPROVED,
        active=True,
    )
    chunks = build_chunks(doc_for_chunks, version_id=version.version_id)
    count = await knowledge_repo.upsert_chunks(chunks)
    await knowledge_repo.retire_old_chunks(version.document_id, str(version.version_number))
    return count
