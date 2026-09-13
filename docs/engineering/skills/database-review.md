# Skill: database-review

**Type:** project-local engineering skill (TYPE G).

## Purpose

Schema and data changes keep the Convex data model coherent, indexed, owned,
and idempotent — no drift, no mystery tables.

## Inputs

- Diffs to `src/convex/schema.ts`, indexes, seeding, or data migrations.

## Process

1. **Indexes justified** by actual queries — no unindexed hot paths, no
   unused index bloat.
2. **Ownership & workflow fields** — `userId` on user-owned tables; status
   enums wherever workflows (review, publication, sync) need them.
3. **Seeding idempotent** — keyed upserts, re-runnable, never destructive;
   seeds carry provenance (who/what/when).
4. **Generated types refreshed** via `bunx convex dev --once` — never
   hand-edit `src/convex/_generated/*`.
5. **Data classification** — legal knowledge = authoritative-only (see
   `legal-source-review`); user documents = private by default.

## Validation

- [ ] `bunx convex dev --once` + `bunx tsc -b --noEmit` green.
- [ ] Idempotency demonstrated (seed runs twice, no duplicates).
- [ ] No full-scan reads on hot paths.

## Failure conditions

- Schema drift (tables defined but not wired into `defineSchema` — the
  historical bug); missing ownership fields on user-owned tables.

## Output

- Schema diff + regenerated types + green checks.
