# AUDIT_REPORT.md — CRIM-SYS 2026 / legal-clay-app

> **المرحلة 0 — تقرير تحليل فقط.** لا تعديلات على الكود في هذه المرحلة، باستثناء إصلاحين
> سابقين تم تنفيذهما بموافقة صريحة من صاحب المشروع في جلسات سابقة (إصلاح سكربت Gradle،
> ودمج ملفات CI في `main.yml`) — موثّقان في §3 و §25.
>
> - **تاريخ التقرير:** 2026-09-19
> - **المستودع:** `AlySelim2001/legal-clay-app` (نسخة عمل محلية متزامنة)
> - **منهجية الأدلة:** كل بند موسوم بـ:
>   - `[مُنفَّذ]` = أمر شُغِّل فعليًا في هذه البيئة ونتيجته مسجّلة أدناه.
>   - `[مرصود]` = استنتاج من قراءة ملفات/سجلات (مثل سجل GitHub Actions الخام للـ Run #119).
>   - `[غير مُتحقق]` = لا يمكن إثباته هنا (غياب الأدوات، أو يتطلب CI، أو يتطلب قرارًا بشريًا).
> - قاعدة صارمة: لا يوجد في هذا التقرير أي «اختبار ناجح» لم يُشغَّل فعليًا.

---

## 1. ملخص تنفيذي

المشروع **أكبر من أن يكون مشروعًا واحدًا**: هو منصة متعددة الأسطح (Multi-surface) للقطاع القانوني المصري، وتتكون من أربعة أنظمة فرعية قابلة للبناء نظريًا:

| # | السطح | التقنية | حجم الكود | حالة قابليته للبناء الآن |
|---|---|---|---|---|
| 1 | تطبيق ويب مرجعي (CRIM-SYS 2026) | React 19 + TS + Vite + Convex + Supabase Auth | 212 ملف TS/TSX `[مرصود]` | ✅ **يبني**: `tsc` ناجح `[مُنفَّذ]` |
| 2 | تطبيق Android أصلي | Kotlin + Compose + Room + Hilt + SQLCipher | 81 ملف main + 15 اختبار `[مرصود]` | ⚠️ **متعذّر التحقق محليًا** (لا Java/SDK)؛ إصلاح عائق الترجمة مطبّق وينتظر إثبات CI `[غير مُتحقق]` |
| 3 | تطبيق Flutter | Flutter/Dart | 28 ملف Dart `[مرصود]` | ❌ **غير قابل للبناء بصيغته الحالية**: `pubspec.yaml` لا يعلن اعتماديات يستوردها الكود فعليًا `[مرصود]` |
| 4 | حزمة local-ai | Python + Docker Compose + Qdrant/n8n | خدمات متعددة `[مرصود]` | ⚠️ بُنيت بوابة CI لها سابقًا؛ لم تُنفَّذ محليًا `[غير مُتحقق]` |

**أبرز ثلاث نتائج:**
1. **عائق P1-A (ترجمة سكربت Gradle) أُصلح جراحيًا** بناءً على سجل Run #119 الخام (أخطاء `Unresolved reference` عند أسطر 11/12/131/139 في `android/app/build.gradle.kts` نتيجة غياب استيرادات `java.util`/`java.io` ومرجع `::load` بلا مستقبِل). الإصلاح مطبّق ويحتاج Run #120 لإثباته.
2. **اكتشاف جديد بالفحص الفعلي:** سطح Flutter مستورد لما لا يملك — `mobile_app/lib/**` يستورد `dio`, `camera`, `crypto`, `flutter_secure_storage`, `flutter_tts`, `intl`, `path`… بينما `pubspec.yaml` يعلن فقط `equatable`, `http`, `shared_preferences`. أي `flutter pub get && flutter build` سيفشل حتمًا. هذه فجوة حرجة لم تكن موثقة.
3. **جودة الوثائق أعلى من جودة بعض الواقع:** عدة ملفات docs تصف قدرات (SQLCipher في Flutter، TLS Pinning، Offline-first) غير موجودة في الاعتماديات المعلنة — يجب تصحيح الوثائق أو استكمال الكود، والقرار لصاحب المشروع.

---

## 2. نوع المشروع وتقنياته الفعلية `[مرصود]`

| المكوّن | التقنية (مثبتة من الملفات لا من الوصف) |
|---|---|
| الويب | React 19.2, react-router 7.10, Vite 7, TypeScript 5.9, Tailwind 4 (عبر `@tailwindcss/vite`), shadcn/ui, Radix, TanStack Query 5 + persister, Zustand 5, Framer Motion 12, Convex 1.30 + @convex-dev/auth, Supabase JS 2.112, Playwright (e2e), Bun كمنفّذ سكربتات |
| Android الأصلي | Kotlin 2.1.0, AGP 8.9.1, Gradle 8.11.1 (wrapper), JDK 17, compileSdk/targetSdk 36, minSdk 26, Compose (BOM 2024.12.01), Room 2.6.1 + KSP, Hilt 2.55, WorkManager 2.10, DataStore, SQLCipher (`net.zetetic:sqlcipher-android:4.5.4`), Firebase BOM 33.7 (Auth+Firestore اختياري), Robolectric 4.16 (اختبارات JVM)، kizitonwose Calendar, RichEditor |
| Flutter | Dart SDK ≥3.0 <4.0, flutter_lints 4, equatable, http, shared_preferences (المعلن فقط) + استيرادات غير معلنة (انظر §6) |
| local-ai | Python (requirements لكل خدمة), docker-compose.yml + docker-compose.phase4.yml, Qdrant, n8n, Bandit/Ruff كبوابات |
| CI/CD | ملف موحّد جديد `.github/workflows/main.yml` (7 مهام، 3 مراحل + إصدارات موسومة) — الحالي |
| Git | تُدار Commits/Pushes عبر منصة Vly/Freebuff تلقائيًا؛ أوامر git محجوبة داخل البيئة |

> **تنبيه §1-4 من البروتوكول:** المشروع **ليس أندرويد فقط** — التحقق أظهر أربعة أسطح. أمر البناء الأندرويدي ليس البوابة الوحيدة للجودة.

---

## 3. حالة البناء الحالية

### 3.1 الويب `[مُنفَّذ]`
- الأمر: `bun tsc -b --noEmit`
- النتيجة: **exit code 0 — ناجح بلا أخطاء.**
- ملاحظة: هذا فحص أنواع فقط؛ لم يُنفَّذ `bun run build` (Vite) محليًا في هذه الجلسة → إخراج الإنتاج `[غير مُتحقق]` (كان advisory سابقًا في CI القديم).

### 3.2 Android الأصلي `[غير مُتحقق محليًا — بعائق مُؤكد ومُصلَح]`
- **لماذا لم يُنفَّذ محليًا:** البيئة بلا `java` وبلا `ANDROID_HOME` (فُحص عبر `which java; echo $ANDROID_HOME` → `java: not found`، فارغ) `[مُنفَّذ]`. ترجمة Gradle مستحيلة هنا، والإثبات الوحيد الممكن هو CI.
- **العائق المؤكد تاريخيًا (Run #119، سجل خام):** فشل **ترجمة سكربت Kotlin DSL** قبل أي مهمة:
  - `11:31 Unresolved reference: util` → `java.util.Properties`
  - `12:88 Unresolved reference: load` → `::load` بلا مستقبِل
  - `131:25` و `139:25 Unresolved reference: io` → `java.io.File`
  - مطابقة الأعمدة token-by-token تم التحقق منها يدويًا على الملف الحالي `[مرصود]`.
- **الإصلاح المطبّق (مُسبق الموافقة):** إضافة `import java.io.File` + `import java.util.Properties` أعلى الملف، استبدال `::load` بـ `?.use { it.load(this) }`، واستخدام `File(...)` المستوردة — في `android/app/build.gradle.kts` فقط. **لم يُثبَت بعد عبر CI** → الحالة: بانتظار Run #120.

### 3.3 Flutter `[مرصود — فشل متوقع حتمي]`
- لم يُنفَّذ (لا `flutter` ولا `dart` في البيئة) `[مُنفَّذ للفحص، غير مُنفَّذ للأمر]`.
- **الفشل المتوقع مؤكد قراءةً:** الكود يستورد حزمًا غير معلنة (جدول كامل في §6-ب). لا حاجة لتشغيل البناء لمعرفة النتيجة: `pub get` سينجح ثم سيفشل التحليل/الترجمة عند أول استيراد مفقود.

### 3.4 local-ai `[غير مُتحقق]`
- بوابة Bandit/Flake8/Ruff/compose موجودة في `main.yml`؛ لم تُنفَّذ محليًا. ملاحظة: `ci.yml` القديم كان يستدعي Bandit بـ `-c .banditrc` والملف غير موجود — حُذف الراية في الدمج.

---

## 4. أوامر البناء المُنفَّذة ونتائجها `[مُنفَّذ]`

| الأمر | الغرض | النتيجة |
|---|---|---|
| `bun tsc -b --noEmit` | فحص أنواع الويب | **نجاح (exit 0)** |
| `bun run lint` | ESLint | **فشل (exit 1): 46 error / 26 warning** |
| `which java flutter dart gradle; echo $ANDROID_HOME` | فحص توفر الأدوات | لا Java/Flutter/Dart/Gradle، لا SDK |
| `find android/app/src ...` , `grep ...` | جرد الملفات والأنماط | نجاح (بيانات §7) |
| `node -e (js-yaml) ...` | تحقق صياغة `main.yml` | نجاح: 7 مهام، رسم `needs` سليم، لا قناع `continue-on-error` على أي بوابة |

أوامر لم تُنفَّذ ولن تُدَّعى: أي أمر Gradle، أي أمر Flutter/Dart، `npm audit`، Bandit، Playwright، `docker compose config`.

---

## 5. الاختبارات: ما نُفِّذ فعلًا وما لم يُنفَّذ `[مُنفَّذ/مرصود]`

| حزمة الاختبارات | موجودة؟ | نُفِّذت هنا؟ | الحالة |
|---|---|---|---|
| Web e2e (Playwright) — `tests/e2e`: auth, cases, criminal-flow, dashboard, deadlines… | نعم (10 ملفات) `[مرصود]` | **لا** (لا بيئة تشغيل مضمونة ولا طلب سابق) | `[غير مُتحقق]` |
| Android JVM (15 ملفًا: 5 فئات parity + SyncWorkerTest + Evidence + Citation + Deadlines…) | نعم `[مرصود]` | **لا** (لا Java) | `[غير مُتحقق]` — بوابة P1-A الرسمية عبر CI |
| Android Instrumented (`RoomMigration3To4Test`, `EvidenceCaptureInstrumentedTest`, `CrimSysNavHostTest`) + مخططات Room `3.json`(مجمّدة يدويًا)/`4.json` | نعم `[مرصود]` | **لا** (تتطلب محاكيًا) | `[غير مُتحقق]` |
| Flutter/Dart (5 ملفات `_test.dart` — deadlines/PII/repositories) | نعم `[مرصود]` | **لا** (لا Flutter؛ وبالكود الحالي سيفشل التحليل أولًا) | `[غير مُتحقق]` |
| Python (local-ai/tests, pytest cache موجودة) | نعم `[مرصود]` | **لا** | `[غير مُتحقق]` |

> قاعدة البروتوكول محفوظة: **لا يُقال إن أي اختبار «ناجح».** اختبارات Android لم تصل حتى إلى التنفيذ تاريخيًا (فشل الترجمة قبل استكشاف الاختبارات)، والقياس الحقيقي الوحيد الممكن هو Run #120 على CI.

---

## 6. الأخطاء الحالية (ملف/سطر/سبب/خطورة/إصلاح مقترح)

### أ. أخطاء مؤكدة من سجلات CI الخام `[مرصود — Run #119]`
| # | الملف | السطر:عمود | الخطأ | الخطورة | الإصلاح | الحالة |
|---|---|---|---|---|---|---|
| 1 | `android/app/build.gradle.kts` | 11:31 | `Unresolved reference: util` (سكربت Kotlin DSL لا يستورد `java.util.*` تلقائيًا) | **حرجة — تمنع كل شيء** | إضافة `import java.util.Properties` | مطبّق، بانتظار إثبات CI |
| 2 | نفس الملف | 12:88 | `Unresolved reference: load` (`::load` بلا مستقبِل — خطأ Kotlin صرف) | حرجة | `?.use { it.load(this) }` | مطبّق، بانتظار CI |
| 3 | نفس الملف | 131:25 | `Unresolved reference: io` | حرجة | `import java.io.File` + استخدامها | مطبّق، بانتظار CI |
| 4 | نفس الملف | 139:25 | `Unresolved reference: io` | حرجة | كما فوق | مطبّق، بانتظار CI |

### ب. فجوة اعتماديات Flutter — تمنع البناء `[مرصود]`
الكود يستورد، و`pubspec.yaml` لا يعلن (عينة مُتحقق منها بـ `grep '^import 'package:`):

| الحزمة المستوردة في `mobile_app/lib/**` | معلنة في pubspec؟ |
|---|---|
| `dio`, `dio/io` | ❌ |
| `camera` | ❌ |
| `crypto` | ❌ |
| `flutter_secure_storage` | ❌ |
| `flutter_tts` | ❌ |
| `intl`, `intl/date_symbol_data_local` | ❌ |
| `path` | ❌ |
| `flutter_localizations` (SDK) | ❌ |
| `http` | ✅ |
| `equatable` | ✅ |
| `shared_preferences` | ❌ (مستوردة؟ نعم ضمن الكود) — **تُعلن** ✅ في الملف لكن يجب التحقق من كل استيراد فردي عند الإصلاح |

- **الخطورة:** حرجة لوظيفة سطح Flutter.
- **الإصلاح المقترح (يحتاج موافقة):** إكمال قسم `dependencies` بإصدارات متوافقة مع Dart ≥3.0، ثم `flutter pub get && flutter analyze && flutter test` — ويُفضَّل إضافة حزمة تجميع lint تفشل عند الاستيراد غير المعلن (مثل gate في CI يطابق الاستيرادات بالمعلن).

### ج. أخطاء Lint الويب — 46 خطأ `[مُنفَّذ]`
- أمثلة موثقة من المخرجات: `src/search/hosted-vector.ts:37` (متغير غير مستخدم)، `src/pages/legal/Ask.tsx:1:21` (`useMutation` مستورد دون استخدام)، وأكثر من 20 ملفًا آخر (قائمة كاملة قابلة لإعادة الإنتاج بأمر `bun run lint`).
- **الخطورة:** منخفضة وظيفيًا، متوسطة هندسيًا (تمنع جعل lint بوابة).
- **الإصلاح المقترح:** تنظيف مرحلي (unused imports/vars أولًا)، ثم تفعيل lint كبوابة في `quality` بدل `continue-on-error: true` الحالي.

### د. أخطاء معروفة سابقة أُصلحت في جلسات معتمدة `[مرصود]`
- روابط README/badges تشير لملفات workflow محذوفة بعد الدمج → صُححت (8 مواضع).
- `-c .banditrc` في `ci.yml` القديم لملف غير موجود → حُذفت الراية في `main.yml`.

---

## 7. خريطة بنية المشروع `[مرصود]`

```
legal-clay-app/
├── src/                      # الويب المرجعي (212 TS/TSX)
│   ├── main.tsx              # نقطة الدخول: مزوّدات + راوتر كامل
│   ├── pages/                # ~50 صفحة (Enterprise, Legacy, legal/*, About…)
│   ├── components/           # AppLayout, Sidebar, TopBar, ui/* (shadcn كامل)
│   ├── convex/               # 13 ملف backend (schema, legal, workspace, users, auth…)
│   ├── lib/ + rag/ + agents/ # أدوات، RAG، وكلاء (بعضها تجريبي)
│   └── data/mock.ts          # بيانات وهمية موسومة (مسموح بها هنا)
├── android/                  # Android الأصلي (Kotlin/Compose) — 81 main / 15 test
│   ├── app/src/main/java/net/crimsys/app/{core,data,domain,di,ui}
│   │   ├── data/{local,remote,sync,repository,evidence,legal,auth}
│   │   ├── data/sync/        # SyncManager + SyncWorker + طابعتا مزامنة (تسلسل إيقاف موثق)
│   │   └── domain/…          # Result/Resource, ChainEvent, SyncCommand, CitationValidator
│   ├── app/schemas/…/3.json (مجمّدة يدويًا) + 4.json
│   └── app/src/{test,androidTest}   # parity/migration suites
├── mobile_app/               # Flutter — 28 ملف Dart (⚠️ pubspec ناقص §6-ب)
│   └── lib/{core,domain,data,presentation,features}
├── local-ai/                 # Python + compose (Qdrant/n8n/خدمات OCR/قانونية)
├── tests/e2e/                # Playwright (10)
├── docs/ + *.md              # 12 مهارة هندسية + OSS governance
├── config/oss_registry.yaml  # سجل التبعيات ("no mystery dependencies")
├── scripts/{oss-registry-lint,generate-sbom}.mjs
└── .github/workflows/main.yml  # الموحّد الحالي (7 مهام)
```

---

## 8. خريطة تدفق البيانات `[مرصود]`

**Android الأصلي (offline-first — من README الداخلي المتسق مع الكود):**
```
UI (Compose) → ViewModel → UseCase (Result<T>) → Repository
   → Room/SQLCipher (مصدر الحقيقة الوحيد، isSynced=false)
   → طابعة مزامنة (Legacy OfflineActionQueue ⇄ SyncCommandQueue — تسلسل هجرة موثق)
   → SyncManager/SyncWorker → Firestore (اختياري: بدون google-services.json يعمل offline)
```
- الأدلة: `module map` في `android/README.md` + وجود `SyncWorkerTest/QueueParityTest` وكود `data/sync`.

**الويب:** React → TanStack Query (persist) → Convex (اشتراكات reactive) + Supabase Auth؛ مسارات أرشفة/توقيع/OCR تمر عبر libs محلية (jspdf/pdf-lib/tesseract) — **لا خادم خارجي للبيانات القانونية إلا Convex/Supabase** `[مرصود من التبعيات]`.

**Flutter:** `presentation → domain (حاسبة المواعيد/PII) → BackendClient(dio) → local-ai` — لكنه **غير قابل للتشغيل حتى إصلاح pubspec** (§6-ب).

**local-ai:** compose معزول loopback-only (بوابات CI تتحقق)؛ PII gate قبل أي إرسال — وفق الوثائق، والتحقق السلوكي `[غير مُتحقق]`.

---

## 9. جميع الشاشات والوظائف الموجودة `[مرصود من main.tsx وبنية الملفات]`

**الويب (راوتر فعلي):** Landing, /login, /auth → `/app/{dashboard, cases(+new/:code/edit), persons(+new/:code), calendar, actions, audit, import, settings}` + legacy (dashboard/cases/:code/clients/:clientCode/calendar/deadlines/defenses/archive/legal-framework/ai-agent(s)/legal-intelligence/about/colombo/social-search/guides/opposition) + `/legal/*` (ask/search/rights/next-steps/authorities/documents/dossier/sources/history/notifications) + `/admin/{team,knowledge,evaluation}` — مع `RequireAuth` و`redirectAfterAuth=/app/dashboard`.

**Android (من خريطة الوحدة):** قائمة قضايا، ملف قضية + محرر مذكرات rich-text، تقويم جلسات (kizitonwose)، Drawer RTL + شريط علوي، ثيم طيني Claymorphism + رموز استعجالية.

**Flutter (من README + lib):** HomeShell بـ5 تبويبات (استغاثة/مسح مستند/مساعد/مواعيد/حول)، حاسبة مواعيد مصرية بتحقق مزدوج، PII scrubber، متحكم وصول (تكبير/تباين).

---

## 10. الوظائف الناقصة أو غير المكتملة `[مرصود]`

1. سطح Flutter: **غير قابل للتشغيل** حتى إكمال pubspec (§6-ب) — أعلن في الوثائق كاملًا ولكنه فعليًا معطل.
2. بوابة P1-A: الاختبارات (parity + migration) **لم تُنفَّذ قط في CI** حتى الآن (الترجمة كانت تفشل قبلها) — Run #120 هو أول فرصة حقيقية.
3. Gate 1 (idempotency عن بُعد): قواعد `firestore.rules` موجودة كطبقة أولى؛ **الإثبات البعيد للـ idempotency غير متوفر** — يبقى `BLOCKED — REMOTE IDEMPOTENCY CONTRACT NOT PROVEN` وفق البروتوكول السابق.
4. Container scan وSecret scanning: موثقان كـ *not yet wired* في `docs/OSS_SECURITY.md`.
5. e2e (Playwright) وFlutter tests وPython tests **خارج CI الموحد** — لا تُشغَّل آليًا في أي pipeline حالي.
6. Web lint كبوابة: معطّل (46 خطأ).
7. طبقة الأداء (Baseline Profiles يوجد ملف `baseline-prof.txt` لكن لا Macrobenchmark/قياس) `[مرصود]`.

---

## 11. الاعتماديات وإصداراتها `[مرصود من ملفات الإعداد]`

- **الويب:** React 19.2, react-router 7.10, Vite 7.2.6, TS 5.9.3, Tailwind 4.1.17, Convex 1.30, Supabase 2.112.4, TanStack Query 5.102.8, Zustand 5.0.15, Playwright 1.62, Bun lockfile — قائمة كاملة في `package.json` (100+ حزمة).
- **Android (`libs.versions.toml`):** AGP 8.9.1, Kotlin 2.1.0, KSP 2.1.0-1.0.29, Hilt 2.55, Compose BOM 2024.12.01, Room 2.6.1, Work 2.10, Robolectric 4.16, SQLCipher 4.5.4, Firebase BOM 33.7.
- **Flutter:** انظر §6-ب (المعلن فقط: equatable 2.0.5, http 1.2.2, shared_preferences 2.3.3, flutter_lints 4).
- **local-ai:** requirements لكل خدمة + سجل مركزي `config/oss_registry.yaml` (بوابة lint تمنع «الاعتماديات الغامضة»).

---

## 12. الاعتماديات القديمة/الضعيفة/غير المدعومة `[مرصود — بدون فحص ثغرات فعلي]`

> **إفصاح:** لم يُنفَّذ `npm audit` ولا `dependabot` ولا فحص CVEs هنا. الآتي من قراءة الإصدارات ووثائق المشروع:
1. `android.suppressUnsupportedCompileSdk=36` معلن في `gradle.properties` → AGP 8.9.1 أقصى ما اختبره رسميًا 35 — فجوة معروفة ومعالَجة بالقمع، تستحق الترقية لـ AGP أحدث عند أول فرصة.
2. Robolectric 4.16 + targetSdk 36: ملاحظة داخلية في README تقول إن SDK 36 يحتاج JDK 21 بينما السلم مثبت على JDK 17 — تعارض محتمل عند توسيع اختبارات Robolectric، لكن الاختبارات الحالية تستهدف سلمًا أقل `[مرصود للنص؛ التأثير الفعلي غير مُتحقق]`.
3. `recharts 2.x` مع React 19 (كبير الحجم، ونسخة 3 متاحة) — مرشح ترقية/استبدال.
4. `xlsx 0.18.5` من npm (ليس مصدر SheetJS الرسمي بعد انتقاله) — سياسة المشروع نفسها (OSS registry) قد تعتبره مرشح مراجعة أمنية؛ يُستخدم في استيراد Excel.
5. Flutter: `flutter_lints ^4` ليس أحدث خط رئيسي؛ والفجوة الأكبر هي §6-ب.

---

## 13. مشكلات الأداء `[مرصود — دون قياس فعلي]`

1. الويب: تكرار مكتبات PDF/مستندات (`jspdf` + `pdf-lib` + `pdfmake`) و`xlsx` + `tesseract.js` في حزمة واحدة — مرشحون لتقسيم حزم/dynamic import. لا قياس bundle فعلي منفذ `[غير مُتحقق]`.
2. Android: `baseline-prof.txt` موجود (إيجابي)؛ لا Macrobenchmark ولا قياس بدء تشغيل `[غير مُتحقق]`.
3. CI: `--no-daemon` + `workers.max=2` عمدًا (استقرار على العدّاء) — يبطئ البناء مقصودًا؛ مقبول.
4. local-ai: نماذج محلية ثقيلة (PaddleOCR وغيرها) خارج نطاق جهاز المستخدم — تصميم سليم، لا مشكلة أداء عميل.

---

## 14. مشكلات الأمان `[مرصود + غير مُتحقق حسب البند]`

**نقاط قوة موجودة فعليًا `[مرصود]`:** SQLCipher بمفتاح Keystore-wrapped (Android)، قواعد Firestore (commandId مفتاح idempotency، append-only، ownerUid)، `network_security_config.xml` يمنع cleartext، استبعاد النسخ الاحتياطي للبيانات الحساسة (`data_extraction_rules.xml`)، PII scrubber fail-closed (Flutter) + بوابة Presidio (server)، compose loopback-only، حرس أسرار `:?`، سجل OSS governance، `.gitignore` يغطي keystore/jks/venv/data.

**فجوات/مخاطر:**
1. **[غير مُتحقق] أسرار بيئة العمل:** `.env.local` موجود على القرص — منصة Freebuff تحجب قراءته (سلوك صحيح)؛ يجب التحقق أن القيم غير سرية لا تُزامَن للمستودع.
2. **[غير مُتحقق] TLS Pinning (Flutter):** موثق في README لكنه غير قابل للوجود بلا `dio` معلنة — جزء من فجوة §6-ب.
3. **[غير مُتحقق] ثغرات الاعتماديات:** لا `npm audit`/OSV scan منفذ؛ Gate أدوات (trivy/gitleaks) موثقة كغير مركبة.
4. **[مرصود] Path/Upload hardening:** منطق الرفع في الويب موجود (`FileUpload/DocumentUpload`)؛ مراجعة أمنية سطرية لم تُنفذ — بند خطة، لا ادعاء حماية.
5. **[مرصود] سجلات Logging:** لا سياسة موحدة لإخفاء PII في logs على Android (bند خطة §22).

---

## 15. تجربة المستخدم `[مرصود هيكليًا — لا تقييم تشغيلي]`

- الويب: RTL كامل (`dir="rtl"`)، خط Cairo، أخطاء مسارات معزولة (`RouteErrorBoundary`)، حالات تحميل (`RouteLoading`)، Toaster — جيد هيكليًا. تقييم بصري فعلي يتطلب معاينة حية `[غير مُتحقق]`.
- Android: Compose + RTL + رموز urgency — متوافق مع الهوية المطلوبة؛ مراجعة UI فعلية تحتاج بناءً ناجحًا أولًا.
- Flutter: تصميم Claymorphism موثق + متحكم a11y — غير قابل للتجربة حتى إصلاح pubspec.

---

## 16. الوصول Accessibility `[مرصود + غير مُتحقق]`

- Flutter: `Semantics`, liveRegion, textScaler حتى 200%، تباين AAA — **موثق في README و`presentation`**؛ تحقق آلي غير منفذ.
- الويب: مكونات shadcn/Radix (a11y أساس جيد)؛ لا تدقيق محدد (contrast/labels) منفذ.
- Android: Compose semantics افتراضيًا؛ لا اختبارات a11y موجودة.

---

## 17. الترجمة وRTL `[مرصود]`

- الويب: `dir="rtl"` منذ الجذر، نصوص عربية أولًا، `I18nProvider` موجود.
- Android: `values/` و`values-ar/` بمفاتيح متطابقة (حسب README الداخلي)، فرض `ar` عبر AppCompatDelegate، resourceConfigurations ar/en.
- Flutter: `flutter_localizations` مستورد (وغير معلن — §6-ب)، RTL-locked، ملف `values-ar/strings.xml` موجود (اسم التطبيق).
- فجوة: لا تدقيق آلي لفقدان مفاتيح الترجمة (أي أداة مثل intl_utils غير مركبة).

---

## 18. التوثيق `[مرصود]`

**قوي جدًا:** 12 مهارة هندسية (`docs/engineering/skills/*`)، حوكمة OSS كاملة (registry/decisions/licenses/security)، أدلة بناء وإطلاق، RELEASE_CHECKLIST، DISCLAIMER قانوني.

**المشكلة الجوهرية:** **انفصال الوثائق عن الواقع** — أبرز مثال: `mobile_app/README.md` يصف SQLCipher/dio pinning/offline-first وهي غير موجودة في `pubspec.yaml` (§6-ب). أي مستخدم جديد سيتبع الوثائق وسيفشل. يتطلب القرار: تصحيح الوثائق (تخفيض الادعاء) أو استكمال الكود (رفع الواقع) — **قرار مالك**.

---

## 19. قواعد البيانات والهجرة `[مرصود]`

- Room v3→v4: `3.json` **مجمّدة يدويًا** (مرآة حتمية لما بنته MIGRATION_1_2+2_3 — لا يمكن توليدها مجددًا) + `4.json` يُصدَّر من KSP. اختبار هجرة instrumented حقيقي موجود. هذا **نموذج ممتاز**.
- مخاطر: أي تعديل كيانات دون تصدير 5.json سيكسر العقد؛ الحاجة لمسار هجرة 4→5 مستقبليًا موثق بسياسة «لا تحذف الطابعة القديمة قبل parity».
- الويب: Convex schema موحد (`src/convex/schema.ts`) — اشتراكات reactive؛ لا هجرات تقليدية.
- Flutter: `app_database.dart` + `db_key_manager.dart` موجودان ككود — لكن مستحيلَي التشغيل بلا `sqflite_sqlcipher`/`flutter_secure_storage` المعلنتين (جزء من §6-ب — الكود موجود والتبعية لا).

---

## 20. الشبكة والتخزين المؤقت `[مرصود]`

- Android: `NetworkMonitor` (callbackFlow) + استنزاف FIFO + تراجع خلفي + DLQ (DEAD) + ميزانية محاولات 8 — طبقة ناضجة مع اختبارات.
- الويب: TanStack Query + persister (idb) — تخزين مؤقت سليم.
- Flutter: backend_client بحراسة HTTPS-only — معطّل فعليًا (§6-ب).
- فجوة: لا سياسة موثقة لانتهاء صلاحية الكاش أو حجمه في الويب.

---

## 21. معالجة الأخطاء `[مرصود]`

- Android: `Result<T>` + `Resource<T>` + خرائط أخطاء Firestore → SyncResult (Accepted/Retryable/Conflict/PermanentFailure) + dead-lettering + حارس decode — **منضبط**.
- الويب: RootErrorBoundary + RouteErrorBoundary لكل مسار حرج + Toaster.
- Flutter: نموذج خطأ في core/error (وفق README) — غير قابل للتحقق تشغيليًا.
- فجوة مشتركة: لا معايير موحدة لرسائل المستخدم النهائي عند الفشل (بند خطة UX).

---

## 22. التسجيل Logging `[مرصود + غير مُتحقق]`

- `src/lib/observability/telemetry.ts` موجود في الويب (نطاقه الفعلي يحتاج مراجعة).
- Android: لا واجهة logging مركزية ظاهرة؛ `lastError` breadcrumbs في طابعة المزامنة (جيد للغرض).
- خطر: PII في سجلات (نصوص قانونية) — يلزم سياسة scrubbing للسجلات قبل أي تفعيل telemetry خارجي.

---

## 23. الخصوصية وحماية البيانات `[مرصود]`

- إيجابيات: تشفير محلي، منع نسخ احتياطي سحابي، PII scrubber fail-closed، disclaimer قانوني صريح، لا تتبع في Flutter (موثق)، بيانات الأدلة تُخزَّن محليًا مع سلسلة عهدة (hash + chain events).
- فجوات: سياسة احتفاظ بالبيانات غير موجودة كوثيقة مستقلة؛ حق الحذف/التصدير غير مطبق في الواجهات (لا مسار «حذف حسابي/بياناتي» ظاهر في الراوتر).

---

## 24. Git وGitHub `[مرصود + غير مُتحقق]`

- إدارة Vly تمنع git المباشر هنا — Commits تُزامَن آليًا `[مرصود: رسالة الحجب]`.
- ما لا يمكنني التحقق منه من الداخل: حماية الفرع main، required checks، البيئات المحمية، CODEOWNERS، Dependabot، secret scanning — **قائمة قرار مالك في §29**.
- القوالب الحالية: CODE_OF_CONDUCT/SECURITY/CONTRIBUTING موجودة؛ PR/Issue templates وCODEOWNERS وdependabot.yml **غير موجودة في الشجرة** `[مرصود]`.

---

## 25. CI/CD `[مرصود — الحالي بعد الدمج المعتمد]`

**الوضع الحالي:** ملف واحد `.github/workflows/main.yml` (بديل الموثق للخمسة القديمة):
- المرحلة 1 (متوازي): `quality` (typecheck بوابة، lint advisory)، `android-unit` (5 فئات parity ثم كامل الحزمة + رفع تقارير)، `security-audit` (Bandit/Flake8/Ruff/compose/registry/SBOM).
- المرحلة 2: `build-android` (assembleDebug + artifact).
- المرحلة 3: `instrumentation` (KVM + محاكي API 36 + `RoomMigration3To4Test`).
- إصدارات موسومة فقط: `release-android` (APK/AAB موقعة + mapping.txt) و`release-mobile` (Flutter) — تشترط أسرار توقيع وتفشل صراحة بلاها.
- Concurrency مع عدم إلغاء إصدارات الوسوم. تحقق صياغة عبر js-yaml: 7 مهام، رسم needs سليم، لا أقنعة على البوابات `[مُنفَّذ]`.

**فجوات CI الحالية:** e2e وFlutter tests وPython tests غير مدرجة؛ لا CodeQL؛ لا Dependabot؛ lint advisory (يُرفع بعد تنظيف §6-ج).

---

## 26–27. جدول Prioritized Backlog + تقدير الصعوبة

| # | المهمة | السبب | الأثر | الصعوبة (S/M/L/XL) | الأولوية |
|---|---|---|---|---|---|
| 1 | تمرير الإصلاحات المطبقة (Gradle fix + main.yml) إلى `main` وتشغيل Run #120 | إثبات P1-A الوحيد الممكن | يفتح البوابة كلها | **S** | 🔴 حرج |
| 2 | استخراج نتائج Run #120 حتي لو فشلت طبقة جديدة (سجل خام) | قاعدة «الأدلة فقط» | قرار P1-A | **S** | 🔴 حرج |
| 3 | إكمال `mobile_app/pubspec.yaml` بالاعتماديات المفقودة + قفل إصدارات | سطح Flutter معطل | إحياء سطح كامل | **M** | 🔴 حرج |
| 4 | مطابقة الاستيرادات بالمعلن كبوابة CI لسطح Flutter | منع تكرار §6-ب | سلامة بنية | **S** | 🟠 عالٍ |
| 5 | تنظيف 46 خطأ lint ثم جعله بوابة | جودة/بوابات صادقة | قاعدة تنظيف | **M** | 🟠 عالٍ |
| 6 | قرار مالك: تصحيح وثائق Flutter أم استكمال كودها | انفصال docs عن الواقع | ثقة التوثيق | **S قرارات** | 🟠 عالٍ |
| 7 | إضافة PR/Issue templates + CODEOWNERS + dependabot.yml | §11 من البروتوكول | نضج GitHub | **S** | 🟠 عالٍ |
| 8 | حماية فرع main + required checks + بيئة release | إنفاذ §11 | أمان الإصدار | **S (إعدادات)** | 🟠 عالٍ |
| 9 | إضافة e2e وFlutter وPython tests إلى `main.yml` | تغطية الآلي | ثقة تراجعية | **M** | 🟡 متوسط |
| 10 | CodeQL + secret scanning (gitleaks) | §14/§25 | أمان | **M** | 🟡 متوسط |
| 11 | مراجعة أمنية سطرية لرفع الملفات (نوع/حجم/path traversal) | §10 | حماية | **M** | 🟡 متوسط |
| 12 | سياسة سجلات بلا PII + مراجعة telemetry | §22 | خصوصية | **M** | 🟡 متوسط |
| 13 | مسارات حذف/تصدير البيانات للمستخدم | §23 | خصوصية/امتثال | **M** | 🟡 متوسط |
| 14 | ترقية AGP ورفع `suppressUnsupportedCompileSdk` | §12 | حداثة | **M** | 🟡 متوسط |
| 15 | خفض تكرار مكتبات PDF/Excel في الويب + bundle report | §13 | أداء | **M** | 🟢 منخفض |
| 16 | Macrobenchmark + Screenshot testing (Android) | §13/§12 | أداء/تراجع | **L** | 🟢 منخفض |
| 17 | Modularization حقيقي عند وجود مبرر (لا مجلدات فارغة) | §الرابع | صيانة | **XL** | 🟢 لاحق |
| 18 | بناء طبقة المصادر القانونية الموثقة (مصادر رسمية + تدقيق بشري) | §خامس/سادس | جوهر LegalTech | **XL** | 🟢 مرحلي |

---

## 28. المخاطر التقنية والقانونية

**تقنية:**
- R1: Run #120 قد يكشف طبقة فشل جديدة (Kotlin/KSP/Hilt) بعد نجاح السكربت — وارد ومتوقع؛ البروتوكول: سجل خام ثم طبقة تلو طبقة.
- R2: فجوة Robolectric/JDK (§12-2) قد تعطل اختبارات JVM إذا وصلت لهدف 36 — حل مؤجل حتى الأدلة.
- R3: أي «إصلاح واسع» لسطح Flutter قد يجر ترقيات متسلسلة — يُنفَّذ على دفعات مع اختبار بعد كل دفعة.

**قانونية/امتثال:**
- R4: أي نص قانوني يدخل المنصة يجب أن يأتي من مصدر رسمي منشور مع تاريخ نفاذ ودرجة ثقة — **حاليًا لا توجد قاعدة نصوص قانونية محملة**، وهذا صحيح وآمن؛ إدخالها مرحلة 5 مع `LEGAL_SOURCES.md`.
- R5: الالتزام بالحدود: المنصة مساعدة معلوماتية لا استشارة ملزمة — موجود عبر `LegalDisclaimer` ويُحافظ عليه.
- R6: تراخيص الأطراف الثالثة: تُدار عبر `config/oss_registry.yaml` + NOTICE — أي دمج خارجي جديد يمر عبر بروتوكول §ثامن قبل أي سطر كود.

---

## 29. القرارات التي تحتاج موافقة بشرية (مالك المشروع)

1. **حتمي الآن:** دمج الإصلاحين المعتمدين في `main` وتشغيل Run #120 (أوامر §15-Handoff أدناه).
2. Flutter: (أ) إكمال pubspec ورفع السطح ليعمل، أم (ب) تجميد السطح وتصحيح وثائقه فقط؟
3. اعتماد خطة المراحل (§30) وترتيب الأولويات في §26.
4. سياسة الإصدار: هل نفعّل `release-mobile` حاليًا أم نثبته معطّلًا حتى نضج Flutter؟
5. إعدادات GitHub التي لا أستطيع تنفيذها من الداخل: branch protection، required checks، بيئة محمية، أسرار التوقيع (لا تُكتب أبدًا في YAML).
6. أي دمج مشروع خارجي (RAG/OCR/متجهات…) يمر بجدول §ثامن كامل قبل التنفيذ.

---

## 30. خطة التنفيذ على مراحل (مُكيَّفة على الواقع الحالي)

| المرحلة | النطاق | معايير الخروج |
|---|---|---|
| **0 (الحالي)** | هذا التقرير — لا تعديلات | موافقة المالك |
| **1** | تشغيل Run #120 واستخراج الأدلة؛ معالجة أول طبقة فشل جديدة إن وجدت (جراحي) | P1-A = PASS ببنية CI خضراء (أو blocker جديد موثق بسجل) |
| **2** | Flutter pubspec + بوابة مطابقة الاستيرادات + تنظيف lint وجعله بوابة | `flutter analyze/test` أخضر في CI، lint أخضر |
| **3** | قوالب GitHub + حماية الفروع + Dependabot + CodeQL + gitleaks | §11 مكتملاً |
| **4** | UX/RTL/a11y تدقيق فعلي (ويب + Android) + حالات فراغ/خطأ موحدة | قوائم تدقيق مكتملة في PHASE_REPORT |
| **5** | المستندات والبحث والفلاتر + تحصين الرفع | اختبارات §12 الحمراء→الخضراء |
| **6** | طبقة المصادر القانونية الموثقة (LEGAL_SOURCES، إصدارات النصوص، تدقيق بشري) | لا نص بلا مصدر ونفاذ وثقة |
| **7** | RAG قابل للتدقيق + وكلاء + سجل تدقيق + حماية Prompt Injection | AI_SAFETY.md مطبقاً |
| **8** | الأمان والخصوصية (أدوار، حذف/تصدير، سجلات) | SECURITY_REPORT |
| **9** | الأداء (Baseline Profiles، تقسيم الحزم، قياس) | أرقام قبل/بعد موثقة |
| **10** | RC شامل + CHANGELOG + بناء Release (بدون نشر دون موافقة) | TEST_REPORT + علامة |

---

## Handoff — أوامر المالك (خارج هذا التقرير، تحتاج تنفيذك)

```bash
# 1) دمج الإصلاحين (سطح fix جاهز في الشجرة المحلية المتزامنة)
git checkout -b fix/gradle-java-namespace
git add -A
git commit -m "fix(gradle): script imports; ci: consolidate to main.yml; audit: phase 0"
git push -u origin fix/gradle-java-namespace
git checkout main && git merge --no-ff fix/gradle-java-namespace && git push origin main

# 2) إطلاق البوابة
gh workflow run "Integrated CI/CD Pipeline" --ref main   # → Run #120
gh run watch
gh run view --log-failed   # إن فشلت أي طبقة: السجل الخام هو المدخل التالي
```

**نهاية المرحلة 0 — التقرير مكتمل، ولن يُعدَّل أي ملف حتى موافقتك الصريحة.**
