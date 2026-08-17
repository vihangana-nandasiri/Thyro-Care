"""Citation and grounding validation (Phase 13B v2)."""

from __future__ import annotations

import re
from dataclasses import dataclass

from app.content.assistant_policy import INSUFFICIENT_EVIDENCE_MESSAGE
from app.models.enums import ChatResponseMode, KnowledgeStatus

_URL = re.compile(r"https?://[^\s\]\)]+", re.IGNORECASE)
_FORBIDDEN = re.compile(
    r"\b(i diagnose|you (?:have|are) (?:diagnosed|cancer)|"
    r"prescrib(?:e|ed|ing)|increase your dose|decrease your dose|"
    r"stop (?:taking |your )?medication|start taking |"
    r"your prognosis|survival rate|"
    r"your tsh (?:is|means)|lab result means)\b",
    re.IGNORECASE,
)


@dataclass(frozen=True, slots=True)
class RetrievedChunk:
    chunk_id: str
    document_id: str
    title: str
    source_name: str
    source_url: str | None
    document_version: str
    text: str
    language: str
    topic: str
    review_status: KnowledgeStatus
    score: float
    active: bool = True


@dataclass(frozen=True, slots=True)
class GroundingResult:
    ok: bool
    mode: ChatResponseMode | None
    message: str | None
    citations: list[dict[str, str | None]]


class GroundingValidationService:
    def validate(
        self,
        *,
        answer_text: str,
        citation_ids: list[str],
        retrieved: list[RetrievedChunk],
        require_citation: bool = True,
    ) -> GroundingResult:
        by_id = {c.chunk_id: c for c in retrieved}
        citations: list[dict[str, str | None]] = []
        allowed_urls = {(c.source_url or "").rstrip("/") for c in retrieved if c.source_url}
        allowed_titles = {c.title.strip().lower() for c in retrieved}

        for cid in citation_ids:
            chunk = by_id.get(cid)
            if chunk is None:
                return self._fail()
            if chunk.review_status != KnowledgeStatus.APPROVED or not chunk.active:
                return self._fail()
            if chunk.review_status in {
                KnowledgeStatus.PENDING_REVIEW,
                KnowledgeStatus.DRAFT,
                KnowledgeStatus.CHANGES_REQUESTED,
                KnowledgeStatus.REJECTED,
                KnowledgeStatus.RETIRED,
            }:
                return self._fail()
            citations.append(
                {
                    "citation_id": chunk.chunk_id,
                    "document_id": chunk.document_id,
                    "title": chunk.title,
                    "source_name": chunk.source_name,
                    "source_url": chunk.source_url,
                    "document_version": chunk.document_version,
                    "excerpt": chunk.text[:400],
                }
            )

        if require_citation and not citations and answer_text.strip():
            return self._fail()

        # Reject invented URLs not present in evidence metadata
        for match in _URL.findall(answer_text):
            if match.rstrip("/") not in allowed_urls:
                return self._fail()

        if _FORBIDDEN.search(answer_text):
            return self._fail()

        # Soft length guard relative to evidence support
        evidence_chars = sum(len(c.text) for c in retrieved)
        if citations and len(answer_text) > max(1200, evidence_chars + 400):
            return self._fail()

        # Do not invent source titles as standalone claims without citations
        _ = allowed_titles
        return GroundingResult(ok=True, mode=None, message=None, citations=citations)

    def _fail(self) -> GroundingResult:
        return GroundingResult(
            ok=False,
            mode=ChatResponseMode.INSUFFICIENT_EVIDENCE,
            message=INSUFFICIENT_EVIDENCE_MESSAGE,
            citations=[],
        )
