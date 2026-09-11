# CRIM-SYS 2026 — Local AI Stack (100% Localhost)

Zero-paid-API legal intelligence: **Ollama** (qwen2.5:7b / jais-family-13b) + **Qdrant** (`legal_docs` + dedicated `egypt_cassation_rulings`) + **LlamaIndex RAG** (bge-m3) + **CrewAI** (3 agents + forensic/doctrine tools) + **Presidio PII scrubbing** (Egyptian NID) + **PaddleOCR (ar) with SSIM document forensics** + **n8n automation**.

```
                    ┌────────────────────────── edge (internet) ─────────────┐
                    │  n8n ───► Telegram Bot API (the ONLY external egress)  │
                    └───┬────────────────────────────────▲───────────────────┘
                        │ X-Internal-Key                 │ alert on hold/block
                        ▼                                │
┌─────────────────────── ai-internal (internal: true, no egress) ───────────────┐
│                                                                              │
│  court-scraper ──► presidio-scrubber ──► legal-backend-api ──► ollama-engine │
│  (Playwright,       (Egyptian NID +        │  ├─ crew_pipeline.py            │
│  robots-aware)       PERSON redaction)     │  │   3 agents + Ragas ≥0.95     │
│                                            │  │   + SSIM forensics tool      │
│                                            │  │   + Cassation doctrine tool  │
│                                            │  └─ rag_ingestion.py             │
│  paddle-ocr-service ──► (scrubbed text) ───┘        │                       │
│  (PaddleOCR lang=ar + /forensics/ssim)              ▼                       │
│                                            qdrant-vectorstore (API key)     │
│                                              ├─ legal_docs                  │
│                                              └─ egypt_cassation_rulings     │
└──────────────────────────────────────────────────────────────────────────────┘
```

## Fail-safe contract (non-negotiable)

| Gate | Where | Behaviour |
|---|---|---|
| PII scrub (input) | `presidio-scrubber` before ANY LLM/vector call | scrubber down/error → `risk=blocked` → request never reaches a model |
| PII scrub (output) | backend scrubs model output too | blocked → legal hold message |
| Ragas faithfulness | `evaluate_rag_response()` | `< 0.95` (or eval error) → رسالة الحجب القانونية |
| Retrieval empty | backend | hold message (never hallucinate from nothing) |
| Citation review | matrix + Cassation entries | `needs_legal_review` / `needs_citation_review` flags must surface with the answer — un-reviewed citations are advisory only, never presented as settled law |
| Forensics honesty | `ssim_analyzer.py` | advisory signals only (`advisory_only=true`); no YOLO model mounted → `model_loaded=false`, zero fabricated detections |

## Secrets (generate into `local-ai/.env` — never committed)

```bash
make env        # runs scripts/gen-env.sh: real openssl secrets, chmod 600,
                # refuses to overwrite an existing .env
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
make env                                   # generate .env (openssl secrets, chmod 600)
docker compose build                       # builds OCR models into image (ar)
docker compose up -d                       # full stack
bash scripts/prepare-models.sh             # pull LLMs + bge-m3 cache + ingest docs

# Daily use
make ingest        # re-index documents dropped into ./data/raw
make legal-matrix  # upsert the Egyptian legal knowledge matrix (courts,
                   # police/prosecution workflows, citations, digital gateways)
                   # add --fresh to wipe + re-ingest, or --dry-run to validate
make precedents    # upsert Cassation doctrine into the dedicated
                   # egypt_cassation_rulings collection (principles only —
                   # case numbers pending counsel review; same flags)
make smoke         # end-to-end health check of all internal services
make ask Q="..."   # query the pipeline (grounded in doctrine when indexed)
make import-n8n    # import workflows/daily-court-monitor.json and
                   # workflows/case-alerts.json (n8n UI → Import from File)

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
- [ ] `case-alerts` webhook invoked only from inside `ai-internal` or `127.0.0.1` (n8n is loopback-bound; do not publish it)
