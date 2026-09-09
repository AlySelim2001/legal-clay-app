<div dir="rtl">

# 🚀 خارطة طريق الإطلاق — Launch & Distribution Strategy

> الهدف: إيصال نسخة موثوقة إلى محامين حقيقيين، مع حلقة تغذية راجعة سريعة — **بدون** شرط النشر في Google Play في المرحلة الأولى.

</div>

<div dir="ltr">

## Phase 0 — Pre-Launch Gate (week 0)

Before any lawyer installs anything:

- [ ] `./gradlew assembleRelease` green on a provisioned machine (JDK 17 + platform 35)
- [ ] `apksigner verify --print-certs` passes on the distribution APK
- [ ] `android/RELEASE_CHECKLIST.md` fully ticked
- [ ] In-app About screen shows [DISCLAIMER.md](../DISCLAIMER.md) content
- [ ] `keystore.properties` + `crimsys-release.jks` backed up in 2 offline locations
      (**losing the keystore = no more updates for installed devices**)

## Phase 1 — Closed Beta (weeks 1–4, 10–20 lawyers)

**Distribution: signed APK via GitHub Releases** (this repo already builds one per
`v*` tag — see [../.github/workflows/android-release.yml](../.github/workflows/android-release.yml)).

| Item | How |
|---|---|
| **Private channel** | Telegram group (WhatsApp is where lawyers already are; Telegram has better file history + pinned versions) — invite link shared personally via the WhatsApp contact |
| **Rollout** | 5 lawyers first (highest-trust), then batches of 5 after each green build |
| **Versioning** | `2026.1.0-betaN` — APK named `CRIM-SYS-<version>-<sha>.apk` so every install is traceable |
| **Feedback loop** | Weekly voice notes → maintainer files them as GitHub Issues (legal-calculation reports go to the ⚖️ template immediately) |
| **Success criteria** | 2 weeks of real usage, zero `legal-sensitive` P1 bugs, sync drain verified on real devices |

### Why GitHub Releases instead of Google Play first?

1. **Speed** — fixes ship same-day to the closed group, no review window.
2. **Zero cost** — no $25 fee or account verification wait while the product is still evolving.
3. **Built-in update delivery** — the app checks `https://api.github.com/repos/AlySelim2001/legal-clay-app/releases/latest` (implemented in `UpdateChecker.kt`) and deep-links to the release page. No Play Billing, no account needed.
4. ⚠️ **Android will block unknown-sourced installs** — the beta doc must include the one-time "allow from browser" grant; screenshot it in the Telegram pinned message.

## Phase 2 — Stabilization (weeks 5–8)

- Migrate beta feedback → fix → tag `v2026.1.0` stable
- Enable optional Firestore sync for practices that want multi-device (opt-in, `keystore.properties` project id)
- On-device Arabic OCR (ML Kit) ships behind a settings flag
- Prepare Play Console data-safety form (answer: "no data collected" — matches the privacy policy)

## Phase 3 — Public Launch (weeks 9–12)

- Google Play internal track → production (AAB via `./gradlew copyReleaseBundle`)
- Play listing reuses the [launch post](LAUNCH_POST.md) copy
- In-app updater switches primary channel to Play (GitHub check stays as fallback)

## Update Delivery (all phases)

```
tag v2026.2.0 → GitHub Action builds signed APK → attaches to Release
            └─ installed apps see "update available" on next cold start
               (BuildConfig.VERSION_NAME < release tag) → deep link to Release page
```

Rules:
- **Never bump `versionName` without a git tag** — the updater compares against release tags.
- Hotfix for a legal-calculation bug = patch release **same day** + pinned Telegram notice.
- Keep the changelog bilingual; lawyers read Arabic, contributors read English.

</div>
