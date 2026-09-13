# Skill: legal-source-review

**Type:** project-local engineering skill (TYPE G — development infrastructure,
never shipped in the app).

## Purpose

Guard the authoritative legal knowledge layer (§24 Legal Data Rule). Nothing —
scraper output, GitHub datasets, or AI-generated summaries — enters
`legalSources` / `legalArticles` / `documentChunks` without publisher,
version, and temporal verification plus human approval. **A repository
containing legal documents is NOT an authoritative source.**

## Inputs

- Proposed source: official gazette link (الجريدة الرسمية), publisher,
  law number/year, article locators, verbatim text.
- Proposed chunk: source key, article reference, effective-from/to dates.

## Process

1. **Publisher verification** — official publisher only (المطبوعات الرسمية /
   الجريدة الرسمية / النيابة العامة portal / محكمة النقض). Blogs, Wikipedia,
   aggregators, GitHub mirrors: REJECT for the authoritative layer — at best
   they are `PUBLIC_NON_AUTHORITATIVE` reference material (§25).
2. **Version & temporal verification** — effective dates, amendments, and
   repealed provisions recorded (`effectiveFrom`/`effectiveTo`). Historical
   versions remain retrievable; the pipeline serves the current effective text.
3. **Verbatim rule** — evidence text stored verbatim with its source locator
   (law / article / paragraph). Any normalization is display-only; never
   replaces stored text.
4. **Domain boundary** — interpretation layers (guides, rights topics,
   answers) *cite* sources; they never *become* sources (§23).
5. **Machine cross-check** — figures (deadlines, penalties) compared against
   the audited deadline-engine constants. Conflicts are flagged `CONFLICTING`,
   never silently resolved.
6. **Human review** — submit via AdminKnowledge (REVIEW → PUBLISHED); reviewer
   identity recorded in the audit log. AI never publishes.

## Validation (all true before merge)

- [ ] Publisher official — or item quarantined as non-authoritative.
- [ ] Law number/year + article locator present; verbatim text preserved.
- [ ] Temporal validity set; conflicts flagged, not merged.
- [ ] Deadline/penalty figures carry the two-approver `legal-sensitive` rule.
- [ ] Evaluation suite (TEST-001…010) still passes after ingestion.

## Failure conditions (any ⇒ reject)

- No official provenance; unverifiable version; paraphrase replacing verbatim
  text; disagreement resolved by silently picking one side.

## Output

- `PUBLISHED` knowledge items with full provenance, **or** a REJECTED entry
  with reason recorded in the audit log.
