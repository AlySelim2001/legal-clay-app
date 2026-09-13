# OSS Decisions — CRIM-SYS 2026

Append-only decision log. One record per significant candidate (accepted or
rejected), using the §47 record format. Rejections are documented so the same
candidate is not re-evaluated without new evidence; each carries a
**reconsideration condition**.

Related: [`OSS_REGISTRY.md`](OSS_REGISTRY.md) ·
[`dependency-decisions.md`](dependency-decisions.md) (the ratified
zero-dependency policy that precedes this file).

---

## DR-001 — n8n as internal automation service — **ACCEPTED (restricted)**

- **Problem:** orchestrating multi-service workflows (scraper → OCR → backend
  notifications) without bespoke glue code.
- **Alternatives:** custom FastAPI workers, Airflow (heavy), Temporal (heavy).
- **Advantages:** mature visual workflows, 400+ integrations, self-hosted.
- **Disadvantages:** Sustainable Use License (not OSI); workflow-engine risk.
- **License:** Sustainable Use — see OSS_LICENSES verdict 🔶.
- **Security:** bound to internal network only; no published ports; no secrets
  in definitions.
- **Decision:** accept as TYPE K, internal-only, `SECURITY_ONLY` updates.
- **Reason:** no OSS alternative matches the orchestration scope; restriction
  is acceptable because we neither redistribute nor resell it.
- **Rejected alternatives:** Airflow (operations weight), bespoke workers
  (maintenance surface).
- **Reconsider if:** we ever offer automation as a hosted product, or n8n
  relicenses unfavorably → replace with bespoke workers.

## DR-002 — Qdrant as local vector store — **ACCEPTED**

- **Problem:** semantic retrieval for the local RAG stack.
- **Alternatives:** pgvector (needs Postgres in stack), Chroma (embedded,
  less operationally mature at the time), Weaviate (heavier).
- **License:** Apache-2.0. **Tier 2.** Type K + qdrant-client (MIT).
- **Security:** internal network binding; API-less local mode.
- **Decision:** accept; pinned v1.11.3 with matching client pin; QUARTERLY.
- **Reconsider if:** Postgres enters the stack — pgvector would collapse two
  stores into one (tracked as a simplification opportunity, not a need).

## DR-003 — PaddleOCR for Arabic document OCR — **ACCEPTED**

- **Problem:** OCR for Arabic scanned receipts/documents (server-side).
- **Alternatives:** Tesseract (weaker Arabic line accuracy), EasyOCR (torch
  weight without accuracy win), cloud OCR (violates privacy-first).
- **License:** Apache-2.0. **Tier 3.** Type B.
- **Constraints recorded:** paddlepaddle 2.6.2 pins numpy<2.0; opencv-headless
  4.10.0.84.
- **Decision:** accept; MANUAL updates (set upgrades with numpy constraint).
- **Reconsider if:** PaddlePaddle 3.x lifts numpy<2 or Surya-class Arabic
  models prove superior under our benchmark.

## DR-004 — Ollama as LLM runtime — **ACCEPTED (adapter-mediated)**

- **Problem:** local, private LLM inference for explanation/drafting flows.
- **License:** MIT. **Tier 1.**
- **Architecture:** never called directly by domain code — behind
  `LLMProvider`; model choice is configuration (`LLM_PROVIDER=ollama`,
  `LLM_MODEL=<configured>`), never hardcoded.
- **Decision:** accept as TYPE C. **Note:** the evidence-first Q&A pipeline
  deliberately does **not** use the LLM in the answer path (deterministic
  evidence composition) — the LLM is an *optional* enhancement layer.
- **Reconsider if:** another runtime (llama.cpp server, vLLM) clearly wins on
  our hardware profile — adapter makes swap cheap.

## DR-005 — langchain — **REJECTED**

- **Problem it claimed to solve:** RAG orchestration.
- **Why rejected:** heavyweight abstraction over primitives we already own
  (`src/rag/*` hybrid retriever is auditable, Arabic-normalizing, and
  provenance-preserving); supply-chain surface of fast-moving meta-frameworks;
  license is MIT but the risk is *architecture capture*.
