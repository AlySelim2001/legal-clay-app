# Zero-Trust Architecture — Local AI Stack (`local-ai/`)

> Status: **CANONICAL**. `local-ai/docker-compose.yml` is the sole approved
> production topology. Any competing draft is rejected on sight; changes land
> only through PRs that pass the CI security pipeline (`.github/workflows/ci.yml`).

## 1. Topology at a glance

```
                      ┌──────────────────── edge ────────────────────┐
                      │  n8n  (sole internet-facing bridge: Telegram)│
                      │  127.0.0.1:5678                              │
                      └───────┬──────────────────────────┬───────────┘
                              │ internal DNS + key       │ HTTPS → t.me
              ┌───────────────┴───────────────────────────┴───────────┐
              │                ai-internal  (internal: true)          │
              │        NO internet egress — verified failing ping     │
              │                                                       │
              │  court-scraper ──► presidio-scrubber ──► legal-backend│
              │  (Playwright)      (PII GATE, :8100)      (CrewAI+RAG)│
              │                           │                │      │   │
              │  paddle-ocr-service ──────┘                ▼      ▼   │
              │  (Arabic OCR, :8200)            ollama-engine  qdrant │
              │                                 (LLM, no port) (:6333)│
              └───────────────────────────────────────────────────────┘
   Host bindings: ONLY 127.0.0.1 (8100/8200/8300/8400/5678) — smoke tests.
   ollama-engine and qdrant-vectorstore publish NO ports at all.
```

| Service | Image / build | Ports | Network | Auth |
|---|---|---|---|---|
| `ollama-engine` | `ollama/ollama:0.5.7` | none | ai-internal | network isolation |
| `qdrant-vectorstore` | `qdrant/qdrant:v1.11.3` | none | ai-internal | `QDRANT_API_KEY` |
| `presidio-scrubber` | build `services/presidio-scrubber` | 127.0.0.1:8100 | ai-internal | `INTERNAL_API_KEY` |
| `paddle-ocr-service` | build `services/paddle-ocr-service` | 127.0.0.1:8200 | ai-internal | `INTERNAL_API_KEY` |
| `legal-backend-api` | build `services/legal-backend` | 127.0.0.1:8300 | ai-internal | `INTERNAL_API_KEY` |
| `court-scraper` | build `services/court-scraper` | 127.0.0.1:8400 | ai-internal | `INTERNAL_API_KEY` |
| `ingest` | build `services/legal-backend` | none | ai-internal | profile-gated tool |
| `legal-matrix-ingest` | build `services/legal-backend` | none | ai-internal | profile-gated tool |
| `frontend-ui` | build `services/frontend` | 127.0.0.1:3000 | ai-internal | nginx-injected key |
| `n8n` | `n8nio/n8n:1.62.1` | 127.0.0.1:5678 | edge + ai-internal | encryption key + basic auth |

## 2. The PII gate (non-negotiable)

Every byte of case text passes `presidio-scrubber` **before** chunking,
embedding, or any LLM call. The gate is **fail-closed at three levels**:

1. **Boot level** — the service refuses to start unless
   `INTERNAL_API_KEY` is set and ≥ 32 chars (`app.py` raises `RuntimeError`).
2. **Request level** — every call is authenticated with a constant-time
   comparison (`hmac.compare_digest`); no key, no service.
3. **Data level** — text that triggers `risk == "blocked"` is **never**
   chunked or embedded (`rag_ingestion.py` raises); an *unreachable*
   scrubber also rejects the document rather than bypassing the gate.

The Egyptian National ID recognizer (`egyptian_nid.py`) validates the
14-digit structure, governorate codes (01 Cairo … 88 born-abroad), and the
Luhn-style check digit; it normalizes Arabic-Indic OCR digits (٠-٩) with an
offset-preserving translation. Unit-tested 14/14 (valid IDs, checksum
failures, phone numbers, embedded Arabic text, offset mapping).

## 3. Fail-safe RAG & CrewAI pipeline

- `legal-backend-api` runs a three-agent CrewAI chain over Ollama
  (`qwen2.5:7b` primary, `jais-family-13b` alternate) — 100% local inference.
- Every answer passes `evaluate_rag_response()` (Ragas faithfulness).
  Threshold `FAITHFULNESS_THRESHOLD=0.95` (compose-injected).
  **Any evaluation error scores 0.0 → the pre-defined legal blocking
  message is returned, never hallucinated content.**

### 3.1 The Egyptian Legal Knowledge Matrix

`services/legal-backend/egyptian_legal_matrix.py` upserts structured
workflow knowledge into the same `legal_docs` collection: forgery defense
(الطعن بالتزوير)، custody-receipt defense (انتفاء ركن التسليم)، extortion
and false-report counter-action, police-station and prosecution protocols,
the multi-tier court map, and the official digital gateways (PPO / Ministry
of Justice / Digital Egypt).

Two integrity mechanisms are built in:

1. **Citation review gates.** Every entry carries `review_status`:
   `statute_verified` (article number confirmed against Egyptian law),
   `needs_legal_review` (procedure encoded, article numbers deliberately
   withheld until counsel approves), or `portal_unverified` (gateway URL
   pending re-confirmation). The retrieval layer must surface
   `review_status` with every answer — un-reviewed entries are advisory
   only. No unverified article number is ever encoded.
