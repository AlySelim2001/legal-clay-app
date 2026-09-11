"""
CRIM-SYS 2026 — RAG ingestion (local-only).

Flow:  file → OCR(optional) → PRESIDIO SCRUB (hard gate) → Arabic semantic
chunking → bge-m3 embeddings (local HF model) → Qdrant collection.

Security invariants:
  1. A document that fails scrubbing (risk == "blocked") is NEVER embedded
     and NEVER stored — the pipeline aborts before the vector step.
  2. Embeddings run from a local HuggingFace snapshot (HF_HUB_OFFLINE=1 in
     the container), so no document bytes ever leave the machine.
  3. Qdrant requires an API key and is only reachable on ai-internal.

Run inside the legal-backend container:
  python rag_ingestion.py --input-dir /data/raw --collection legal_docs
"""

from __future__ import annotations

import argparse
import hashlib
import logging
import os
import re
import sys
import time
from pathlib import Path

import httpx

# ---------------------------------------------------------------------------
# Config (all values injected by docker-compose; no secrets in code)
# ---------------------------------------------------------------------------
SCRUBBER_URL = os.environ.get("SCRUBBER_URL", "http://presidio-scrubber:8100")
INTERNAL_API_KEY = os.environ.get("INTERNAL_API_KEY", "")
if not INTERNAL_API_KEY or len(INTERNAL_API_KEY) < 32:
    raise RuntimeError("INTERNAL_API_KEY missing — refusing to run.")

QDRANT_URL = os.environ.get("QDRANT_URL", "http://qdrant-vectorstore:6333")
QDRANT_API_KEY = os.environ.get("QDRANT_API_KEY", "")
EMBED_MODEL = os.environ.get("EMBED_MODEL", "BAAI/bge-m3")
COLLECTION = os.environ.get("QDRANT_COLLECTION", "legal_docs")
CHUNK_SIZE = int(os.environ.get("CHUNK_SIZE", "768"))
CHUNK_OVERLAP = int(os.environ.get("CHUNK_OVERLAP", "128"))
SCRUB_MIN_GAP_MS = int(os.environ.get("SCRUB_MIN_GAP_MS", "0"))

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)
logger = logging.getLogger("rag_ingestion")

_client = httpx.Client(
    headers={"X-Internal-Key": INTERNAL_API_KEY},
    timeout=httpx.Timeout(120.0, connect=10.0),
)

# ---------------------------------------------------------------------------
# Step 1 — PII scrub (hard gate)
# ---------------------------------------------------------------------------
_last_scrub_ts = 0.0


def scrub_text(text: str) -> str:
    """Scrub PII. Raises RuntimeError on any failure — caller aborts."""
    global _last_scrub_ts
    if SCRUB_MIN_GAP_MS:
        wait = SCRUB_MIN_GAP_MS / 1000 - (time.monotonic() - _last_scrub_ts)
        if wait > 0:
            time.sleep(wait)
    _last_scrub_ts = time.monotonic()

    try:
        r = _client.post(f"{SCRUBBER_URL}/scrub", json={"text": text})
        r.raise_for_status()
    except httpx.HTTPError as exc:
        raise RuntimeError(f"scrubber unreachable: {exc}") from exc

    data = r.json()
    risk = data.get("risk")
    if risk == "blocked":
        # Scrubber itself failed — fail-safe: refuse to ingest.
        raise RuntimeError("scrubber returned blocked; document rejected")
    if risk == "scrubbed":
        findings = ", ".join(sorted({f["entity"] for f in data.get("findings", [])}))
        logger.info("PII scrubbed before embedding (%s)", findings)
    return data["scrubbed_text"]


# ---------------------------------------------------------------------------
# Step 2 — Arabic-aware semantic chunking
# ---------------------------------------------------------------------------
import re  # noqa: F811  (kept at step scope for readability)

# Legal Arabic sentence enders + statutory clause markers ("مادة ١...").
_SENTENCE_RE = re.compile(r"(?<=[.!?؟؛۔])\s+")
_CLAUSE_RE = re.compile(r"(?=(?:مادة|المادة)\s+[\d\u0660-\u0669]+)")


def semantic_chunks(text: str, size: int, overlap: int) -> list[str]:
    """
    Sentence-aware chunking tuned for legal Arabic:
      * split first on sentence enders (., ؟, ؛, ۔, !)
      * never start a chunk mid-clause: prefer breaking before "مادة N"
      * hard cap at `size` chars with `overlap` chars carried over
    """
    # Split into candidate segments at statutory clause boundaries.
    segments: list[str] = []
    for clause in _CLAUSE_RE.split(text):
        segments.extend(s for s in _SENTENCE_RE.split(clause) if s.strip())

    chunks: list[str] = []
    current: list[str] = []
    current_len = 0
    for seg in segments:
        seg = seg.strip()
        if not seg:
            continue
        if current_len + len(seg) + 1 > size and current:
            chunks.append(" ".join(current))
            # carry overlap tail
            tail: list[str] = []
            tail_len = 0
            while current and tail_len < overlap:
                popped = current.pop()
                tail.insert(0, popped)
                tail_len += len(popped) + 1
            current = tail
            current_len = sum(len(s) + 1 for s in current)
        current.append(seg)
        current_len += len(seg) + 1
    if current:
        chunks.append(" ".join(current))
    return [c for c in chunks if len(c) >= 40]  # drop micro-chunks