- **Reconsider if:** a concrete, bounded need appears that our retriever
  cannot express (none found in the evidence-first redesign).

## DR-006 — ethers / ipfs-http-client — **REJECTED**

- **Why:** replaced by dependency-free implementations
  (`src/blockchain/document-verification.ts`: JSON-RPC + RFC 6979 secp256k1;
  minimal IPFS HTTP client) — smaller audit surface, no Node polyfills.
- **Reconsider if:** on-chain document timestamping moves to production
  scale where a maintained SDK beats 200 audited lines (with covenants:
  tree-shaken import, no bundled providers).

## DR-007 — Superpowers-class agent frameworks — **REFERENCE_ONLY / TYPE G**

- **Candidates surveyed:** agentic coding-skill frameworks (brainstorm →
  spec → plan → TDD → implement → review → verify).
- **Decision:** **do not ship in the runtime app.** Extract the *methodology*
  into project-local engineering skills (`docs/engineering/`), PR template,
  and CI rules.
- **Reason:** development infrastructure, not product capability; runtime
  dependency would add supply-chain surface for zero user value.

## DR-008 — Legal corpus repositories (GitHub legal datasets) — **REJECTED as knowledge source (TYPE H rule)**

- **Why:** a GitHub repository containing statutes is **not** an authoritative
  source. Knowledge enters only via the source registry (publisher, version,
  temporal validity, content hash, human review → publish workflow).
- **Decision:** current seed knowledge is hand-curated with provenance
  notes; scraped court content (court-scraper service) enters as
  `REVIEW_PENDING` and is never auto-published.
- **Reconsider if:** an official publisher (Egyptian Gazette/جريدة رسمية
  APIs) provides machine-verifiable exports.

## DR-009 — Turbopuffer hosted vector search — **ACCEPTED (TYPE L, optional)**

- **Why:** API-key-only browser-callable vector search for optional hosted
  search; zero SDK (plain fetch); degrades to on-device engine when
  unconfigured (see dependency-decisions.md).
- **Risk recorded:** browser-exposed key = demo-grade only; production must
  proxy. **Reconsider:** at production, proxy through Convex actions.

## DR-010 — Registry + SBOM tooling (this module) — **ACCEPTED (built, not imported)**

- **Options:** cyclonedx-npm/syft (accurate but added toolchain) vs. a
  ~200-line zero-dep generator.
- **Decision:** zero-dep generator + hand-maintained registry, because the
  dependency-minimization rule (§20) applies to tooling too, and direct-dep
  inventory (not transitive closure) is the governance boundary here.
- **Reconsider if:** transitive-dependency auditing becomes a hard
  requirement → adopt syft/cyclonedx-cli as TYPE F dev tool.

---

## Candidate evaluation matrix (template)

> Score 0–5 per dimension; weights from policy (`config/oss_registry.yaml`).
> Security or license failure ⇒ automatic rejection regardless of total.

| Dimension | Weight | Notes |
|---|---|---|
| Architecture fit | 15% | adapter boundary, no domain contamination |
| Security | 20% | §17 checklist + advisories |
| License | 15% | distribution-model compatibility |
| Maintenance | 10% | releases, responsiveness, bus factor |
| Code quality | 10% | tests in repo, static hygiene |
| Testing | 10% | upstream suite + our integration tests |
| Performance | 5% | measured in sandbox for TYPE B/C |
| Mobile/runtime fit | 5% | APK size, WASM, offline |
| Documentation | 5% | security-relevant docs present |
| Community/adoption | 5% | not stars alone — issue quality |

## Open candidates

- `trivy` container scanning (TYPE F) — evaluate.
- `gitleaks` secret scanning (TYPE F) — evaluate.
- Arabic reranker model for local stack (TYPE I) — hold until retrieval
  quality benchmarks justify runtime cost.