2. **Deterministic idempotency.** Point IDs are `uuid5` of
   `collection/entry/part`, so re-running overwrites in place; `--fresh`
   wipes `kind=legal_matrix` points so removed entries disappear too.

Run (profile-gated, never started by `up`):

```bash
cd local-ai
make legal-matrix              # upsert all matrix entries (scrub-first)
docker compose run --rm legal-matrix-ingest --fresh    # wipe + re-ingest
docker compose run --rm legal-matrix-ingest --dry-run  # schema check only
```

All matrix text passes the same PII scrub gate before embedding; the
matrix adds 35 retrievable points across 10 workflow entries.

### 3.2 The Accessible Citizen UI (`frontend-ui`)

`services/frontend` is a React + Vite + Tailwind v4 SPA (RTL, `ar-EG`)
behind an **nginx sidecar** — the only way the browser reaches the
pipeline. `INTERNAL_API_KEY` is injected into nginx server-side at
container start (`NGINX_ENVSUBST_FILTER` limits substitution to that one
variable); the browser bundle contains **no secrets**.

Accessibility architecture (WCAG 2.2 AAA targets):

- **Contrast-verified themes** — base clay, high-contrast black/yellow
  (14.7:1), deuteranopia-safe (blue/orange axis), tritanopia-safe; every
  body-text pair ≥ 7:1.
- **Dynamic typography** — 100% / 125% / 200% root-size scales; the whole
  layout is rem-based so nothing breaks (WCAG 1.4.4).
- **Touch targets ≥ 56px** everywhere; the Emergency Mode buttons are
  ~112px with 4px borders.
- **Screen reader support** — semantic landmarks, labelled groups,
  `aria-pressed` toggles, polite + assertive ARIA live regions for legal
  alerts, visible `:focus-visible` outlines, skip link.
- **Voice out/in** — TTS playback with sentence-synced caption
  highlighting (karaoke pattern); STT via the Web Speech API with honest,
  announced fallbacks ("use the text box" — never a silent failure).
  The TTS/STT seams are designed for a Piper-TTS / local ASR container
  swap without changing call sites.
- **One-Tap Emergency Mode** — three giant buttons: scan the receipt,
  speak your complaint, emergency legal steps (with spoken walkthrough).

Honesty gates in the UI: the scanner shows OCR progress only (no fake
forgery-detection stages), blocked pipeline answers surface the legal
hold message verbatim with the Ragas score and trace id, and the
portals hub states that government gateways are independent of this
tool.

## 4. Supply-chain & secrets

- Upstream images **pinned by tag** (`ollama/ollama:0.5.7`,
  `qdrant/qdrant:v1.11.3`, `n8nio/n8n:1.62.1`). No `:latest` pulls.
  Locally built `crimsys/*` images are version-pinned in the compose file.
- All secrets come from `local-ai/.env`, generated by
  `scripts/gen-env.sh` (`openssl rand -hex 32`, `chmod 600`). The repo
  intentionally ships **no `.env.example`** — placeholders get deployed
  unchanged; the generator cannot. Compose `:?` interpolation guards make
  the stack refuse to boot with unset secrets.
- `.gitignore` excludes `.env`, `*.key`, all `data/` sub-stores (raw case
  documents, Qdrant/Ollama/n8n state).

## 5. Timezone & legal operations

`GENERIC_TIMEZONE=Africa/Cairo` and `TZ=Africa/Cairo` pin all n8n cron
triggers (daily Court of Cassation / Official Gazette monitoring) and the
Telegram delivery window to Cairo time — legal publication timing is part
of the deadline logic, not a cosmetic setting.

## 6. CI enforcement (`.github/workflows/ci.yml`)

| Check | What it proves |
|---|---|
| Bandit SAST (`-lll`) | no hardcoded secrets / unsafe calls in services |
| Flake8 E9/F + Bandit S1/S3/S5/S6 | syntax, logic errors, injection risks |
| Ruff gate (E4,E7,E9,F,S) | identical rule set pinned across toolchains |
| compose YAML parse + build contexts | topology is internally consistent |
| `docker compose config` with dummy secrets | fail-closed `:?` guards satisfiable |
| Resolved-port `host_ip` assertion | every published port binds 127.0.0.1 |
| Upstream image hygiene | no `:latest` pulls, no non-existent images |

## 7. Runbook (authoritative commands)

```bash
cd local-ai
make env        # generate .env (openssl secrets, chmod 600) — fill TELEGRAM_*
make models     # ollama pull qwen2.5:7b + bge-m3 embeddings
make up         # docker compose up -d --build
make smoke      # every service must answer {"status":"ok"} on loopback
make ingest     # scrub-first ingestion into Qdrant
make ask Q="سؤالك القانوني"   # gated pipeline call
make import-n8n # import the daily court-monitor workflow
make down
```

Pre-flight gates (all **mandatory** before first launch):
secrets `chmod 600` + git-ignored · scrubber refuses boot without key ·
`docker compose ps` shows loopback-only bindings · `ping 8.8.8.8` from
`ai-internal` fails · Qdrant returns 401 without `API-KEY` ·
`ollama list` shows both models · `data/` empty before first ingest.
