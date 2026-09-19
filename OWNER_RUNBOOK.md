# OWNER_RUNBOOK.md — سجل التشغيل اليدوي للمالك

> **التاريخ:** 2026-09-19 · **النطاق:** تنفيذ فقط — لا تعديل كود إنتاج أو Gradle أو Room أو Flutter في هذا الملف أو بسببه.
> **الفرع المستهدف:** `chore/phase-1-build-and-ci-recovery` · **المستودع:** `AlySelim2001/legal-clay-app`
> **المصدر الوحيد للحقائق الواردة هنا:** ملفات المستودع الفعلية (`main.yml`, `libs.versions.toml`, `gradle-wrapper.properties`, `build.gradle.kts`, `RUN_120_EVIDENCE.md`).
> **ممنوع في كل الخطوات أدناه:** دمج main، تفعيل release-mobile، رفع keystore/jks، كتابة `5.json` يدويًا، تعديل `pubspec.yaml` قبل إقرار `FLUTTER_APPROVAL_MATRIX.md`.

---

## أ. المتطلبات (ما يجب توفره على جهاز المالك)

| الأداة | الإصدار المطلوب بالضبط | السبب (من المستودع) | التحقق |
|---|---|---|---|
| **Git** | ≥ 2.40 | مزامنة الفرع، فتح PR، رفع `5.json` | `git --version` |
| **GitHub CLI (gh)** أو الموقع الويب | gh ≥ 2.x | إطلاق/قراءة Actions، `--log-failed`، تعليقات PR | `gh auth status` |
| **JDK** | **17** (توزيعة zulu مطابقة لـ CI) | CI يثبّت `temurin/zulu 17` عبر `setup-java@v4`؛ `jvmTarget = 17` | `java -version` |
| **Android SDK** | Platform **36** + Build-Tools أحدث 34/35+ + Platform-Tools + Emulator | `compileSdk = 36`, `targetSdk = 36`, `minSdk = 26` | `sdkmanager --list_installed` |
| **KVM** (Linux فقط) | مفعّل | محاكي Stage 3 في CI يستخدم `swiftshader_indirect` مع KVM | `ls /dev/kvm` |
| **Flutter + Dart** | Flutter **3.22.3** stable | الإصدار المثبّت في `release-mobile` — طابقه لتفادي فروق التحليل | `flutter --version` |
| **Bun + Node** (اختياري للويب) | Bun 1.x / Node 22 | تشغيل فحوص `quality` محليًا قبل الرفع: `bun tsc -b --noEmit` ثم `bun run lint` (البوابة صارت صلبة) | `bun --version` |

> **ملاحظات بيئية مؤكدة:**
> - `keystore.properties` **غير مطلوب** لبناء debug — السكربت يتعامل مع غيابه (`takeIf { it.isFile }`). لا تُنشئه ولا ترفعه أبدًا؛ بياناته (إن لزمت لاحقًا للإصدار) تُدار كأسرار GitHub (`KEYSTORE_BASE64`, `KEYSTORE_PASSWORD`, `KEY_ALIAS`, `KEY_PASSWORD`).
> - `google-services.json` **غير موجود وغير مطلوب**: plugin `google-services` غير مطبَّق في `android/app/build.gradle.kts`. إعدادات Firestore تُقرأ من `keystore.properties` بقيمة افتراضية فارغة.
> - إن كتب جهازك `SDK location not found`: أنشئ `android/local.properties` بسطر `sdk.dir=/مسار/الأندرويد/SDK` (ملف محلي لا يُرفع).
> - أول تشغيل `./gradlew` ينزّل Gradle **8.11.1** تلقائيًا من الـ wrapper — لا تغيّره.

---

## ب. خطوات المالك (بالترتيب الإلزامي)

### 1) مزامنة الفرع
انقل حالة مساحة العمل الحالية إلى الفرع `chore/phase-1-build-and-ci-recovery` (عبر مزامنة المنصة أو تنزيل/رفع يدوي من جهاز المالك). تحقق قبل المتابعة من وجود آخر تغييرات دفعة lint:

```bash
git fetch origin
git checkout chore/phase-1-build-and-ci-recovery
git log --oneline -5            # يجب أن يظهر commit دفعة lint-gate
ls RUN_120_EVIDENCE.md TECHNICAL_DEBT.md PHASE1_FINAL.md FLUTTER_APPROVAL_MATRIX.md OWNER_RUNBOOK.md
```

### 2) فتح Pull Request
```bash
gh pr create --base main --head chore/phase-1-build-and-ci-recovery \
  --title "Phase 1: build/CI recovery + lint gate (46→0) + Phase-1 reports" \
  --body "P1-A fix (Gradle Kotlin DSL imports) + lint hard gate + Room 4→5 groundwork + reports. CI = Run #120 evidence."
```
فتح الـ PR نفسه يُطلق التشغيل تلقائيًا (`pull_request → main`). ممنوع الدمج حتى اكتمال §ج أدناه.

