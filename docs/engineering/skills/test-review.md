# Skill: test-review

**Type:** project-local engineering skill (TYPE G).

## Purpose

Tests prove *behavior we rely on*, especially the legal invariants — not
coverage theater. New features arrive with failing-first tests; security and
deadline logic cannot merge without them.

## Inputs

- PR diff + the tests accompanying it (`local-ai/tests/`, Playwright specs,
  Android/Flutter test suites, eval runner).

## Process

1. **Map tests to invariants** — every PR names which invariant its tests
   pin: deadline math (dual-engine agreement), IDOR/ownership, injection
   defense, PII fail-closed, abstention behavior, rate limits.
2. **Legal figures** — test data uses known-good examples with cited sources;
   expected values come from the audited engine, not the implementation
   under test.
3. **No mocking the thing under test** — security tests exercise real guards;
   mocks limited to externals (models, network).
4. **Flake discipline** — timing-based tests fixed with virtual clocks/
   deterministic seeds; flaky tests quarantined with an owner + deadline, not
   silently skipped.
5. **Eval suite** — TEST-001…010 runs green; any behavioral change to
   retrieval/answers updates the suite *with justification* (legal-rag-review).

## Validation

- [ ] New tests fail on the pre-fix code (spot-checked).
- [ ] Full suite green locally; no skipped security/deadline tests.
- [ ] Eval runner output attached for RAG-affecting PRs.

## Failure conditions

- PRs touching deadlines/auth/PII without tests; tests asserting the
  implementation's own outputs as truth.

## Output

- Test plan section in the PR + merged tests.
