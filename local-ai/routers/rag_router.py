from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from agents.legal_rag_agent import LegalRAGAgent

router = APIRouter(prefix="/api/v1/agents", tags=["Agents"])
rag_agent = LegalRAGAgent()


class RAGRequest(BaseModel):
    query: str = Field(min_length=1, max_length=10000)
    limit: int = Field(default=5, ge=1, le=50)


@router.post("/rag")
async def query_legal_rag(request: RAGRequest):
    result = rag_agent.execute(request.model_dump())
    if result["status"] == "error":
        raise HTTPException(status_code=400, detail=result["message"])
    return result
