from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from pydantic import BaseModel

from agents.legal_auditor_agent import LegalAuditorAgent

router = APIRouter(prefix="/api/v1/agents", tags=["Agents"])
auditor_agent = LegalAuditorAgent()


class AuditRequest(BaseModel):
    document_text: Optional[str] = ""
    code_snippet: Optional[str] = ""


@router.post("/audit-text")
async def audit_legal_text(request: AuditRequest):
    result = auditor_agent.execute({
        "document_text": request.document_text,
        "code_snippet": request.code_snippet,
    })
    return result


@router.post("/audit-document")
async def audit_legal_document(
    file: UploadFile = File(...),
    code_snippet: Optional[str] = Form(""),
):
    if not file.filename:
        raise HTTPException(status_code=400, detail="Uploaded file is missing a filename.")

    contents = await file.read()
    result = auditor_agent.execute({
        "file_bytes": contents,
        "filename": file.filename,
        "code_snippet": code_snippet or "",
    })
    return result


__all__ = ["router"]
