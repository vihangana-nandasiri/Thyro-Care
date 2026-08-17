"""Structured LLM response contract (Phase 13B)."""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.enums import EvidenceCoverage, StructuredResponseCategory


class StructuredAssistantPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")

    answer: str = Field(min_length=1, max_length=3500)
    citation_ids: list[str] = Field(default_factory=list, max_length=12)
    response_category: StructuredResponseCategory
    evidence_coverage: EvidenceCoverage
    follow_up_suggestions: list[str] = Field(default_factory=list, max_length=5)

    @field_validator("citation_ids")
    @classmethod
    def _unique_citations(cls, value: list[str]) -> list[str]:
        cleaned: list[str] = []
        seen: set[str] = set()
        for item in value:
            cid = item.strip()
            if not cid or cid in seen:
                continue
            seen.add(cid)
            cleaned.append(cid[:160])
        return cleaned

    @field_validator("follow_up_suggestions")
    @classmethod
    def _bounded_suggestions(cls, value: list[str]) -> list[str]:
        out: list[str] = []
        for item in value[:5]:
            text = item.strip()
            if text:
                out.append(text[:200])
        return out
