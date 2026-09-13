# Skill: legal-rag-review

**Type:** project-local engineering skill (TYPE G — development infrastructure).

## Purpose

Keep the Evidence-First RAG pipeline honest (§28–30). Any change to retrieval,
ranking, chunking, embeddings, or answer composition must preserve:
provenance, verbatim text, temporal validity, exposed scores, and
**abstention**. External RAG projects contribute *techniques* (TYPE D/E) —
never wholesale architecture.

## Inputs

- Any diff touching `src/convex/lib/evidence.ts`, `src/rag/*`,
  `src/convex/legal.ts`, embedding functions, or seed chunking.

## Process

1. **Invariants checklist** — does the diff preserve: (a) verbatim chunk text,
   (b) source/article provenance, (c) effective-date filtering, (d) retrieval
   scores surfaced to the UI, (e) deterministic answer composition from
   evidence only, (f) NO SOURCE → NO LEGAL CLAIM (abstain), (g) citation
   statuses (`SUPPORTED` / `OUTDATED` / `UNVERIFIED` / `CONFLICTING`)?
2. **LLM boundary** — model output is never a citation source; invented
   article numbers are structurally impossible because composition is
   deterministic. Confirm the diff does not move composition into a model call.
3. **Regression eval** — run the evaluation runner (TEST-001…010):
   exact-support ⇒ `SUPPORTED`; no evidence ⇒ `ABSTAIN`; invented article ⇒
   `REJECT`; outdated source ⇒ `OUTDATED`; conflicting sources ⇒
   `CONFLICTING`; injected document ⇒ treated as DATA; cross-user document ⇒
   403; historical vs current versioning; non-entailing citation ⇒
   `UNSUPPORTED`.
4. **Arabic check** — MSA and Egyptian Ammiya queries both retrieve sensibly
   (normalization + dialect expansion intact).
5. **Alternative comparison** — borrowing a technique (BM25 variant, reranker,
   query rewrite)? Document in `docs/OSS_DECISIONS.md` why in-house
   `evidence.ts` was insufficient (§21 duplicate detection).

## Validation (all true before merge)

- [ ] Eval suite green before and after.
- [ ] Abstain path still reachable (no forced-answer fallback added).
- [ ] Scores + citations still rendered in the Ask UI.
- [ ] No new mandatory model dependency — adapters only (§27/§54).

## Failure conditions (any ⇒ reject)

- Any eval case flips expected status without a documented legal-domain
  reason; abstention removed; generation allowed to author citations.

## Output

- Merged diff + recorded eval run, **or** rejection naming the broken
  invariant.
