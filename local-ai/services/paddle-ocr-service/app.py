"""
CRIM-SYS 2026 — Arabic OCR service (PaddleOCR lang=ar).

Contract:
  POST /ocr   multipart file=...  ->  {"text": "...", "pages": N, "confidence": 0.98}
  GET  /health                    ->  {"status": "ok"}

Auth: X-Internal-Key header (same shared key as every ai-internal service).
Logging rule: request metadata only — never log OCR output (court files and
case sheets carry client PII; the log pipeline is not a PII-safe surface).
"""

from __future__ import annotations

import hmac
import logging
import os

from fastapi import FastAPI, File, Header, HTTPException, UploadFile
from paddleocr import PaddleOCR

INTERNAL_API_KEY = os.environ.get("INTERNAL_API_KEY", "")
if not INTERNAL_API_KEY or len(INTERNAL_API_KEY) < 32:
    raise RuntimeError("INTERNAL_API_KEY missing or too short — refusing to boot.")

MAX_BYTES = 20 * 1024 * 1024  # 20 MB scan cap
ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp", "image/tiff", "application/pdf"}

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("paddle-ocr-service")

# Loaded once per process: Arabic + angle classifier, CPU inference.
ocr = PaddleOCR(use_angle_cls=True, lang="ar", show_log=False)

app = FastAPI(title="CRIM-SYS OCR", docs_url=None, redoc_url=None)


@app.middleware("http")
async def _auth(request, call_next):
    key = request.headers.get("X-Internal-Key", "")
    if not hmac.compare_digest(key, INTERNAL_API_KEY):
        raise HTTPException(status_code=401, detail="unauthorized")
    return await call_next(request)


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.post("/ocr")
async def ocr_endpoint(
    file: UploadFile = File(...),
    x_internal_key: str = Header(default=""),
) -> dict:
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(status_code=415, detail="unsupported file type")
    payload = await file.read()
    if len(payload) > MAX_BYTES:
        raise HTTPException(status_code=413, detail="file too large")

    try:
        result = ocr.ocr(payload, cls=True)
    except Exception:  # noqa: BLE001
        logger.exception("OCR failed for a %s upload (%d bytes)",
                         file.content_type, len(payload))
        raise HTTPException(status_code=500, detail="ocr_failed")

    texts, scores, pages = [], [], 0
    for page in result or []:
        pages += 1
        for line in page or []:
            _, (text, conf) = line
            texts.append(text)
            scores.append(float(conf))

    avg_conf = sum(scores) / len(scores) if scores else 0.0
    logger.info("OCR done: pages=%d lines=%d avg_conf=%.3f", pages, len(texts), avg_conf)
    return {"text": "\n".join(texts), "pages": pages, "confidence": round(avg_conf, 4)}
