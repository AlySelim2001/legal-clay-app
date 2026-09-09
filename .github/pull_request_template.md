<div dir="ltr">

## 📋 Pull Request — CRIM-SYS 2026

> **One logical change per PR.** Mixed refactors + features get bounced —
> see [CONTRIBUTING.md](../CONTRIBUTING.md).

### What does this PR change?

<!-- Feature / fix / refactor / docs — and the *why*, not just the what -->

Closes #

### Scope

- [ ] 📱 Native Android (`android/app/src/main/java/...`)
- [ ] 🌐 Web reference app (`src/`)
- [ ] 📚 Documentation only
- [ ] 🔧 Build / CI / tooling

### Architecture checklist (native changes)

- [ ] Repository/use-case returns go through `net.crimsys.app.core.Result` — no raw throws across layers
- [ ] ViewModel state uses `StateFlow`; one-shot events use `SharedFlow`; no `GlobalScope`, no `runBlocking`
- [ ] Dependencies injected via Hilt (`@HiltViewModel` / `AppModule`) — no manual service lookups
- [ ] Room stays the single source of truth; reads are reactive DAO `Flow`s
- [ ] The change works with **airplane mode ON** (local write → queue enqueue → opportunistic push)

### UI checklist (any user-facing change)

- [ ] All strings via `stringResource(R.string.…)` in **both** `values/` and `values-ar/`
- [ ] RTL-safe: logical (start/end) spacing only, verified on an Arabic locale device/emulator
- [ ] Web pages keep `<html dir="rtl" lang="ar">` and use `ms-*`/`me-*`/`ps-*`/`pe-*` utilities

### Legal-sensitive gate ⚖️

Does this PR touch **deadline calculations, hearing dates, procedural ordering,
or statute citations**?

- [ ] **No** → skip this section
- [ ] **Yes** → all of the following are included:
  - [ ] Exact legal source cited (law number + article / Cassation ruling)
  - [ ] Unit tests with known-good legal examples (e.g., appeal window from CPC 150/1950)
  - [ ] `legal-sensitive` label applied; two approvals requested (code + legal-domain reviewer)
  - [ ] Output remains *advisory* — surfaced with "verify with the responsible attorney"

### Verification

```bash
cd android && ./gradlew assembleDebug :app:lintDebug   # native module
bun tsc -b --noEmit && bun run lint                    # web reference app
```

- [ ] Both commands above pass locally
- [ ] Docs updated where behavior changed (README / `android/README.md` / strings / CHANGELOG)
- [ ] No secrets committed (`keystore.properties`, `crimsys-release.jks`, `google-services.json`)

</div>
