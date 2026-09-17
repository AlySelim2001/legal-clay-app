from __future__ import annotations

import hashlib
import math
import os
from typing import List, Optional


class LocalEmbeddingSkill:
    """Generate fixed-width local embeddings for Egyptian legal text.

    FastEmbed is preferred when installed. The deterministic fallback exists for
    offline CI and preserves the collection dimension contract, but is not a
    substitute for a trained semantic model in production.
    """

    vector_dim = 384

    def __init__(self, model_name: Optional[str] = None) -> None:
        self.model_name = model_name or os.getenv("EMBED_MODEL", "BAAI/bge-small-en-v1.5")
        self.model = None
        try:
            from fastembed import TextEmbedding

            self.model = TextEmbedding(model_name=self.model_name)
        except (ImportError, RuntimeError, ValueError):
            self.model = None

    @property
    def using_semantic_model(self) -> bool:
        return self.model is not None

    def embed_text(self, text: str) -> List[float]:
        if not text or not text.strip():
            return [0.0] * self.vector_dim

        if self.model is not None:
            vector = list(next(iter(self.model.embed([text]))))
            if len(vector) != self.vector_dim:
                raise ValueError(f"Embedding model returned {len(vector)} dimensions; expected {self.vector_dim}.")
            return [float(value) for value in vector]

        digest = hashlib.sha3_384(text.encode("utf-8")).digest()
        vector = [(byte / 255.0) * 2.0 - 1.0 for byte in digest]
        magnitude = math.sqrt(sum(value * value for value in vector))
        return [value / magnitude for value in vector] if magnitude else vector


__all__ = ["LocalEmbeddingSkill"]
