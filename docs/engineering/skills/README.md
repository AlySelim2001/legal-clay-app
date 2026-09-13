# Project Engineering Skills

Project-local development infrastructure (TYPE G — per the OSS master prompt
§8/§37/§38). These skills are **policy documents**, not runtime code: they
never ship inside the application. They encode how changes are reviewed in
this repository, derived from the Superpowers-class methodology
(brainstorm → spec → plan → TDD → implement → review → verify → merge)
translated into legal-tech-specific gates.

## Index

| Skill | Implements | Use when touching |
|-------|-----------|-------------------|
| [oss-intake](oss-intake.md) | §2–§22 lifecycle, license/tier gates | Adding any external repo, dependency, or extract |
| [legal-source-review](legal-source-review.md) | §24–§25 legal data rule | Knowledge base sources, articles, chunks |
| [legal-rag-review](legal-rag-review.md) | §28–§30 RAG rules | `evidence.ts`, retrievers, embeddings, answers |
| [citation-review](citation-review.md) | P-03 / §29 citations | Any user-visible legal claim |
| [security-review](security-review.md) | §17–§18 audit lists | Auth, files, network, prompts, secrets |
| [document-review](document-review.md) | §32 document analysis | Upload, OCR, hashing, comparison |
| [database-review](database-review.md) | §19–§21 dependency/data hygiene | Convex schema, seeds, indexes |
| [api-review](api-review.md) | §17 API boundaries | Convex functions, rate limits, audit |
| [mobile-ui-review](mobile-ui-review.md) | §33–§35 UI rules | Pages, components, RTL, external UI libs |
| [test-review](test-review.md) | §49 quality scoring | Any PR (test planning) |
| [release-review](release-review.md) | §43–§45, §51–§52 | Version bumps, tags, SBOM refresh |
| [verification-before-completion](verification-before-completion.md) | §2 MONITOR/UPDATE | Every task's definition of done |

## Methodology translation

The generic loop maps onto this repo's gates:

```
BRAINSTORMING   → issue/feature request (what lawyer-workflow problem?)
SPECIFICATION   → decision record draft in docs/OSS_DECISIONS.md (for OSS)
PLAN            → todos + affected-surfaces list in the PR body
TDD             → test-review: failing-first tests pinning the invariant
IMPLEMENTATION  → architecture adapters at boundaries; domain stays ours
REVIEW          → the applicable skills above (checklists in PR template)
VERIFICATION    → verification-before-completion (executed checks, quoted output)
MERGE           → git strategy §40: feature/oss/* branches, separate commits
```

## Adding a new skill

One file per skill, same section order (Purpose / Inputs / Process /
Validation / Failure conditions / Output). Link it in this index and, when it
gates a PR category, in `.github/pull_request_template.md`.
