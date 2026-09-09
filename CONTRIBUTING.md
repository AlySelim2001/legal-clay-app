<div dir="rtl">

# 🤝 دليل المساهمة — Contributing to CRIM-SYS 2026

شكراً لاهتمامك بالمساهمة! هذا المشروع يتعامل مع بيانات قضايا حقيقية ومواعيد لا تحتمل الخطأ، لذلك نضع ضوابط صارمة لكن عادلة.

</div>

<div dir="ltr">

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Reporting a Bug](#reporting-a-bug)
- [Legal-Sensitivity Rule ⚠️](#legal-sensitivity-rule-️)
- [Suggesting Features](#suggesting-features)
- [Pull Request Process](#pull-request-process)
- [Architecture Rules (Mandatory)](#architecture-rules-mandatory)
- [Commit & PR Style](#commit--pr-style)

</div>

---

## Code of Conduct

By participating, you agree to abide by [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).
السلامة مهارة تقنية — والاحترام شرط للمراجعة.

---

## Reporting a Bug

1. **Search existing issues first** — [Issues](https://github.com/AlySelim2001/legal-clay-app/issues?q=is%3Aissue).
2. Open a new issue using the **🐛 Bug Report** template
   ([.github/ISSUE_TEMPLATE/bug_report.yml](.github/ISSUE_TEMPLATE/bug_report.yml)).
3. Include: device/Android version, exact steps to reproduce, expected vs. actual
   behavior, and logs (`adb logcat | grep -i crimsys`) if available.

> ⚠️ **A bug in deadline math or hearing dates is NOT a normal bug.**
> Use the dedicated **⚖️ Legal Compliance** template instead — it gets triaged first.

---

## Legal-Sensitivity Rule ⚠️

<div dir="rtl">

**القاعدة الذهبية:** أي تغيير يمسّ حساب المواعيد النهائية، تواريخ الجلسات، أو ترتيب الإجراءات القانونية يمر بمراجعة قانونية مزدوجة قبل الدمج — مهما كان صغيراً.

</div>

Any change touching **deadline calculations, hearing dates, procedural ordering, or
statute citations** must:

1. Cite the exact legal source (law number, article, Cassation ruling) in the PR
   description — "it seemed right" is not a source.
2. Include unit tests with **known-good legal examples** (e.g., a procedurally
   computed appeal window from Article X of CPC 150/1950).
3. Carry the `legal-sensitive` label and require **two approvals**: one code review
   + one review from a contributor with verified legal-domain knowledge.
4. State in the PR that the result is *advisory* — the app surfaces such values
   with "verify with the responsible attorney" everywhere.

---

## Suggesting Features

Open a **✨ Feature Request**
([.github/ISSUE_TEMPLATE/feature_request.yml](.github/ISSUE_TEMPLATE/feature_request.yml)).
Good requests describe the **lawyer's workflow problem**, not just the UI solution.
الميزة الجيدة تحل مشكلة حقيقية في مكتبي المحامي — لا "تطويراً للتطوير".

---

## Pull Request Process

1. **Fork → branch from `main`** with a descriptive name:
   `fix/deadline-rollover-hijri`, `feat/hearing-reminders`.
2. **One logical change per PR.** Mixed refactors + features get bounced.
3. Ensure the build passes locally:
   ```bash
   cd android && ./gradlew assembleDebug :app:lintDebug   # native module
   bun tsc -b --noEmit && bun run lint                    # web reference app
   ```
4. **Update documentation** when you change behavior (README, `android/README.md`,
   strings in **both** `values/` and `values-ar/`).
5. Fill the PR checklist honestly — reviewers verify each item, not just read it.

### Architecture Rules (Mandatory)

<div dir="ltr">

The native module follows Clean Architecture. PRs that violate these are rejected
regardless of code quality:

| Rule | Detail |
|---|---|
| **`Result<T>` pattern** | Every repository/use-case return is `net.crimsys.app.core.Result` (`Success`/`Error`) — no raw throws crossing layers |
| **`StateFlow` / `SharedFlow` only** | ViewModel state = `StateFlow`, one-shot events = `SharedFlow`; no `LiveData`, no `GlobalScope`, no `runBlocking` |
| **Hilt DI** | All dependencies injected (`@HiltViewModel`, `AppModule`); no manual `context.getSystemService` spaghetti |
| **Room = single source of truth** | Reads are reactive `Flow`s from DAOs; UI never caches server state separately |
| **Offline-first** | Any write must work with airplane mode ON: local write → queue enqueue → opportunistic push |
| **RTL + `stringResource`** | All UI text via `stringResource(R.string.…)` in **both** locales; logical (start/end) spacing only |
| **No new heavyweight deps** | Open-source, actively maintained, on-device, no paid APIs — justify in the PR |
| **Legal constants are data, not literals** | Statutes/deadline rules live in typed domain models with sources, never sprinkled in composables |

</div>

---

## Commit & PR Style

- Conventional-ish, imperative mood:
  `fix(sync): stop queue drain when remote rejects with 4xx`
- Reference the issue: `Closes #42`.
- Keep the Arabic/English docs in sync — if you add an English section, mirror the
  Arabic intent (and vice versa).

---

<div dir="rtl">

## القوالب الجاهزة

| النوع | الملف |
|-------|-------|
| 🐛 خطأ تقني | [bug_report.yml](.github/ISSUE_TEMPLATE/bug_report.yml) |
| ✨ طلب ميزة | [feature_request.yml](.github/ISSUE_TEMPLATE/feature_request.yml) |
| ⚖️ خطأ قانوني حسّاس | [legal_compliance.yml](.github/ISSUE_TEMPLATE/legal_compliance.yml) |
| 🔒 ثغرة أمنية | [SECURITY.md](SECURITY.md) (خاص، ليس هنا) |

</div>

---

*Built with ❤️ for the Egyptian legal community.*
