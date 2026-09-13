# Skill: release-review

**Type:** project-local engineering skill (TYPE G).

## Purpose

Releases ship what the docs claim — registered deps, fresh SBOM, green gates,
honest changelogs, and no unverified legal figures.

## Inputs

- Version bump / tag candidate (web PWA build, Capacitor APK, Docker stack).

## Process

1. **Gates green** — `bun tsc -b --noEmit`, lint, tests, eval suite;
   `node scripts/oss-registry-lint.mjs` exit 0.
2. **SBOM fresh** — `node scripts/generate-sbom.mjs` regenerated in the
   release commit; `license_enriched` ratio not degraded.
3. **Registry truth** — every dependency in the shipped artifact is
   registered with license + update_policy; no `LICENSE_UNVERIFIED` in
   production surfaces (lint enforces).
4. **Legal copy** — disclaimer surfaces unchanged in behavior; no new legal
   figures without the two-approver rule; versioned legal texts still point
   at current-effective sources.
5. **Secrets & config sweep** — no keys in artifacts; `.env` untouched in
   history; CSP intact (Convex endpoints allowed, nothing broader).
6. **Artifacts reproducible** — pinned versions everywhere; tag annotated
   with the SBOM hash; release notes list OSS changes (added/updated/
   removed + license).

## Validation

- [ ] All CI checks green on the release commit.
- [ ] SBOM hash recorded in release notes.
- [ ] Android release checklist (android/RELEASE_CHECKLIST.md) completed when
      shipping the APK.

## Failure conditions

- Red gates, stale SBOM, unregistered deps in the artifact, or legal changes
  bypassing review.

## Output

- Annotated tag + release notes with OSS delta and SBOM hash.
