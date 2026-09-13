# Skill: oss-intake

**Type:** project-local engineering skill (TYPE G — development infrastructure,
never shipped in the app).

## Purpose

Turn "I found a GitHub repo that does X" into a governed decision: either a
registered, pinned, tested component — or a documented rejection. Prevents
blind cloning, unlicensed copying, duplicate logic, and architecture capture.

## Inputs

- Repository URL + the specific capability needed (one sentence).
- The use case in the product (which page/service, what data touches it).

## Process

1. **Duplicate check** — search `src/`, `local-ai/`, `android/`, `mobile_app/`
   for existing implementations. If adequate: STOP → record rejection in
   `docs/OSS_DECISIONS.md` (improvement of in-house code is the alternative).
2. **License gate** — SPDX + LICENSE file + distribution-model compatibility
   (see OSS_LICENSES verdicts). Unclear ⇒ `LICENSE_UNVERIFIED` ⇒ reject.
3. **Tier + maintenance check** — Tiers 1–4 normal; 5 needs justification;
   6 rejected. Look at last commit/release, open-issue responsiveness.
4. **Architecture check** — which boundary does it sit behind? If it would
   enter the domain layer or dictate legal logic: redesign or reject.
5. **Security check** — §17 checklist in OSS_SECURITY.md; §18 red flags are
   auto-reject. Check install scripts and outbound calls in the package.
6. **Sandbox** (TYPE D/E/G) — build under `sandbox/oss/<name>/`, exercise the
   API, measure performance, then extract only what survives.
7. **Register** — `config/oss_registry.yaml` (components or default_licenses),
   set tier/type/update_policy/security_notes/review date.
8. **Integrate** — feature branch `feature/oss/<name>`; adapter at the
   boundary; tests (unit + integration) pinned to behavior we rely on.
9. **Verify** — `node scripts/oss-registry-lint.mjs` green;
   `node scripts/generate-sbom.mjs` regenerated; typecheck/tests green.
10. **Document** — decision record in OSS_DECISIONS.md; update OSS_REGISTRY.md
    inventory; provenance row (OSS_REGISTRY.md §9) for any TYPE E extract.

## Validation (all must be true before merge)

- [ ] Lint passes with the new entry (no unregistered deps remain).
- [ ] SBOM regenerated; component appears with license enrichment.
- [ ] License verdict recorded with evidence (LICENSE path/SPDX source).
- [ ] Security checklist completed; any accepted risk written down.
- [ ] Tests covering the integrated behavior exist and pass.
- [ ] No floating refs; version pinned; update_policy set.

## Failure conditions (any ⇒ stop and reject)

- License cannot be verified or is incompatible with our distribution model.
- Red-flag code found (§18) without documented, justified containment.
- Functionality already exists in-repo with equal or better quality.
- Component would become the authority over Egyptian legal interpretation.
- No meaningful test suite AND no way to write our own integration tests.

## Output

- Registered component + tests + docs + SBOM row, **or**
- A DECISIONS entry explaining the rejection (with reconsideration condition).
