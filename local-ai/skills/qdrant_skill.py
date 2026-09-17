from __future__ import annotations

import hashlib
import os
import uuid
from typing import Any, Dict, List, Optional

from qdrant_client import QdrantClient
from qdrant_client.models import Distance, PointStruct, VectorParams


class QdrantLegalSkill:
    """Indexes and retrieves Egyptian legal text in a local Qdrant collection."""

    VECTOR_SIZE = 384

    def __init__(self, host: Optional[str] = None, port: Optional[int] = None, collection_name: Optional[str] = None) -> None:
        url = os.getenv("QDRANT_URL")
        api_key = os.getenv("QDRANT_API_KEY")
        self.collection_name = collection_name or os.getenv("QDRANT_COLLECTION", "egyptian_legal_docs")
        if url:
            self.client = QdrantClient(url=url, api_key=api_key)
        else:
            self.client = QdrantClient(host=host or os.getenv("QDRANT_HOST", "localhost"), port=port or int(os.getenv("QDRANT_PORT", "6333")), api_key=api_key)
        self._ensure_collection()

    def _ensure_collection(self) -> None:
        try:
            names = {item.name for item in self.client.get_collections().collections}
            if self.collection_name not in names:
                self.client.create_collection(collection_name=self.collection_name, vectors_config=VectorParams(size=self.VECTOR_SIZE, distance=Distance.COSINE))
        except Exception:
            # Connection failures are reported by apply/search instead of breaking API import.
            return

    @classmethod
    def embed_text(cls, text: str) -> List[float]:
        """Create a deterministic local baseline embedding without network calls."""
        vector = [0.0] * cls.VECTOR_SIZE
        encoded = text.encode("utf-8")
        if not encoded:
            return vector
        for index in range(0, len(encoded), 2):
            digest = hashlib.sha256(encoded[index:index + 64]).digest()
            position = int.from_bytes(digest[:4], "big") % cls.VECTOR_SIZE
            vector[position] += 1.0 if digest[4] % 2 else -1.0
        magnitude = sum(value * value for value in vector) ** 0.5
        return [value / magnitude for value in vector] if magnitude else vector

    def index_text(self, text: str, vector: Optional[List[float]] = None, metadata: Optional[Dict[str, Any]] = None) -> str:
        if not text or not text.strip():
            raise ValueError("Legal text must not be empty.")
        point_id = str(uuid.uuid4())
        embedding = vector or self.embed_text(text)
        if len(embedding) != self.VECTOR_SIZE:
            raise ValueError(f"Vector must contain exactly {self.VECTOR_SIZE} dimensions.")
        payload = {"text": text, **(metadata or {})}
        self.client.upsert(collection_name=self.collection_name, points=[PointStruct(id=point_id, vector=embedding, payload=payload)])
        return point_id

    def search_similar(self, vector: Optional[List[float]] = None, limit: int = 5, query: str = "") -> List[Dict[str, Any]]:
        if limit < 1 or limit > 50:
            raise ValueError("limit must be between 1 and 50.")
        embedding = vector or self.embed_text(query)
        try:
            results = self.client.query_points(collection_name=self.collection_name, query=embedding, limit=limit, with_payload=True).points
        except AttributeError:  # qdrant-client compatibility with older releases
            results = self.client.search(collection_name=self.collection_name, query_vector=embedding, limit=limit)
        return [{"id": result.id, "score": result.score, "payload": result.payload or {}} for result in results]


__all__ = ["QdrantLegalSkill"]
