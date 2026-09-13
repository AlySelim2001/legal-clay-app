# Skill: security-review

**Type:** project-local engineering skill (TYPE G).

## Purpose

Apply the §17 security-audit and §18 red-flag lists to every PR touching
auth, files, network, prompts, secrets, or dependencies. Red flags are
auto-reject unless contained and documented.

## Inputs

- The diff + affected surfaces (web, Convex, local-ai services, Android,
  Flutter, Docker compose).

## Process

1. **§17 sweep** for each touched area: authentication, authorization, file
   handling, network calls / external URLs, telemetry, subprocess & dynamic
   execution, unsafe deserialization, query construction, HTML rendering,
   prompt construction, secret handling, Docker privileges, filesystem access,
   SSRF, dependency & supply-chain risk.
2. **§18 red flags** = reject: `eval`/`exec`/`os.system`, runtime package
   installs, remote code download, obfuscated or base64-executable payloads,
   hardcoded credentials, hidden telemetry/tracking, untrusted CDNs, unsigned
   binaries, excessive permissions. Documented containment only (e.g.
   allowlisted-egress scraper subprocess) after explicit approval.
3. **IDOR sweep** — every Convex query/mutation enforces ownership
   (`userId` equality), anonymous sessions included; admin paths check server
   roles, never client-supplied ones.
4. **Injection & PII** — uploaded documents are DATA, never instructions;
   screening flags injection markers; PII scrubbing fails *closed* (local
   Presidio + NID patterns incl. Arabic-Indic digits).
5. **Secrets & telemetry** — no keys in code/logs/CI; platform secrets only;
   no new outbound calls or analytics without review (§3).
6. **Guards stay on** — sensitive actions (ask, upload, admin, role claim)
   keep rate limits and audit logging.

## Validation

- [ ] Checklist green per touched area; no unresolved red flags.
- [ ] Guard tests exist (e.g., 403 for foreign document).
- [ ] No telemetry or egress added.

## Failure conditions

- Any red flag unresolved; a guard removed; PII path fails open.

## Output

- Security sign-off section in the PR + `docs/OSS_SECURITY.md` update when a
  dependency or security posture changed.
