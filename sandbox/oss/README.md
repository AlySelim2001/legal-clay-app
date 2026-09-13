# OSS Component Sandbox

Isolated evaluation area before any external component reaches production
(master prompt §39). **Nothing in this directory is shipped, imported by app
code, or included in SBOM production surfaces.**

## Protocol

1. **Create** — `sandbox/oss/<component-name>/` with a `README.md` stating:
   upstream URL, commit SHA under evaluation, license evidence link, the one
   capability being tested, and the acceptance criteria (measurable).
2. **Isolate** — the component's own install (its own lockfile). No workspace
   or dependency-graph linkage. No copying into `src/`, `local-ai/`,
   `android/`, or `mobile_app/` during evaluation.
3. **Exercise** — test the *behavior we rely on*: API surface, edge cases,
   Arabic input, error paths, resource use (RAM/CPU), bundle size.
4. **Security pass** — run the §17 checklist on the component's own install
   and runtime: install scripts, network egress, telemetry, dynamic code
   loading. Red flags (§18) ⇒ stop, record, remove.
5. **Decide** — write the decision in `docs/OSS_DECISIONS.md`
   (ACCEPT / REJECT / REFERENCE_ONLY / HOLD) with the quality score (§49).
   Only ACCEPT proceeds to `oss-intake` steps 7–10.
6. **Clean up** — accepted components are re-implemented/extracted behind
   adapters in the real tree (never the sandbox copy); rejected/obsolete
   sandboxes are deleted with their decision preserved in DECISIONS.

## Layout

```
sandbox/oss/<component-name>/
  README.md        # provenance + acceptance criteria + verdict
  <component>      # the isolated checkout/install (git-ignored if heavy)
  probe/           # our minimal exercise scripts
```

## Current evaluations

| Component | Status | Verdict | Decision link |
|-----------|--------|---------|---------------|
| — (empty) | — | — | — |

> Sandboxes are working areas; this table tracks only *open* evaluations.
> Completed verdicts live permanently in `docs/OSS_DECISIONS.md`.
