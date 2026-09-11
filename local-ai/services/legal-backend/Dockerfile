# CRIM-SYS 2026 — legal-backend (RAG + CrewAI orchestration, local-only)
# Script surface kept in sync: crew_pipeline.py, rag_ingestion.py,
# egyptian_legal_matrix.py, cassation_precedents.py
FROM python:3.10-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    # HuggingFace: resolve models from the local cache only — the backend
    # must never fetch model weights or anything else at runtime.
    HF_HUB_OFFLINE=1 \
    TRANSFORMERS_OFFLINE=1

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential g++ git curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

COPY crew_pipeline.py rag_ingestion.py \
     egyptian_legal_matrix.py cassation_precedents.py /app/

# Model cache volume (populated once via scripts/prepare-models.sh so the
# air-gapped runtime never touches the internet).
VOLUME ["/models"]
ENV HF_HOME=/models/hf \
    SENTENCE_TRANSFORMERS_HOME=/models/st

# Non-root runtime user.
RUN useradd --system --uid 10003 backend \
    && chown -R backend:backend /app
USER backend

EXPOSE 8300
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD curl -fsS http://127.0.0.1:8300/health || exit 1

CMD ["uvicorn", "crew_pipeline:app", "--host", "127.0.0.1", "--port", "8300", "--workers", "1"]
