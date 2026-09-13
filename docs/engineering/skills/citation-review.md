# Skill: citation-review

**Type:** project-local engineering skill (TYPE G).

## Purpose

Every legal claim a user can see — answer cards, guides, rights topics, README
assertions, alert templates — carries a *checkable* citation (P-03 source
transparency). Uncited legal statements are either removed or explicitly
demoted to advisory text ("استرشادي").

## Inputs

- Any user-visible legal statement and its proposed citation.

## Process

1. **Locate** — citation resolves to source + article + locator; links point
   to official text or the registry entry (not aggregator mirrors).
2. **Entailment** — does the cited text actually support the claim
   (TEST-010 discipline)? No "related article" stretching.
3. **Effectiveness** — current effective version; historical claims marked as
   historical (TEST-008/009 discipline).
4. **Figures** — deadlines/penalties must match the audited deadline-engine
   constants. Discrepancies are fixed at the *source* level and flagged
   `CONFLICTING` — never papered over in copy.
5. **Vagueness sweep** — "القانون المصري", "المادة ١", dead official links
   without archived provenance: all reject-grade.

## Validation

- [ ] Citation resolves; entailment holds; effectiveness current.
- [ ] Figures match the engine constants.
- [ ] Uncited statements carry the advisory label + disclaimer.

## Failure conditions

- Vague or dead citations; engine-divergent figures presented as fact.

## Output

- Claims with live citations, or demoted-to-advisory copy.
