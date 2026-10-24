# Project Memory Bank

## Established Rules & Architecture
• COMMAND-4e-R1 Phase A findings:
- Project: legal-clay-app at /root/legal-clay-app, branch main, HEAD 5dd7e24
- CSP already modified in index.html: added http://127.0.0.1:3210 ws://127.0.0.1:3210 to connect-src (no *, no unsafe-eval/inline)
- Other pre-existing modifications: src/convex/auth.config.ts, src/convex/auth/emailOtp.ts, src/index.css (NOT from this session)
- tests/e2e/e2ee-acceptance.spec.ts does NOT exist
- docs/ and docs/audit/ directories do NOT exist
- VITE_CONVEX_URL=http://127.0.0.1:3210 in .env.local
- Test runner: Playwright (npm test), unit tests in my-app/ (jest)
- TypeScript: npx tsc --noEmit passes cleanly
