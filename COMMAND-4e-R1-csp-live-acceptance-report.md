# COMMAND-4e-R1 — CSP Remediation & Live E2EE Re-Acceptance Report

## 1. Project Identity & Root Verification

| Field | Value |
|---|---|
| Project | legal-clay-app |
| Absolute root | `/root/legal-clay-app` |
| Git branch | `main` |
| HEAD commit | `5dd7e24` (build(android): ?N-26 complete 360 APK audit...) |
| Package manager | npm (package.json, package-lock.json, bun.lock also present) |
| Test runner | Playwright (`npm test` → `playwright test`, testDir: `./tests/e2e`) |
| Unit test runner | Jest (in `my-app/`, currently misconfigured — react-native preset invalid) |

## 2. CSP Policy — Before and After

### Before (original, committed)

```
default-src 'self';
script-src 'self' 'unsafe-inline' 'unsafe-eval';
style-src 'self' 'unsafe-inline';
img-src 'self' data: blob:;
font-src 'self' data:;
connect-src 'self' https://*.supabase.co https://*.supabase.in wss://*.supabase.co;
frame-ancestors 'none';
```

### After (current working tree, modified in `index.html`)

```
default-src 'self';
script-src 'self' 'unsafe-inline' 'unsafe-eval';
style-src 'self' 'unsafe-inline';
img-src 'self' data: blob:;
font-src 'self' data:;
connect-src 'self' https://*.supabase.co https://*.supabase.in wss://*.supabase.co http://127.0.0.1:3210 ws://127.0.0.1:3210;
frame-ancestors 'none';
```

### Difference

| Aspect | Before | After | Change |
|---|---|---|---|
| `connect-src` | `'self'` + Supabase HTTPS/WSS | Same + `http://127.0.0.1:3210` + `ws://127.0.0.1:3210` | **Added only** |
| `script-src` | `'self' 'unsafe-inline' 'unsafe-eval'` | Unchanged | No change |
| `style-src` | `'self' 'unsafe-inline'` | Unchanged | No change |
| `default-src` | `'self'` | Unchanged | No change |
| `frame-ancestors` | `'none'` | Unchanged | No change |
| Wildcard `*` | Absent | Absent | None added |
| `unsafe-eval`/`unsafe-inline` in connect-src | Absent | Absent | None added |

## 3. Convex URL Source

- `VITE_CONVEX_URL=http://127.0.0.1:3210` in `.env.local` (development Convex dev server)
- `.env.example` has `VITE_CONVEX_URL=` (empty, to be filled by operator)
- No Convex client is imported in frontend source currently; `src/convex/` contains only server-side schema/auth/http files
- No server-side CSP headers (Dockerfile/nginx config does not set CSP; only the HTML `<meta>` tag applies)

## 4. Files Changed During This Session

| File | Change |
|---|---|
| `index.html` | Added `http://127.0.0.1:3210 ws://127.0.0.1:3210` to `connect-src` |

### Pre-existing modifications (NOT from this session — present before work began)

| File | Nature |
|---|---|
| `src/convex/auth.config.ts` | Variable rename (`Ma??tIssuer` → `vlyIssuer`) |
| `src/convex/auth/emailOtp.ts` | OTP API key sourced from env var instead of hardcoded |
| `src/index.css` | Tailwind `@apply` changes (`touch-padding` → `p-3`) |

## 5. Security Verification (Phase C)

| Check | Result | Evidence |
|---|---|---|
| Previous connect-src sources preserved | PASS | `'self'`, `https://*.supabase.co`, `https://*.supabase.in`, `wss://*.supabase.co` all present unchanged |
| No `*` or public/wildcard sources added | PASS | Only `127.0.0.1:3210` (loopback dev) added |
| No `unsafe-eval`/`unsafe-inline` added to connect-src | PASS | None present |
| Other CSP directives unchanged | PASS | `default-src`, `script-src`, `style-src`, `img-src`, `font-src`, `frame-ancestors` identical |
| No server-side CSP conflict | PASS | No `_headers`, nginx CSP, or Docker CSP found; only HTML meta tag |

## 6. Live E2EE Acceptance Test Discovery (Phase D)

