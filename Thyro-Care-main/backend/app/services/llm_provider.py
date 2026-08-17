"""LLM provider abstraction — async-capable, no tools, no chain-of-thought."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Protocol

from app.content.assistant_policy import (
    ASSISTANT_DISCLAIMER,
    INSUFFICIENT_EVIDENCE_MESSAGE,
    PROVIDER_UNAVAILABLE_MESSAGE,
    SYSTEM_POLICY_TEXT,
)
from app.core.config import Settings, get_settings
from app.models.enums import EvidenceCoverage, StructuredResponseCategory
from app.services.conversation_context import ContextTurn
from app.services.grounding_validation_service import RetrievedChunk


@dataclass(frozen=True, slots=True)
class ProviderAnswer:
    text: str
    citation_ids: list[str]
    provider: str
    model_name: str
    available: bool
    response_category: StructuredResponseCategory | None = None
    evidence_coverage: EvidenceCoverage | None = None
    follow_up_suggestions: list[str] = field(default_factory=list)
    failure_category: str | None = None


class LLMProvider(Protocol):
    def health_check(self) -> bool: ...

    async def generate_grounded_answer(
        self,
        *,
        user_message: str,
        evidence: list[RetrievedChunk],
        max_output_tokens: int,
        conversation_context: list[ContextTurn] | None = None,
        language: str = "en",
    ) -> ProviderAnswer: ...


class DisabledLLMProvider:
    def health_check(self) -> bool:
        return False

    async def generate_grounded_answer(
        self,
        *,
        user_message: str,
        evidence: list[RetrievedChunk],
        max_output_tokens: int,
        conversation_context: list[ContextTurn] | None = None,
        language: str = "en",
    ) -> ProviderAnswer:
        _ = (user_message, evidence, max_output_tokens, conversation_context, language)
        _ = SYSTEM_POLICY_TEXT
        return ProviderAnswer(
            text=PROVIDER_UNAVAILABLE_MESSAGE,
            citation_ids=[],
            provider="disabled",
            model_name="none",
            available=False,
            failure_category="configuration",
        )


class FakeLLMProvider:
    """Deterministic test provider — cites first evidence chunk only."""

    def health_check(self) -> bool:
        return True

    async def generate_grounded_answer(
        self,
        *,
        user_message: str,
        evidence: list[RetrievedChunk],
        max_output_tokens: int,
        conversation_context: list[ContextTurn] | None = None,
        language: str = "en",
    ) -> ProviderAnswer:
        _ = (user_message, conversation_context, language)
        if not evidence:
            return ProviderAnswer(
                text=INSUFFICIENT_EVIDENCE_MESSAGE,
                citation_ids=[],
                provider="fake",
                model_name="fake-v1",
                available=True,
                response_category=StructuredResponseCategory.INSUFFICIENT_EVIDENCE,
                evidence_coverage=EvidenceCoverage.INSUFFICIENT,
            )
        top = evidence[0]
        excerpt = top.text[: min(280, max_output_tokens * 4)]
        text = (
            f"Based on approved educational materials: {excerpt} "
            f"[{top.chunk_id}] {ASSISTANT_DISCLAIMER}"
        )
        return ProviderAnswer(
            text=text,
            citation_ids=[top.chunk_id],
            provider="fake",
            model_name="fake-v1",
            available=True,
            response_category=StructuredResponseCategory.EDUCATION,
            evidence_coverage=EvidenceCoverage.HIGH,
            follow_up_suggestions=["Ask about approved educational resources"],
        )


def get_llm_provider(
    provider_name: str,
    *,
    assistant_enabled: bool,
    settings: Settings | None = None,
) -> LLMProvider:
    cfg = settings or get_settings()
    name = (provider_name or "disabled").strip().lower()
    if not assistant_enabled or name in {"", "disabled", "none"}:
        return DisabledLLMProvider()
    if name == "fake":
        return FakeLLMProvider()
    if name == "openai":
        from app.services.openai_responses_provider import OpenAIResponsesProvider

        return OpenAIResponsesProvider(cfg)
    return DisabledLLMProvider()
