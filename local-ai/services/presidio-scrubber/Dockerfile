# CRIM-SYS 2026 — PII Scrubber (Microsoft Presidio + Egyptian National ID)
# Security gate: EVERY text that touches an LLM or the vector store passes
# through here first. Runs on the internal "ai-internal" network only —
# never exposed to the host, never reachable from the web tier.
FROM python:3.10-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# The spaCy model must exist at build time (fail the build, not the runtime).
RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential g++ \
    && rm -rf /var/lib/apt/lists/* \
    && pip install --no-cache-dir \
        presidio-analyzer==2.2.35 \
        presidio-anonymizer==2.2.35 \
        fastapi==0.115.0 \
        uvicorn[standard]==0.30.6 \
        spacy==3.7.5 \
    && python -m spacy download ar_core_news_sm \
    && pip uninstall -y build-essential 2>/dev/null; true

# Egyptian National ID recognizer + service code.
COPY egyptian_nid.py /app/egyptian_nid.py
COPY app.py /app/app.py

# Non-root runtime user.
RUN useradd --system --uid 10001 scrubber \
    && chown -R scrubber:scrubber /app
USER scrubber

EXPOSE 8100
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD python -c "import urllib.request;urllib.request.urlopen('http://127.0.0.1:8100/health')" || exit 1

CMD ["uvicorn", "app:app", "--host", "127.0.0.1", "--port", "8100", "--workers", "2"]
