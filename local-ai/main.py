from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers.agent_router import router as agent_router
from routers.rag_router import router as rag_router

app = FastAPI(title="Legal Clay Local AI Core API", version="3.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=False, allow_methods=["GET", "POST"], allow_headers=["*"])
app.include_router(agent_router)
app.include_router(rag_router)


@app.get("/health")
def health_check():
    return {"status": "healthy", "engine": "Legal Clay Local AI Stack", "rag": "qdrant"}
