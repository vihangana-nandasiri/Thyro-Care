"""Embedding providers and cosine helpers (Phase 13B)."""

from __future__ import annotations

import hashlib
import math
import struct
from typing import Protocol

from app.core.config import Settings, get_settings
from app.core.logging import get_logger

logger = get_logger(__name__)


class EmbeddingProvider(Protocol):
    model_name: str
    dimensions: int

    async def embed_texts(self, texts: list[str]) -> list[list[float]]: ...


class FakeEmbeddingProvider:
    """Deterministic offline embeddings for tests — not for production ranking quality."""

    def __init__(self, *, dimensions: int = 32) -> None:
        self.model_name = "fake-embed-v1"
        self.dimensions = dimensions

    async def embed_texts(self, texts: list[str]) -> list[list[float]]:
        return [_fake_vector(text, self.dimensions) for text in texts]


class OpenAIEmbeddingProvider:
    def __init__(self, settings: Settings | None = None) -> None:
        self.settings = settings or get_settings()
        self.model_name = self.settings.openai_embedding_model.strip() or "text-embedding-3-small"
        self.dimensions = 1536
        self._client = None

    def _api_key(self) -> str:
        return self.settings.openai_api_key.strip() or self.settings.llm_api_key.strip()

    async def embed_texts(self, texts: list[str]) -> list[list[float]]:
        if not texts:
            return []
        if not self._api_key():
            raise RuntimeError("embedding_configuration_error")
        from openai import AsyncOpenAI

        if self._client is None:
            self._client = AsyncOpenAI(
                api_key=self._api_key(),
                timeout=float(self.settings.openai_timeout_seconds),
                max_retries=int(self.settings.openai_max_retries),
            )
        response = await self._client.embeddings.create(
            model=self.model_name,
            input=texts,
        )
        vectors = [list(item.embedding) for item in response.data]
        if vectors:
            self.dimensions = len(vectors[0])
        return vectors


def get_embedding_provider(settings: Settings | None = None) -> EmbeddingProvider:
    cfg = settings or get_settings()
    provider = cfg.llm_provider.strip().lower()
    if provider == "fake" or cfg.app_environment == "test":
        return FakeEmbeddingProvider()
    if provider == "openai" and (cfg.openai_api_key.strip() or cfg.llm_api_key.strip()):
        return OpenAIEmbeddingProvider(cfg)
    return FakeEmbeddingProvider()


def cosine_similarity(a: list[float], b: list[float]) -> float:
    if not a or not b or len(a) != len(b):
        return 0.0
    dot = 0.0
    na = 0.0
    nb = 0.0
    for x, y in zip(a, b, strict=True):
        dot += x * y
        na += x * x
        nb += y * y
    if na <= 0.0 or nb <= 0.0:
        return 0.0
    return dot / (math.sqrt(na) * math.sqrt(nb))


def _fake_vector(text: str, dimensions: int) -> list[float]:
    digest = hashlib.sha256(text.encode("utf-8")).digest()
    values: list[float] = []
    while len(values) < dimensions:
        for i in range(0, len(digest) - 3, 4):
            raw = struct.unpack(">I", digest[i : i + 4])[0]
            values.append((raw / 2**32) * 2.0 - 1.0)
            if len(values) >= dimensions:
                break
        digest = hashlib.sha256(digest + text.encode("utf-8")).digest()
    # L2 normalize
    norm = math.sqrt(sum(v * v for v in values)) or 1.0
    return [v / norm for v in values]
