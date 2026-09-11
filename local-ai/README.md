# CRIM-SYS 2026 — Local AI Stack (100% Localhost)

Zero-paid-API legal intelligence: **Ollama** (qwen2.5:7b / jais-family-13b) + **Qdrant** + **LlamaIndex RAG** (bge-m3) + **CrewAI** (3 agents) + **Presidio PII scrubbing** (Egyptian NID) + **PaddleOCR (ar)** + **n8n automation**.

```
                    ┌────────────────────────── edge (internet) ─────────────┐
                    │  n8n ───► Telegram Bot API (the ONLY external egress)  │
                    └───┬────────────────────────────────▲───────────────────┘
                        │ X-Internal-Key                 │ alert on hold/block
                        ▼                                │
┌─────────────────────── ai-internal (internal: true, no egress) ───────────────┐
│                                                                              │
│  court-scraper ──► presidio-scrubber ──► legal-backend-api ──► ollama-engine │
│  (Playwright,       (Egyptian NID +        │  ├─ crew_pipeline.py             │
│  robots-aware)       PERSON redaction)     │  │   3 agents + Ragas ≥0.95 gate │
│                                            │  └─ rag_ingestion.py             │
│  paddle-ocr-service ──► (scrubbed text) ───┘        │                       │
│  (PaddleOCR lang=ar)                                ▼                       │
│                                            qdrant-vectorstore (API key)     │
└──────────────────────────────────────────────────────────────────────────────┘
```

## Fail-safe contract (non-negotiable)

| Gate | Where | Behaviour |
|---|---|---|
| PII scrub (input) | `presidio-scrubber` before ANY LLM/vector call | scrubber down/error → `risk=blocked` → request never reaches a model |
| PII scrub (output) | backend scrubs model output too | blocked → legal hold message |
| Ragas faithfulness | `evaluate_rag_response()` | `< 0.95` (or eval error) → رسالة الحجب القانونية |
| Retrieval empty | backend | hold message (never hallucinate from nothing) |

## Secrets (copy to `local-ai/.env` — never committed)

```bash
cp local-ai/.env.example local-ai/.env   # then fill:
```

| Variable | Generate / obtain |
|---|---|
| `INTERNAL_API_KEY` | `openssl rand -hex 32` — shared key for all internal service calls |
| `QDRANT_API_KEY` | `openssl rand -hex 32` |
| `N8N_ENCRYPTION_KEY` | `openssl rand -hex 32` |
| `N8N_USER` / `N8N_PASSWORD` | `openssl rand -base64 18` for the password |
| `PRIMARY_MODEL` | `qwen2.5:7b` (default) or `jais-family-13b` |
| `TELEGRAM_BOT_TOKEN` | @BotFather → /newbot |
| `TELEGRAM_CHANNEL_ID` | closed lawyers' channel id (negative `-100…`) |
| `TELEGRAM_ADMIN_CHAT_ID` | your private chat — holds/blocks/errors go here, never to the channel |

> The platform manages env values through its Keys/API-keys UI — the file above is for a self-hosted/docker deployment outside that UI.

## Unified run commands

```bash
# One-time setup
cd local-ai
cp .env.example .env && $EDITOR .env      # generate secrets (see table)
docker compose build                       # builds OCR models into image (ar)
docker compose up -d                       # full stack
bash scripts/prepare-models.sh             # pull LLMs + bge-m3 cache + ingest docs

# Daily use
make ingest      # re-index documents dropped into ./data/raw
make smoke       # end-to-end health check of all internal services
make ask Q="..." # query the pipeline
make import-n8n  # import workflows/daily-court-monitor.json (n8n UI → Import from File)

# Teardown / reset
docker compose down                 # keeps data
docker compose down -v              # wipes qdrant/ollama volumes (destructive)
```

## Security checklist (before first run)

- [ ] `.env` generated with `openssl rand -hex 32` values; file permissions `chmod 600`
- [ ] `.env` is git-ignored (verify: `git check-ignore local-ai/.env`)
- [ ] All host ports bind to `127.0.0.1` only (compose does this — do not change to `0.0.0.0`)
- [ ] `ai-internal` network has `internal: true` (no egress) — verified by `docker network inspect`
- [ ] Scrubber refuses to boot without `INTERNAL_API_KEY` ≥ 32 chars (fail-closed)
- [ ] Telegram token kept only in `.env`; the channel is closed; admin alerts go to a private chat
- [ ] Legal hold message verified end-to-end: force a low-faithfulness query and confirm حجب, not model output
- [ ] OCR/scrubber/backend logs contain no document text (audit: `docker compose logs | grep -c <sample PII>` → 0)
