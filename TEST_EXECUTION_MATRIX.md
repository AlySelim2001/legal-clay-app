# TEST_EXECUTION_MATRIX.md — Phase 1 / 2026-09-19

> **قاعدة صارمة:** الأعمدة "النتيجة" تُملأ فقط بما شُغِّل فعليًا داخل بيئة التنفيذ هذه.
> كل ما لم يُشغَّل مسجَّل بحالته الصحيحة: `NOT RUN` + سبب محدد.
> **لا يوجد في هذا الملف أي اختبار "ناجح" لم يُنفَّذ.**

بيئة التنفيذ الفعلية: Bun 1.3.14، Node v22.23.1، python3 متوفر.
غير متوفر: `java`، `gradle`، `flutter`، `dart`، `ANDROID_HOME` (فُحص عبر `which`/`echo` — أدلة خام أدناه).

| # | الاختبار / الفحص | الأمر | البيئة | النتيجة | سبب عدم التشغيل إن وجد |
|---|---|---|---|---|---|
| 1 | فحص أنواع الويب (بوابة صلبة في CI `quality`) | `bun tsc -b --noEmit` | محلي (Bun 1.3.14) | ✅ **PASS — exit 0** | — |
| 2 | ESLint للويب (advisory في CI) | `bun run lint` | محلي | ❌ **FAIL — exit 1** | فشل فعلي: **46 error / 26 warning** (القائمة الكاملة في `PHASE1_COMMAND_LOG.md`) — حالة موثقة معروفة؛ يُرفع لبوابة بعد التنظيف (خطة AUDIT §26-5) |
| 3 | جرد أخطاء Lint بتنسيق JSON | `bunx eslint . --format json` | محلي | ✅ نُفِّذ — 46/26 مطابقة | — |
| 4 | ترجمة سكربت Gradle Kotlin DSL | `./gradlew help` (cwd `android`) | محلي | ⏸️ **NOT RUN** | لا `java` ولا SDK في البيئة — **قيد بيئي مسجل، ليس فشل كود** (بند رابعًا-4 من البروتوكول). الإثبات الوحيد الممكن: CI Run #120 |
| 5 | اختبارات JVM/Robolectric (15 ملفًا، منها 5 parity suites) | `./gradlew testDebugUnitTest` (cwd `android`) | محلي/CI | ⏸️ **NOT RUN** | لا Java — نفس القيد البيئي |
| 6 | اختبار هجرة Room 3→4 (instrumented) | `./gradlew connectedDebugAndroidTest -Pandroid.testInstrumentationRunnerArguments.class=net.crimsys.app.data.local.RoomMigration3To4Test` | محاكي API 36 + KVM (CI فقط) | ⏸️ **NOT RUN** | يتطلب محاكيًا وSDK — مسار CI جاهز في `main.yml` (بوابة المرحلة 3) |
| 7 | `flutter analyze` | `flutter analyze` (cwd `mobile_app`) | محلي/CI | ⏸️ **NOT RUN** | لا Flutter SDK؛ **والفشل متوقع قراءةً**: استيرادات غير معلنة (FLUTTER_GAP_REPORT §2) + استيرادات بأسماء حزم خاطئة (§3) |
| 8 | `flutter test` (5 ملفات `_test.dart`) | `flutter test` (cwd `mobile_app`) | محلي/CI | ⏸️ **NOT RUN** | نفس السبب — ولن يصل إلى التنفيذ قبل إصلاح §2+§3 |
| 9 | `flutter build apk` | `flutter build apk --release` | محلي/CI | ⏸️ **NOT RUN** | نفس السبب |
| 10 | Playwright e2e (10 ملفات في `tests/e2e`) | `bunx playwright test` | محلي/CI | ⏸️ **NOT RUN** | لم يُطلب تشغيله في هذه المرحلة؛ خارج CI الموحد حاليًا (فجوة موثقة AUDIT §25) |
| 11 | اختبارات Python (local-ai) | `pytest` (cwd `local-ai`) | محلي | ⏸️ **NOT RUN** | خارج نطاق هذه المرحلة؛ بوابة CI الخاصة به موجودة في `main.yml` ولم تُشغَّل محليًا |
| 12 | Bandit / Ruff / compose config | حسب `main.yml` (security-audit) | CI | ⏸️ **NOT RUN** | لم تُشغَّل محليًا — لا ادعاء |
| 13 | فحص هيكلي لـ `main.yml` (صياغة + رسم needs) | `node` + `js-yaml` (تحقق برمجي) | محلي | ✅ **PASS** | 7 مهام، رسم needs سليم، صفر `continue-on-error` على مستوى المهام (البوابات صلبة؛ الخطوات الاستشارية فقط داخل `quality`) |
| 14 | فحص ساكن لنمط خطأ Gradle (imports/`::load`) | `grep`/`sed` على كل `*.gradle.kts` | محلي | ✅ نُفِّذ | `android/app/build.gradle.kts` مُصلَح؛ مسارات البناء الثلاثة الأخرى نظيفة (تفاصيل السجل)؛ النمط القديم موجود فقط في `patch-kit/` غير المرجع من أي settings.gradle |
| 15 | فحص عقد هجرة Room ساكنًا | `grep` على `CrimSysDatabase.kt` + schema JSONs + اختبار الهجرة | محلي | ✅ نُفِّذ — **اكتشاف مهم** | الكود عند **version 5** مع `MIGRATION_4_5`، بينما المخططات المصدَّرة 3.json/4.json فقط — لا `5.json` ولا اختبار هجرة 4→5 (انظر السجل §D) |

## الأوامر الحية (أدلة خام من هذه الجلسة)

```text
$ which java; java -version        → sh: 1: java: not found
$ which gradle flutter dart        → not found
$ echo $ANDROID_HOME               → (فارغ) → ANDROID_SDK: MISSING
$ bun --version                    → 1.3.14
$ node --version                   → v22.23.1
$ bun tsc -b --noEmit              → exit 0 (بلا مخرجات)
$ bun run lint                     → exit 1 — "✖ 72 problems (46 errors, 26 warnings)"
```

## الخلاصة

- ما نُفِّذ فعليًا: فحص الأنواع (ناجح)، Lint (فاشل — دين معلوم)، الفحوص الساكنة 13–15 (ناجحة).
- ما لم يُنفَّذ ولا يُدَّعى: كل شيء يعتمد Java/Android SDK، Flutter/Dart، محاكيًا، أو Playwright/pytest.
- بوابة P1-A تبقى: **بانتظار Run #120** — لا تغيير في حالتها عن AUDIT_REPORT §29-1.
