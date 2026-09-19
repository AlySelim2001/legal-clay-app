# PHASE1_COMMAND_LOG.md — سجل الأوامر والنتائج / 2026-09-19

> سجل خام لكل ما نُفِّذ في هذه الجلسة (المرحلة 1)، مع النتائج الحرفية. الفرع المنطقي:
> `chore/phase-1-build-and-ci-recovery` (إدارة النسخ تتم عبر مزامنة منصة Vly — أوامر git
> محجوبة في بيئة التنفيذ، وهذا قيد بيئي مسجل لا فشل كود).

---

## A. فحص توفر الأدوات (قيد بيئي)

```text
$ java -version     → sh: 1: java: not found
$ gradle --version  → sh: 1: gradle: not found
$ flutter --version → sh: 1: flutter: not found
$ dart --version    → sh: 1: dart: not found
$ ls $ANDROID_HOME/platforms → ANDROID_SDK: MISSING
$ bun --version     → 1.3.14
$ node --version    → v22.23.1
```

**القرار وفق البروتوكول (رابعًا-4):** عدم توفر Java/Android SDK/Flutter ليس فشلًا في
الكود — يُسجَّل كقيد بيئي، والإثبات الوحيد الممكن لبوابات الأندرويد هو CI (Run #120).

---

## B. الفحص الساكن لنمط خطأ Gradle (قبل أي بناء)

### B-1. الإصلاح المطبق في `android/app/build.gradle.kts` — مُتحقق منه

```text
line 3: import java.io.File
line 4: import java.util.Properties
line 16: rootProject.file("keystore.properties").takeIf { it.isFile }?.inputStream()?.use { it.load(this) }
line 61/63/135/143: File(...) — المستوردة، لا java.io. المكتوبة يدويًا
```

الأخطاء الأربعة الموثقة من Run #119 (11:31, 12:88, 131:25, 139:25) لم تعد قائمة
ساكنًا. **الإثبات الوحيد للنجاح يبقى Run #120** — لا يُدَّعى نجاح.

### B-2. مسح نمط الخطأ نفسه على كل ملفات `.gradle.kts`

| الملف | الحالة |
|---|---|
| `android/app/build.gradle.kts` | ✅ مُصلَح (أعلاه) |
| `android/build.gradle.kts` | نظيف — لا استخدامات java.* |
| `android/settings.gradle.kts` | نظيف |
| `mobile_app/android/app/build.gradle.kts` | نظيف — `java.util.Properties()` مؤهل بالكامل + `use { keystoreProperties.load(it) }` بمستقبِل |
| `mobile_app/android/build.gradle.kts` | نظيف |
| `mobile_app/android/settings.gradle.kts` | نظيف — `use { properties.load(it) }` بمستقبِل |
| `patch-kit/android-app-build.gradle.kts` | ⚠️ يحوي النمط القديم `?.use(::load)` (سطر 26) — **غير مُشار إليه في أي settings.gradle** ⇒ ملف مرجعي مستقل خارج مسارات البناء. يُوثَّق هنا ولا يُعدَّل في هذه المرحلة (خارج نطاق الإصلاح المعتمد). |

grep دامغ لكل `FileInputStream|\.load\(` على `*.gradle.kts` أعاد 3 مواضع فقط،
كلها بمستقبِل مرتبط (receiver-bound lambda) — نمط صحيح في Kotlin DSL.

---

## C. فحوص الويب المنفَّذة فعليًا

```text
$ bun tsc -b --noEmit   → exit 0 — PASS (بلا مخرجات)
$ bun run lint          → exit 1 — "✖ 72 problems (46 errors, 26 warnings)"
$ bunx eslint . --format json → TOTAL errors: 46, warnings: 26 (مطابق)
```

### التصنيف الكامل للأخطاء الـ46 (بند خامسًا-3: الحقيقية أولًا)

**الفئة 1 — react-hooks (12 خطأ — "حقيقية" كنوع، تحتاج مراجعة سلوكية لكل حالة):**
- `set-state-in-effect` ×10: `src/components/OpenSourceSyncDesk.tsx:215,370`،
  `src/components/OutcomeAnalyticsDesk.tsx:139`، `src/components/WorkflowAutomationDesk.tsx:74,78`،
  `src/components/ui/carousel.tsx:96`، `src/hooks/use-mobile.ts:14`،
  `src/pages/EnterprisePersonForm.tsx:36`، `src/pages/EnterpriseSettings.tsx:28`، `src/pages/legal/Ask.tsx:75`
- `refs` (Cannot access refs during render): `src/hooks/useSessionTimeout.ts:49`
- `purity` (impure call during render): `src/components/ui/sidebar.tsx:611`، `src/pages/EnterpriseCaseForm.tsx:32`
- `immutability`: `local-ai/services/frontend/src/components/LegalChatPanel.tsx:38`
- `preserve-manual-memoization`: `src/pages/EnterprisePersonDetail.tsx:27`

**الفئة 2 — no-unused-vars (22 خطأ — تنظيف آمن متوقع):**
- imports غير مستخدمة: `EnterpriseCalendar.tsx:2` (Card/CardContent/CardHeader/CardTitle)،
  `Sidebar.tsx:16,17`، `legal/Ask.tsx:1`، `legal/AdminEvaluation.tsx:1`، `legal/Search.tsx:1`، `EnterprisePersonForm.tsx:10`
- متغيرات ميتة: `automation/intelligent-workflow.ts:277,492,499,615`، `convex/legal.ts:1`،
  `convex/lib/evidence.ts:11`، `reports/success-rate-report.ts:29`، `search/hosted-vector.ts:37`،
  `LegalIntelligence.tsx:1490`، `local-ai/.../EmergencyMode.tsx:24`، `components/legal/ui.tsx:103`

**الفئة 3 — no-explicit-any (4):** `src/convex/legal.ts:129,130,133,147` — ملف backend Convex؛ تحتاج أنواعًا دقيقة لا `any`.

**الفئة 4 — no-useless-escape (5):** `src/convex/workspace.ts:188×4,192×1` — تنظيف regex آمن.

ملاحظة: ملفان خارج `src/` (local-ai frontend) يدخلان في eslint — يُنصح بمراجعة نطاق eslint.config لاحقًا (قرار مالك).

---

## D. اكتشاف مهم: عقد هجرة Room (فحص ساكن)

```text
$ grep CrimSysDatabase.kt:
  line 19: version = 5,
  line 46: MIGRATION_3_4 … line 80: MIGRATION_4_5
$ schemas/: 3.json (version 3) و 4.json (version 4) فقط — لا 5.json
$ RoomMigration3To4Test.kt: يبني v3 ويسيّر MIGRATION_3_4 ويتحقق byte-for-byte — سليم لما يغطيه
```

**الفجوة:** الكود عند **version 5** (`MIGRATION_4_5` موجودة: جداول الأدلة/سلسلة العهدة
حسب خريطة وحدة android/README) لكن:
1. لا يوجد `5.json` مُصدَّر (KSP يصدّره عند أول بناء ناجح — غير موجود لأن البناء لم ينجح بعد).
2. لا يوجد `RoomMigration4To5Test` — **بوابة هجرة 4→5 غير مغطاة اختبارًا**.

> توضيح تصنيفي: عقد 3→4 (المطلوب في STEP 2 من التوجيه) موجود وسليم ساكنًا،
> ويُنفَّذ فعليًا في بوابة CI المرحلة 3 (`instrumentation`). الفجوة في **4→5**
> اكتشاف جديد يجب دخوله في الخطة كعمل متابعة (commit مستقل بعد نجاح Run #120).

**تنبيه دستوري للمخطط:** `3.json` مجمّدة يدويًا — أي إعادة توليد لها ممنوع؛
و`5.json` يجب أن يُصدَّر من KSP لا أن يُكتب يدويًا.

---

## E. التحقق الهيكلي لـ CI الموحد `main.yml`

```text
$ node + js-yaml:
  jobs: 7 → quality, android-unit, security-audit, build-android, instrumentation, release-android, release-mobile
  needs graph: OK (كل needs يشير لمهمة موجودة)
  job-level continue-on-error: none
$ داخل quality: tsc = بوابة صلبة؛ lint + build = continue-on-error: true (advisory موثق)
$ instrumentation: KVM udev rule + محاكي api-level 36 + تشغيل RoomMigration3To4Test تحديدًا (فلتر class)
```

مطابق لتصميم AUDIT §25. بوابات الإصدار (release-*) موسومة فقط ولا تُطلق بـ push عادي.

---

## F. القيود البيئية المسجلة

1. **git محجوب** في بيئة التنفيذ: `Git and GitHub commands are blocked; Vly manages version control.`
   ⇒ إنشاء الفرع `chore/phase-1-build-and-ci-recovery` وpush يتمان عبر مزامنة المنصة —
   لا يمكنني تنفيذهما محليًا (بند أولًا-2/3: يُسجَّل قيدًا، ولا force push بأي حال).
2. **أداة عرض الملفات في المنصة** تخفي بعض مسارات الشجرة (عرض مفلتر)، بينما
   `find`/`grep` المباشرة ترى الشجرة كاملة (android/ وmobile_app/ و.github/ موجودة فعليًا).
   كل الاستنتاجات أعلاه مبنية على القراءة المباشرة (grep/sed/find) لا على العرض المفلتر.
3. لا Java/SDK/Flutter — انظر §A.

---

## G. خلاصة المرحلة 1 — حالة البوابات

| البوابة | الحالة |
|---|---|
| إصلاح سكربت Gradle (P1-A) | مطبق ومتحقق ساكنًا — **بانتظار Run #120 للإثبات** |
| مسح نمط الخطأ على بقية السكربتات | ✅ نظيف (استثناء patch-kit غير المشار إليه — موثق) |
| عقد هجرة 3→4 | سليم ساكنًا + بوابة CI جاهزة (يُنفَّذ في Run #120+) |
| عقد هجرة 4→5 | ❌ **فجوة جديدة** — لا schema 5.json ولا اختبار (عمل متابعة) |
| Web typecheck | ✅ PASS (exit 0) |
| Web lint | ❌ 46/26 — مصنفة كاملة §C، advisory في CI، خطة تحويله بوابة بعد التنظيف |
| Flutter | ❌ غير قابل للبناء — تفاصيل وإجراء الموافقة في FLUTTER_GAP_REPORT.md |
| CI main.yml | ✅ هيكليًا سليم (7 مهام، needs OK، بلا أقنعة بوابات) |

## H. التسليم التالي (يد المالك فقط — خارج بيئة التنفيذ)

1. مزامنة/دمج التغييرات على فرع `chore/phase-1-build-and-ci-recovery` ثم **Run #120**.
2. استخراج `gh run view --log-failed` لأي طبقة فشل جديدة (Kotlin/KSP/Hilt متوقعة إحصائيًا).
3. إقرار جدول FLUTTER_GAP_REPORT §5 (موافقة صريحة) قبل أي تعديل pubspec.
4. قرار متابعة: اختبار هجرة 4→5 + تصدير 5.json بعد أول بناء ناجح.
