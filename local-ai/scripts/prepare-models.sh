#!/usr/bin/env bash
# ============================================================================
# CRIM-SYS 2026 — one-shot model + index preparation (LOCAL ONLY step).
# The only internet access this script performs is pulling open-weight models
# (Ollama registry + HuggingFace) ONCE. The runtime stack stays air-gapped.
# ============================================================================
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
cd "$HERE/.."

echo "== 1/4  Pulling LLMs into the local Ollama volume =="
docker compose exec ollama-engine ollama pull qwen2.5:7b
docker compose exec ollama-engine ollama pull nomic-embed-text     # Ragas eval embeddings
# Optional Arabic-native alternative (larger):
# docker compose exec ollama-engine ollama pull jais-family-13b

echo "== 2/4  Pre-caching bge-m3 into ./data/models (offline runtime cache) =="
docker compose run --rm --no-deps ingest python - <<'PY'
from sentence_transformers import SentenceTransformer
m = SentenceTransformer("BAAI/bge-m3")
m.save("/models/st/bge-m3")
print("bge-m3 cached at /models/st/bge-m3")
PY

echo "== 3/4  Waiting for scrubber + qdrant health =="
docker compose up -d presidio-scrubber qdrant-vectorstore
sleep 10

echo "== 4/4  Ingesting documents from ./data/raw (PII-scrubbed) =="
docker compose run --rm ingest

echo "Done. Ask the pipeline:  curl -s -X POST http://127.0.0.1:8300/analyze \\"
echo "  -H \"X-Internal-Key: $INTERNAL_API_KEY\" -H 'Content-Type: application/json' \\"
echo "  -d '{\"question\":\"ما هي مدة الطعن بالنقض في الأحوال الشخصية؟\"}'"