| Item | Status | Evidence |
|---|---|---|
| `tests/e2e/e2ee-acceptance.spec.ts` | **NOT FOUND** | `ls tests/e2e/` shows only: auth.spec.ts, cases.spec.ts, dashboard.spec.ts, deadlines.spec.ts, helpers.ts, layout-rtl.spec.ts, navigation.spec.ts, pages.spec.ts |
| `tests/e2e/` directory | EXISTS | Contains 8 Playwright spec files (none E2EE-related) |
| `tests/unit/` directory | NOT FOUND | |
| `docs/` directory | NOT FOUND | |
| `docs/audit/` directory | NOT FOUND | |
| Any E2EE-related files | NOT FOUND | `grep -rn "e2ee\|E2EE\|envelope\|Envelope"` returned no matches |

**Decision:** Per COMMAND-4e-R1 constraint #7 — no alternative E2EE test file was created. Live E2EE acceptance cannot be executed because the specified test file does not exist in this repository.

## 7. Test Results (Phase E)

| Test | Command | Result | Exit Code | Notes |
|---|---|---|---|---|
| TypeScript | `npx tsc --noEmit` | **PASS** | 0 | Clean, no errors |
| Unit tests (my-app/ Jest) | `npx jest` | **BLOCKED** | — | Invalid react-native preset config; cannot run |
| Playwright E2E | `npx playwright test` | NOT RUN | — | Requires dev server; no E2EE spec exists |
| Live E2EE acceptance | N/A | **NOT RUN** | — | `tests/e2e/e2ee-acceptance.spec.ts` does not exist |

## 8. Gates G1–G10

| Gate | Description | Status | Reason |
|---|---|---|---|
| G1 | Confirm correct Development environment | NOT RUN | No live Convex deployment verified; `.env.local` points to `127.0.0.1:3210` but dev server not confirmed running |
| G2 | Create E2EE Envelope via live Convex | NOT RUN | No E2EE acceptance test file exists |
| G3 | Retrieve Envelope after page reload | NOT RUN | No live test available |
| G4 | Recovery phrase restoration after reload | NOT RUN | No live test available |
| G5 | Wrong password rejection | NOT RUN | No live test available |
| G6 | Multi-account isolation | NOT RUN | No live test available |
| G7 | Concurrent write conflict prevention | NOT RUN | No live test available |
| G8 | No secret leakage to console/logs | NOT RUN | No live test available |
| G9 | TypeScript + related tests pass | PARTIAL | TypeScript PASS; unit tests BLOCKED (jest config invalid) |
| G10 | Update evidence report | NOT RUN | Report being produced here |

## 9. Live vs Mock/Stub Separation

- **Live tests:** None executed. No `tests/e2e/e2ee-acceptance.spec.ts` exists; no live Convex environment was started or verified.
- **Mock/stub/unit tests:** TypeScript compilation passed (static analysis only, not runtime). Jest unit tests could not run due to invalid configuration.
- **No mock or stub result is presented as live acceptance.**

## 10. Remaining Risks

1. **Missing E2EE acceptance test:** `tests/e2e/e2ee-acceptance.spec.ts` referenced in COMMAND-4e does not exist in this repository. Live E2EE acceptance cannot be verified without it.
2. **Missing docs/ directory:** No `docs/audit/` location exists for the final report per the original command specification.
3. **Jest misconfiguration:** `my-app/` unit tests cannot run due to invalid react-native preset.
4. **No live Convex deployment verified:** `.env.local` points to `127.0.0.1:3210` but the Convex dev server was not started or confirmed during this session.
5. **Pre-existing modifications:** `src/convex/auth.config.ts`, `src/convex/auth/emailOtp.ts`, `src/index.css` show uncommitted changes not made in this session — their provenance should be verified separately.

## 11. Recommendation

**Status: NOT READY**

The CSP remediation itself is complete and minimally scoped (only `index.html` connect-src extended with the two Convex dev loopback URLs). However, live E2EE re-acceptance cannot be completed because:

1. `tests/e2e/e2ee-acceptance.spec.ts` does not exist in this repository.
2. No `docs/audit/` path exists to store the final report per the original command specification.
3. No live Convex development environment was verified running.

No commit, push, merge, or deploy has been performed. The working tree contains only the `index.html` CSP change from this session (plus pre-existing unrelated modifications).

**Next step justified by evidence:** Either create the missing E2EE acceptance test (requires separate authorization) or confirm the correct path to the existing test if it resides elsewhere, then verify a live Convex dev server before attempting G1–G8.