### 3) تشغيل Run #120
- تلقائيًا عند الـ PR أعلاه، أو يدويًا:
```bash
gh workflow run "Integrated CI/CD Pipeline" --ref chore/phase-1-build-and-ci-recovery
```
- أو من الموقع: `Actions → Integrated CI/CD Pipeline → Run workflow → الفرع chore/phase-1-build-and-ci-recovery`.
- **سجّل فورًا** (تُستخدم في الخطوة 6):
```bash
gh run list --branch chore/phase-1-build-and-ci-recovery --limit 3
RUN_ID=<رقم التشغيل>   # الـ URL: https://github.com/AlySelim2001/legal-clay-app/actions/runs/<RUN_ID>
```

### 4) تنزيل السجل والأرتيفاكتس
```bash
gh run view "$RUN_ID" --log > run120-full.log
gh run download "$RUN_ID" -D run120-artifacts
# الأرتيفاكتس المتوقعة: jvm-test-reports · instrumentation-test-reports · CRIM-SYS-2026-Debug-APK
```
(بديل يدوي بلا gh: صفحة التشغيل ← زر «Download log archive»، وأزرار الأرتيفاكتس في جانب الصفحة.)

### 5) استخراج `--log-failed`
```bash
gh run view "$RUN_ID" --log-failed > run120-failed.log
# أول 3 أخطاء زمنيًا فقط — لا تقرأ الأخطاء المتتالية (cascading):
grep -nE "^e: |error:|FAILED|FAILURE:" run120-failed.log | head -20
```

### 6) تعبئة `RUN_120_EVIDENCE.md` §4
املأ كل حقل من قالب §4: رقم التشغيل، الـ URL، وقت البدء UTC، SHA، أول سبب جذري **حرفيًا**، آخر 200 سطر، الملفات:الأسطر، وطبقة الفشل من جدول §3. أرفق السجل الخام كأرتيفاكت أو تعليق PR.

### 7) تشغيل اختبارات Android (JVM) — بعد نجاح `Build Debug APK`
```bash
cd android
./gradlew test --no-daemon --stacktrace -Dorg.gradle.jvmargs="-Xmx3g -Dfile.encoding=UTF-8"
```
التقارير تظهر في `app/build/reports/tests/`. في CI هذه البوابة هي مهمة `🧪 Android JVM Tests` (اختبارات parity الخمسة أولًا ثم `test` الكاملة).

### 8) تشغيل اختبار Room 4→5
> **شروط مسبقة إلزامية (بالترتيب):**
> 1. نجاح `assembleDebug` — إذ يُصدّر KSP تلقائيًا `android/app/schemas/net.crimsys.app.data.local.CrimSysDatabase/5.json`. **لا تنشئه يدويًا أبدًا.**
> 2. رفع `5.json` إلى الفرع بنفس commit إصلاح أي تعديل schema لاحق.
>
> الاختبار **instrumented** (في `androidTest`، لا Robolectric على JVM) — يلزم محاكي:
```bash
cd android
# محاكي API 36 x86_64 (طابق CI)، ثم:
./gradlew connectedDebugAndroidTest \
  -Pandroid.testInstrumentationRunnerArguments.class=net.crimsys.app.data.local.RoomMigration4To5Test \
  --no-daemon --stacktrace -Dorg.gradle.jvmargs="-Xmx3g -Dfile.encoding=UTF-8"
```
> **ملاحظة قرار (لا تُنفَّذ ضمن هذا السجل):** بوابة CI الحالية (مهمة `📱 Instrumented Tests`) تُشغّل `RoomMigration3To4Test` فقط عبر فلتر الفئة. إضافة `RoomMigration4To5Test` إلى الفلتر — أو إدخال `5.json` والاختبار في البوابة — قرار يُتخذ بعد نجاح Run #120 وتوليد `5.json` فعليًا.

### 9) تشغيل Flutter — **فقط بعد إقرار `FLUTTER_APPROVAL_MATRIX.md`**
ممنوع قبل الموافقة الصريحة على الحزم. الحزم المعتمدة تُضاف أولًا إلى `pubspec.yaml` (قرار منفصل موثق)، ثم:
```bash
cd mobile_app
flutter pub get
flutter analyze
flutter test
flutter build apk --debug    # debug أثناء التحقق؛ release يبقى لبوابة الإصدارات
```
> ضع `FLUTTER_GAP_REPORT.md` أمامك: 3 اختبارات تستورد بأسماء حزم خاطئة (`package:legal_clay`, `package:mobile`) وexport مكسور — إصلاحها تعديل كود محلي منفصل عن إضافة أي dependency خارجية (بند 23 من التوجيه).

### 10) رفع النتائج إلى الـ Pull Request
```bash
gh pr comment --body "Run #120: <PASS/FAIL> — <طبقة الفشل من §3> — الأدلة في RUN_120_EVIDENCE.md §4"
# اختباريًا وإن وجدت ملفات أدلة/سجلات جديدة:
git add RUN_120_EVIDENCE.md && git commit -m "docs(ci): record Run #120 evidence" && git push
```
ثم قارن النتيجة مع §ج: **لا دمج قبل تحقق كل شروط النجاح.**

