"""Conversation context builder — history is not medical evidence."""

from __future__ import annotations

from dataclasses import dataclass

from app.models.chat import ChatMessageDocument
from app.models.enums import ChatMessageRole


@dataclass(frozen=True, slots=True)
class ContextTurn:
    role: str
    content: str


def build_conversation_context(
    messages: list[ChatMessageDocument],
    *,
    max_messages: int,
) -> list[ContextTurn]:
    """Return up to max_messages recent non-deleted turns for pronoun clarification only."""
    if max_messages <= 0:
        return []
    eligible = [m for m in messages if not m.is_deleted and m.content.strip()]
    recent = eligible[-max_messages:]
    turns: list[ContextTurn] = []
    for msg in recent:
        role = "user" if msg.role == ChatMessageRole.USER else "assistant"
        turns.append(ContextTurn(role=role, content=msg.content.strip()[:1500]))
    return turns
