from __future__ import annotations

import os
import uuid
from typing import Any, Dict, List, Optional

from qdrant_client import QdrantClient
from qdrant_client.models import Distance, PointStruct, VectorParams

from skills.embedding_skill import LocalEmbeddingSkill


class QdrantLegalSkill:
    """Semantic indexing and retrieval for local Egyptian legal documents."""

    def __init__(self, host: Optional[str] = None, port: Optional[int] = None, collection_name: Optional[str] = None) -> None:
        self.embedder = LocalEmbeddingSkill()
        self.collection_name = collection_name or os.getenv("QDRANT_COLLECTION", "egyptian_legal_docs")
        url = os.getenv("QDRANT_URL")
        api_key = os.getenv("QDRANT_API_KEY")
        if url:
            self.client = QdrantClient(url=url, api_key=api_key)
        else:
            self.client = QdrantClient(host=host or os.getenv("QDRANT_HOST", "localhost"), port=port or int(os.getenv("QDRANT_PORT", "6333")), api_key=api_key)
        self._ensure_collection()

    def _ensure_collection(self) -> None:
        try:
            names = {item.name for item in self.client.get_collections().collections}
            if self.collection_name not in names:
                self.client.create_collection(collection_name=self.collection_name, vectors_config=VectorParams(size=self.embedder.vector_dim, distance=Distance.COSINE))
        except Exception:
            return

    def index_text(self, text: str, metadata: Optional[Dict[str, Any]] = None) -> str:
        if not text or not text.strip():
            raise ValueError("Legal text must not be empty.")
        point_id = str(uuid.uuid4())
        payload = {"text": text, **(metadata or {})}
        self.client.upsert(collection_name=self.collection_name, points=[PointStruct(id=point_id, vector=self.embedder.embed_text(text), payload=payload)])
        return point_id

    def search_similar(self, query: str, limit: int = 5) -> List[Dict[str, Any]]:
        if not query or not query.strip():
            raise ValueError("Search query must not be empty.")
        if not 1 <= limit <= 50:
            raise ValueError("limit must be between 1 and 50.")
        vector = self.embedder.embed_text(query)
        try:
            results = self.client.query_points(collection_name=self.collection_name, query=vector, limit=limit, with_payload=True).points
        except AttributeError:
            results = self.client.search(collection_name=self.collection_name, query_vector=vector, limit=limit, with_payload=True)
        return [{"id": str(result.id), "score": float(result.score), "payload": result.payload or {}} for result in results]


__all__ = ["QdrantLegalSkill"]