---

## ج. شروط النجاح (بوابات الدمج — كلها إلزامية)

| # | الشرط | الدليل المقبول |
|---|---|---|
| 1 | **lint ناجح في CI** | مهمة `🔍 Web Quality` خضراء — `ESLint (hard gate)` صلبة (بلا continue-on-error، متحقق بنيويًا) |
| 2 | **Android build ناجح** | مهمة `🤖 Android Build` خضراء + أرتيفاكت `CRIM-SYS-2026-Debug-APK` |
| 3 | **Android unit tests ناجحة** | مهمة `🧪 Android JVM Tests` خضراء (parity الخمسة + `test` الكاملة) |
| 4 | **RoomMigration4To5Test ناجح** | خرج `connectedDebugAndroidTest` أخضر للفئة `…RoomMigration4To5Test` محليًا، ثم ضمن بوابة CI بعد قرار الخطوة 8 |
| 5 | **schema 5.json مولدة من KSP** | الملف موجود في `android/app/schemas/…CrimSysDatabase/` بعد `assembleDebug` — **وليس مكتوبًا يدويًا** |
| 6 | **لا ثغرات حرجة** | مهمة `🛡️ Security & Supply-Chain Audit` خضراء (Bandit `-lll` تفشل على أي إيجاد high) |
| 7 | **Flutter لا يُفعَّل قبل الإقرار** | `pubspec.yaml` غير معدّل حتى الآن + إقرار موثق لـ `FLUTTER_APPROVAL_MATRIX.md` قبل أي `pub add` |

**فقط عند تحقق 1–7 معًا:** يُسمح بدمج الـ PR. أي شرط ناقص = توقف عند البند المقابل في §ب.

---

## د. حالات الفشل (التصنيف والاستجابة الأولى)

> القاعدة الملزمة من `RUN_120_EVIDENCE.md` §5: **طبقة فشل واحدة = commit واحد.** لا إصلاح مجمّع، ولا ترقية اعتماديات، ولا تغيير AGP/compileSdk/Kotlin/KSP دون بيان سبب وأثر (Robolectric/Hilt/KSP) وتحديث wrapper عند الحاجة.

| الطبقة | التوقيع في السجل الخام (كيف تعرفها فورًا) | الاستجابة الأولى |
|---|---|---|
| **1. بيئة** | `No space left`، `kvm not available`، انتهاء مهلة بلا رسالة مترجم، `SDK location not found`، `java: not found` | لا تُعدَّل الكود. أصلح البيئة (مساحة، KVM، `local.properties`) وأعد التشغيل؛ سجّلها `NOT RUN (بيئة)` إن تعذر |
| **2. Gradle (Configuration)** | `e: file://…build.gradle.kts:<سطر>` أو `Could not get unknown property` قبل بدء أي مهمة — طبقة Run #119 المصلَحة؛ إن عادت: راجع imports الـ DSL أولًا | commit جراحي واحد على السكربت المتأثر + `./gradlew help` قبل الدفع |
| **3. Kotlin / KSP / Hilt** | `e: file://…src…` من `:app:compileDebugKotlin` / `error:` من `:app:kspDebugKotlin` / `[Dagger/…]` | استخرج **أول 3 أخطاء زمنيًا** (ملف:سطر) قبل أي تعديل؛ commit واحد لكل طبقة |
| **4. Room** | `Migration didn't properly handle`، `Room cannot verify the data integrity`، غياب `5.json` بعد بناء ناجح | تأكد أن `5.json` من KSP وليست يدوية؛ لا تكتب schema يدويًا؛ راجع `MIGRATION_4_5` بمطابقة `4.json` → `5.json` |
| **5. Flutter** | `Version solving failed`، `Target of URI doesn't exist`، فشل `flutter analyze/test` | بدون إقرار المصفوفة: **توقف — لا تضف حزم لإسكات الأخطاء**. الإصلاحات المحلية (أسماء الحزم في الاختبارات) تسبق أي dependency خارجية |
| **6. CI configuration** | `needs` إلى مهمة غير موجودة، YAML معطوب، خطوة تشتغل ومصدرها غير واضح | أصلح `main.yml` في commit مستقل؛ تحقق بنيويًا (`yaml.safe_load` + رسم needs) قبل الدفع |

**بعد أي فشل:** حدّث `RUN_120_EVIDENCE.md` §4 من السجل الخام فقط — لا تخمين، ولا ادعاء نجاح اختبار لم يُشغَّل فعليًا.

---

## حد التوقف

هذا الملف توثيق تشغيلي فقط. عند اكتمال §ب-1 إلى §ب-10 وتحقيق §ج: ادمج ثم ابدأ قرار بوابة Room 4→5 في CI (الخطوة 8) وإقرار مصفوفة Flutter — كلاهما بتوجيه صريح من المالك.
