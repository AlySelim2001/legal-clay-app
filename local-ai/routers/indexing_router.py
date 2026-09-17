from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from skills.egyptian_legal_sanitizer import EgyptianLegalSanitizerSkill
from skills.qdrant_skill import QdrantLegalSkill

router = APIRouter(prefix="/api/v1/documents", tags=["Document Indexing"])
qdrant_skill = QdrantLegalSkill()
sanitizer = EgyptianLegalSanitizerSkill()


class IndexDocumentRequest(BaseModel):
    text: str = Field(..., min_length=5, max_length=2_000_000)
    article_number: Optional[str] = Field(default=None, max_length=100)
    category: str = Field(default="general", min_length=1, max_length=100)


@router.post("/index")
async def index_legal_document(request: IndexDocumentRequest):
    clean_text = sanitizer.apply(request.text)
    if not clean_text:
        raise HTTPException(status_code=400, detail="Document text is empty after sanitization.")
    try:
        point_id = qdrant_skill.index_text(clean_text, metadata={"article_number": request.article_number, "category": request.category})
    except Exception as exc:
        raise HTTPException(status_code=503, detail="Vector indexing is unavailable.") from exc
    return {"status": "success", "document_id": point_id, "indexed_char_count": len(clean_text), "message": "Legal document indexed successfully."}
