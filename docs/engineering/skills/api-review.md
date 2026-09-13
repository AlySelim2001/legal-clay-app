# Skill: api-review

**Type:** project-local engineering skill (TYPE G).

## Purpose

Convex functions (queries/mutations/actions) keep server-side auth, input
validation, rate limits, and audit logging — the API boundary is a security
boundary (§17).

## Inputs

- Diffs adding or modifying `src/convex/*.ts` public functions.

## Process

1. **Auth on every handler** — identity resolved server-side; anonymous
   sessions still carry a `userId`. No handler trusts client-claimed roles.
2. **Input validation** — Convex validators strict; Arabic text normalized at
   the boundary, stored verbatim.
3. **Ownership** — user-scoped reads/writes filter by `userId`; admin paths
   verify the server-side role gate. IDOR tests for cross-user access (403).
4. **Rate limits + audit** — expensive actions (ask, upload, role claim,
   review) gated and logged; log lines carry no PII.
5. **Action hygiene** — actions that would call models stay behind provider
   adapters (§27/§54); no keys read outside `process.env` in `"use node"`
   files.
6. **Internal vs public** — internal functions are not client-reachable;
   seeds/admin jobs stay internal.

## Validation

- [ ] Validators reject malformed input (test included).
- [ ] Cross-user access test passes (403).
- [ ] Rate-limit + audit test for each new sensitive action.

## Failure conditions

- A public handler without auth; client-supplied role trusted; PII in logs.

## Output

- Reviewed diff + tests, or rejection naming the gap.
