# Skill: verification-before-completion

**Type:** project-local engineering skill (TYPE G).

## Purpose

No "done" claims without executed verification. The agent/developer must run
the checks and show output — the historical failure mode is declaring success
from assumptions (or hand-patching generated files to silence errors).

## Inputs

- The task's definition of done + the repo's canonical check commands.

## Process

1. **Run, don't infer** — execute:
   - Convex changes: `bunx convex dev --once` (never interactive; never
     without `--once`), then `bunx tsc -b --noEmit`.
   - Frontend changes: `bunx tsc -b --noEmit`.
   - Registry changes: `node scripts/oss-registry-lint.mjs`.
   - SBOM changes: `node scripts/generate-sbom.mjs`.
2. **Read the output** — exit code + last lines quoted in the summary.
   "Should compile" is a failed verification.
3. **Generated files are outputs** — `_generated/*` refreshed by codegen only;
   hand-edits are a violation even when they silence a type error.
4. **Deadlocks surfaced, not hidden** — if a gate blocks (e.g. stale
   `_generated` from a failed push), state the exact blocking error and the
   unblock step; do not skip the check silently.
5. **Runtime spot-check** — UI changes verified in the preview (no blank
   screen, no broken styles, no hook errors) before reporting completion.

## Validation

- [ ] Each canonical command executed with exit code recorded.
- [ ] Fix loops continued until commands pass (or a concrete blocker is
      reported with its error text).
- [ ] No generated-file hand-edits in the diff.

## Failure conditions

- Claiming completion with unexecuted checks; "fixing" `_generated` by hand;
  ignoring reported errors.

## Output

- Completion summary quoting command + exit code per check.
