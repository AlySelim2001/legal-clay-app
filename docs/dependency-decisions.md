# Dependency Decisions — CRIM-SYS 2026 (legal-clay-app)

_Last updated: 2026-09-04 · Status: ratified_

This file records why the proposed "open-source integrations" dependency
manifest was **not** merged, what replaces each entry, and the current
semantic-search plan. It is the source of truth for future dependency
proposals: a package is added only when it runs in the browser, earns its
size, and cannot be replaced by a smaller equivalent.

## Policy: zero-dependency stack

The app is a **browser-only Vite + React 19 SPA** (managed environment,
no Node server runtime, no long-lived processes). Rules:

1. No Node/native packages (`vosk`, `neo4j-driver`, `pdf-parse`,
   `n8n-workflow`, server SDKs with native deps).
2. No packages that exist only to talk to a server we do not run
   (`@pinecone-database/pinecone`, `meilisearch` without a host).
3. No packages that appear not to exist on npm (`@mike-oss/legal-client`,
   `@lawglance/sdk`).
4. No heavyweight ML runtimes unless feature-gated and lazy-loaded
   (`@tensorflow/tfjs` ~1 MB+ with no model artifact; `@xenova/transformers`
   deferred).
5. External services are integrated with **plain `fetch` + API keys** and
   must degrade gracefully to the on-device engine when unconfigured.
6. Keys are never committed; they live in the project's Keys/API-keys tab
   under `VITE_`-prefixed names.

## Wishlist manifest → disposition

| Proposed dependency | Disposition | Replaced by / notes |
| --- | --- | --- |
| `@mike-oss/legal-client` | ❌ not a package | `src/integrations/mike-legal.ts` — local research/drafting facade over the legal DB, offline-graceful |
| `@lawglance/sdk` | ❌ not a package | `src/integrations/lawglance.ts` — local RAG guidance facade |
| `langchain` | ❌ rejected | `src/rag/*` — hybrid retriever with citations over the built-in Egyptian corpus |
| `ethers` | ❌ rejected | `src/blockchain/document-verification.ts` — dependency-free JSON-RPC + RFC 6979 secp256k1 signer |
| `ipfs-http-client` | ❌ rejected | minimal IPFS HTTP client in the same module |
| `vosk` (native) | ❌ native/Node | `vosk-browser@0.0.8` (real WASM engine) + `src/voice/court-session-recorder.ts` |
| `neo4j-driver` | ❌ needs bolt server | `src/lib/knowledge-graph` (in-memory) + `src/knowledge-graph/legal-knowledge-graph.ts` facade, lift-ready |
| `@tensorflow/tfjs` | ❌ rejected | `src/analytics/predictive-analytics.ts` — explainable precedent scoring (no weights to train/serve) |
| `pdf-lib` | ✅ installed | Browser PDF append — powers e-signature + generated PDF reports |
| `pdf-parse` | ❌ Node-only | Not needed: documents are created/embedded client-side |
| `meilisearch` | ❌ needs server | Local index + OCR + fuzzy retrieval in `src/rag/retriever.ts` |
| `n8n-workflow` | ❌ workflow engine | Not applicable in an SPA |
| `@pinecone-database/pinecone` | ❌ rejected | Hosted vector search integrated via plain REST instead (below) |
| `@xenova/transformers` | ⏸ deferred | On-device embeddings/QA — only if a real embedding need appears; lazy-load then |
| `capacitor@6`, `tesseract.js@5` (manifest versions) | ❌ stale | Actual pinned: `@capacitor/*@8`, `tesseract.js@7` |

## On-device semantic search (shipped, zero new deps)

`src/rag/retriever.ts` — Arabic-aware retrieval:

- **Normalization**: strips diacritics/tatweel, unifies أإآ→ا, ى→ي, ة→ه so
  different written forms of one word match.
- **Fuzzy morphology**: when a query token has no exact term in a document,
  character-bigram overlap (length ±3, threshold ≥ 0.55, discounted ×0.6)
  catches inflections/broken plurals that normalization cannot unify.
- Phrase-containment boost is applied on normalized text.

Consumers that inherit the improvement with no further wiring:
`src/agents/swarm-orchestrator.ts` (agent swarm), `src/integrations/mike-legal.ts`
and `src/integrations/lawglance.ts` (Legal Intelligence research flow).

## Hosted vector search (integrated, key-gated)

Service: **Turbopuffer** (serverless vector DB, REST, free tier) — chosen over
Pinecone/Atlas because it is API-key-only and browser-callable without a proxy
or heavy SDK.

Module: `src/search/hosted-vector.ts`

- `isHostedVectorConfigured()` / `hostedVectorStatus()` — feature detection.
- `HostedVectorSearch` — `upsert(records)`, `query(vector)`, `ping()` via
  `fetch` (Bearer auth), no SDK.
- `tryHostedSearch(...)` — returns `null` when unconfigured or on failure so
  callers always fall back to the on-device engine.

### Activation (requires credentials — not done yet)

1. Sign up at Turbopuffer and create an API key + namespace
   (`dimensions` per the embedder used, e.g. 384 for `multilingual-e5-small`).
2. Paste the two values into the project's **Keys/API-keys** tab:
   - `VITE_TURBOPUFFER_API_KEY`
   - `VITE_TURBOPUFFER_NAMESPACE` (e.g. `arabic-legal-docs`)
3. The app then needs an **embedding source** to vectorize Arabic chunks —
   none is bundled (no local embedder). Options:
   - a free hosted embeddings API called from the client (adds a key), or
   - enable the deferred on-device embedder (`@huggingface/transformers`) as a
     lazy-loaded chunk.
4. Upsert the corpus chunks with `upsert()`, then route search queries through
   `tryHostedSearch()` with on-device fallback.

> Security: a browser-exposed key is visible to end users. Acceptable for a
> demo; for production, proxy vector calls through a backend and keep the key
> server-side.

## Scripts from the manifest

`kg:build`, `voice:train`, `blockchain:deploy`, `rag:index`, … were `tsx`/
Node-runner scripts targeting files that do not exist and processes that the
managed environment terminates. Browser-capable equivalents run in-app:
knowledge-graph facade, session voice recorder, blockchain verifier, retriever.
No package.json script additions were made.
