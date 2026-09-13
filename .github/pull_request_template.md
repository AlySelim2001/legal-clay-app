<!--
PR checklist — reviewers verify items, they are not read aloud.
Skill references: docs/engineering/skills/
-->

## What & why

<!-- One paragraph: the lawyer/citizen workflow problem being solved. -->
<!-- OSS changes: link the decision record draft in docs/OSS_DECISIONS.md. -->

## Affected surfaces

- [ ] Web (src/) · [ ] Convex (src/convex/) · [ ] local-ai services
- [ ] Android (android/) · [ ] Flutter (mobile_app/) · [ ] Docker/compose
- [ ] Docs only

## Applicable skill checklists

<!-- Delete rows that do not apply. Reviewers: verify, don't trust. -->

| Skill | Checked |
|-------|---------|
| [security-review](../docs/engineering/skills/security-review.md) — §17/§18 sweep done | |
| [api-review](../docs/engineering/skills/api-review.md) — auth/ownership/rate-limit/audit on new handlers | |
| [mobile-ui-review](../docs/engineering/skills/mobile-ui-review.md) — RTL + Claymorphism + 360px pass | |
| [legal-rag-review](../docs/engineering/skills/legal-rag-review.md) — eval suite green, abstention intact | |
| [legal-source-review](../docs/engineering/skills/legal-source-review.md) — official provenance for new knowledge | |
| [citation-review](../docs/engineering/skills/citation-review.md) — every legal claim carries a source | |
| [document-review](../docs/engineering/skills/document-review.md) — hash/provenance/advisory labels | |
| [database-review](../docs/engineering/skills/database-review.md) — schema wired, seeds idempotent | |
| [oss-intake](../docs/engineering/skills/oss-intake.md) — new dep registered + license verified | |
| [test-review](../docs/engineering/skills/test-review.md) — failing-first tests pin the invariant | |

## Legal sensitivity ⚠️

Does this PR touch **deadline math, hearing dates, procedural ordering, or
statute citations**?

- [ ] No
- [ ] Yes → cited source (law/article/ruling) in description,
      known-good test data, `legal-sensitive` label, **two approvals**
      (code + legal-domain), advisory wording preserved.

## Verification (executed, with output)

<!-- verification-before-completion: quote the command + exit code. -->

```
$ bunx tsc -b --noEmit          # exit __
$ bunx convex dev --once        # exit __ (if Convex touched)
$ node scripts/oss-registry-lint.mjs   # exit __ (if deps/registry touched)
$ node scripts/generate-sbom.mjs       # (if deps changed — SBOM refreshed)
```

## OSS provenance (TYPE E/G extracts only)

- Upstream repo + commit SHA:
- License (SPDX) + evidence:
- Files used + modifications:
- Registered in config/oss_registry.yaml: [x] [ ]
