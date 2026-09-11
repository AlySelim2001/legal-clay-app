# CRIM-SYS 2026 — PaddleOCR service (Arabic legal documents, local-only)
# Slim base + prebuilt Paddle wheels (no CUDA — CPU inference is sufficient
# for document scans and keeps the image/stack fully local).
FROM python:3.10-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    # OpenCV headless wheels still need these runtime libs on slim images.
    LIBGL_ALWAYS_SOFTWARE=1

WORKDIR /app

# Runtime libs: OpenCV needs libglib2.0 + libgl1; Paddle needs libgomp.
# ttf-arabic fonts are for the optional debug rendering of boxes.
RUN apt-get update && apt-get install -y --no-install-recommends \
        libglib2.0-0 \
        libgl1 \
        libgomp1 \
        curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

COPY app.py /app/app.py

# Model weights are downloaded once at build time into /models so the
# container never phones home at runtime (air-gap friendly).
ENV PADDLE_HOME=/models
RUN mkdir -p /models && python - <<'PY'
from paddleocr import PaddleOCR
# Download + verify the Arabic detection/recognition models at build time.
ocr = PaddleOCR(use_angle_cls=True, lang="ar", show_log=False)
print("Arabic OCR models cached at build time.")
PY

# Non-root runtime user; /models must stay readable.
RUN useradd --system --uid 10002 ocrsvc \
    && chown -R ocrsvc:ocrsvc /app /models
USER ocrsvc

EXPOSE 8200
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD curl -fsS http://127.0.0.1:8200/health || exit 1

CMD ["uvicorn", "app:app", "--host", "127.0.0.1", "--port", "8200", "--workers", "1"]
