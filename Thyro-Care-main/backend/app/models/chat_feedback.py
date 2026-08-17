"""Chat response feedback and aggregate usage metrics (Phase 13B)."""

from __future__ import annotations

from datetime import datetime

from pydantic import Field

from app.models.base import DocumentBase, SoftDeletableDocument, TimestampFields
from app.models.enums import FeedbackRating, FeedbackReasonCode
from app.models.object_id import PyObjectId
from app.utils.datetime import utc_now


class ChatResponseFeedbackDocument(SoftDeletableDocument):
    user_id: PyObjectId
    session_id: PyObjectId
    assistant_message_id: PyObjectId
    rating: FeedbackRating
    reason_code: FeedbackReasonCode | None = None
    comment: str | None = Field(default=None, max_length=500)
    response_mode: str | None = Field(default=None, max_length=64)
    prompt_version: str | None = Field(default=None, max_length=64)
    retrieval_version: str | None = Field(default=None, max_length=64)
    provider: str | None = Field(default=None, max_length=64)
    model_name: str | None = Field(default=None, max_length=128)
    version: int = Field(default=1, ge=1)


class ChatUsageMetricDocument(DocumentBase, TimestampFields):
    """Privacy-safe aggregate counters — no prompts or answers."""

    metric_day: str = Field(min_length=8, max_length=10)  # YYYY-MM-DD
    request_count: int = Field(default=0, ge=0)
    grounded_count: int = Field(default=0, ge=0)
    insufficient_evidence_count: int = Field(default=0, ge=0)
    provider_unavailable_count: int = Field(default=0, ge=0)
    safety_redirect_count: int = Field(default=0, ge=0)
    policy_refusal_count: int = Field(default=0, ge=0)
    citation_validation_failure_count: int = Field(default=0, ge=0)
    feedback_up_count: int = Field(default=0, ge=0)
    feedback_down_count: int = Field(default=0, ge=0)
    retrieval_mode_lexical: int = Field(default=0, ge=0)
    retrieval_mode_hybrid: int = Field(default=0, ge=0)
    retrieval_mode_vector: int = Field(default=0, ge=0)
    total_latency_ms: int = Field(default=0, ge=0)
    provider_latency_ms: int = Field(default=0, ge=0)
    approx_input_tokens: int = Field(default=0, ge=0)
    approx_output_tokens: int = Field(default=0, ge=0)
    updated_at: datetime = Field(default_factory=utc_now)