# ---------------------------------------------------------------------------
# Step 3 — Embeddings (local bge-m3) + Qdrant
# ---------------------------------------------------------------------------
def get_embed_model():
    from llama_index.embeddings.huggingface import HuggingFaceEmbedding

    return HuggingFaceEmbedding(model_name=EMBED_MODEL, device="cpu")


def ensure_collection(dimension: int) -> None:
    from qdrant_client import QdrantClient, models

    client = QdrantClient(url=QDRANT_URL, api_key=QDRANT_API_KEY or None, timeout=30)
    if not client.collection_exists(COLLECTION):
        client.create_collection(
            collection_name=COLLECTION,
            vectors_config=models.VectorParams(
                size=dimension,
                distance=models.Distance.COSINE,
            ),
        )
        logger.info("created Qdrant collection %s (dim=%d)", COLLECTION, dimension)
    client.close()


def ingest_file(path: Path, embed_model) -> int:
    from llama_index.core import Document

    suffix = path.suffix.lower()
    if suffix in {".txt", ".md"}:
        raw = path.read_text(encoding="utf-8", errors="replace")
    elif suffix in {".pdf", ".docx", ".png", ".jpg", ".jpeg"}:
        # Binary formats: delegate to the OCR/extract service so this script
        # stays pure-python-light. The extract endpoint returns plain text.
        raw = _extract_via_ocr(path)
    else:
        logger.warning("skipping unsupported file %s", path.name)
        return 0

    if not raw.strip():
        logger.warning("empty document: %s", path.name)
        return 0

    try:
        clean = scrub_text(raw)  # HARD GATE
    except RuntimeError as exc:
        logger.error("REJECTED %s: %s", path.name, exc)
        return 0

    chunks = semantic_chunks(clean, CHUNK_SIZE, CHUNK_OVERLAP)
    if not chunks:
        return 0

    vectors = embed_model.get_text_embedding_batch(chunks)
    from qdrant_client import QdrantClient, models

    client = QdrantClient(url=QDRANT_URL, api_key=QDRANT_API_KEY or None, timeout=60)
    doc_id = hashlib.sha256(clean[:4096].encode("utf-8")).hexdigest()[:16]
    points = [
        models.PointStruct(
            id=str(__import__("uuid").uuid4()),
            vector=vec,
            payload={
                "doc_id": doc_id,
                "source": path.name,
                "chunk_index": i,
                "text": chunk,
                "scrubbed": True,
                "ingested_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            },
        )
        for i, (chunk, vec) in enumerate(zip(chunks, vectors))
    ]
    client.upsert(collection_name=COLLECTION, points=points, wait=True)
    client.close()
    logger.info("ingested %s → %d chunks", path.name, len(chunks))
    return len(chunks)


def _extract_via_ocr(path: Path) -> str:
    """Send binary docs to the OCR service (internal, authenticated)."""
    mime = {
        ".pdf": "application/pdf",
        ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
    }.get(path.suffix.lower(), "application/octet-stream")
    with path.open("rb") as fh:
        r = _client.post(
            f"{os.environ.get('OCR_URL', 'http://paddle-ocr-service:8200')}/ocr",
            files={"file": (path.name, fh, mime)},
        )
    r.raise_for_status()
    return r.json()["text"]


# ---------------------------------------------------------------------------
def main() -> int:
    parser = argparse.ArgumentParser(description="CRIM-SYS legal RAG ingestion")
    parser.add_argument("--input-dir", default="/data/raw")
    parser.add_argument("--collection", default=COLLECTION)
    args = parser.parse_args()

    input_dir = Path(args.input_dir)
    if not input_dir.is_dir():
        logger.error("input dir missing: %s", input_dir)
        return 2

    files = sorted(
        p for p in input_dir.rglob("*")
        if p.is_file() and p.suffix.lower() in {
            ".txt", ".md", ".pdf", ".docx", ".png", ".jpg", ".jpeg"
        }
    )
    if not files:
        logger.info("nothing to ingest in %s", input_dir)
        return 0

    embed_model = get_embed_model()
    dimension = len(embed_model.get_text_embedding("probe"))
    ensure_collection(dimension)

    total = 0
    for f in files:
        try:
            total += ingest_file(f, embed_model)
        except Exception:  # noqa: BLE001 — keep ingesting other files
            logger.exception("failed to ingest %s", f.name)
    logger.info("ingestion complete: %d chunks across %d files", total, len(files))
    return 0


if __name__ == "__main__":
    sys.exit(main())
