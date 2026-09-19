# OSS Security — CRIM-SYS 2026

Companion to [`OSS_REGISTRY.md`](OSS_REGISTRY.md). Scope: security posture of
third-party components **and** the checks run before/after integrating them.

Last review: **2026-09-13**

## 1. Pre-integration audit checklist (§17 of policy)

Every candidate is inspected for: authn/authz assumptions, file handling,
outbound network calls, telemetry/analytics, shell/subprocess use, dynamic
code execution (`eval`/`exec`/`new Function`), unsafe deserialization, SQL
construction, HTML rendering sinks, prompt construction (for AI components),
secret handling, env-var requirements, Docker privileges, filesystem access,
SSRF potential, dependency vulnerabilities, supply-chain risk (install
scripts, postinstall downloads, install-count anomalies).

## 2. Red-flag scan (§18) — results for integrated components

Automated greps are run against first-party services in CI (bandit, `-lll`).
For third-party packages, the scan was performed at registration time:

| Surface | Checked | Findings |
|---|---|---|
| web (npm 101) | postinstall scripts, telemetry endpoints, dynamic eval | clean — no postinstall network fetchers among direct deps; `tesseract.js` fetches WASM/lang data on demand (origin-reviewed URLs only) |
| local-ai (py) | subprocess/os.system/eval, egress targets | clean — bandit -lll green in CI; scraper egress limited to official court domains by service policy |
| docker images | official images, digest pinning recommended | ollama/qdrant/n8n official; pinned by tag — digest pinning is a TODO upgrade |
| android | artifact provenance | all androidx/google/jetbrains except 5 registered specialized libs (see registry) |
| flutter | pub.dev verified publisher | all registered packages from verified publishers; sqlcipher binding is the audited fork |

**Known accepted risks (tracked, not open):**
1. `@vly-ai/integrations` — platform-managed runtime; license evidence =
   SPDX declaration only. Contained by CSP (connect-src allowlist).
2. `n8n` — Sustainable Use License + broad workflow capabilities; mitigated
   by internal-network binding only (no published ports) and no secrets in
   workflow definitions.
3. Browser-exposed keys (`VITE_*`) for hosted optional features — accepted
   for demo-grade features; production rule = proxy through Convex/local
   backend (documented in dependency-decisions.md).

## 3. Scanning tooling inventory

| Check | Tool | Where |
|---|---|---|
| SAST (python) | bandit + flake8-bandit | `.github/workflows/main.yml` (`security-audit`, `-lll`) |
| Lint (python) | flake8, ruff | main.yml (`security-audit`) |
| Registry gate | `scripts/oss-registry-lint.mjs` | this workfile; scheduled in main.yml (`security-audit`) |
| SBOM | `scripts/generate-sbom.mjs` (CycloneDX 1.5) | main.yml (`security-audit`) |
| npm advisories | `npm audit --omit=dev` (report-only) | main.yml (dispatch; promotion to *gating* blocked on triaging the existing dev-tool advisory backlog) |
| Container scan | *not yet wired* — candidate: trivy (TYPE F) | open item |
| Secret scanning | *not yet wired* — candidate: gitleaks (TYPE F) | open item |
| e2e security contracts | @playwright/test (auth redirects, session timeout) | tests/e2e |

## 4. Supply-chain rules in force

- No floating refs (git/main/latest) — lint-enforced.
- Direct deps pinned (caret ranges pinned in lockfiles; python `==` pins).
- Python stacks upgrade **as a set** (llama-index/qdrant/transformers
  compatibility note in requirements.txt headers).
- Every registry entry carries an explicit `update_policy`
  (default `SECURITY_ONLY`).
- `rejected:` list prevents zombie re-proposals of unsafe/unnecessary deps.

## 5. Vulnerability response

1. Advisory lands (Dependabot/audit/manual) on a registered component.
2. Flag component `SECURITY_UPDATE_REQUIRED` in the YAML + open a decision
   note in `docs/OSS_DECISIONS.md`.
3. Evaluate: exploitability in *our* usage (many advisories don't apply).
4. Patch (pin bump) → test (typecheck, e2e, bandit) → deploy.
5. Document (registry `security_notes` + DECISIONS entry).

**Precedents recorded:** `xlsx` ≥ 0.19.3 required (CVE-2023-30533 prototype
pollution); Radix/react/advisory watch is covered by weekly audit workflow.

## 6. Application-layer context (why component XSS/injection matters here)

- All user/document text is rendered as text nodes (no `dangerouslySetInnerHTML`
  in knowledge-platform pages); documents are DATA (injection screening runs
  server-side, T-002).
- CSP restricts connect-src (Convex/Supabase/localhost only) and
  frame-ancestors 'none'.
- Convex functions enforce per-user ownership on reads/writes (IDOR tests in
  the evaluation suite, TEST-007).
