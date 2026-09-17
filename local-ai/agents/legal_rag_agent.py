from __future__ import annotations

import os
from typing import Any, Dict

from agents.base_agent import BaseAgent
from core.llm_provider import LLMProvider
from skills.egyptian_legal_sanitizer import EgyptianLegalSanitizerSkill
from skills.qdrant_skill import QdrantLegalSkill


class LegalRAGAgent(BaseAgent):
    """Retrieves local legal sources and generates a source-grounded answer."""

    def __init__(self) -> None:
        super().__init__(name="LegalRAGAgent")
        self.qdrant_skill = QdrantLegalSkill()
        self.llm = LLMProvider()
        self.sanitizer = EgyptianLegalSanitizerSkill()

    def execute(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        query = self.sanitizer.apply(str(payload.get("query", "")))
        if not query:
            return self.format_response("error", None, "Query string is required.")
        try:
            documents = self.qdrant_skill.search_similar(query=query, limit=int(payload.get("limit", 5)))
            if not documents:
                return self.format_response("review_required", {"query": query, "sources": [], "answer": "لا توجد مصادر قانونية مسترجعة."}, "No legal sources were retrieved.")
            context = "\n\n".join(str(doc["payload"].get("text", "")) for doc in documents)
            prompt = f"السياق القانوني الموثق:\n{context}\n\nالسؤال: {query}\nأجب من السياق فقط، واذكر أن الإجابة تنظيمية وليست استشارة قانونية."
            answer = self.llm.generate(prompt=prompt, system="أنت مساعد قانوني مصري. لا تخترع مواد أو أحكاماً غير موجودة في السياق.")
            return self.format_response("success", {"query": query, "sources": documents, "answer": answer}, "RAG query executed successfully.")
        except Exception as exc:
            return self.format_response("review_required", {"query": query, "sources": []}, f"RAG execution requires review: {exc}")


__all__ = ["LegalRAGAgent"]
