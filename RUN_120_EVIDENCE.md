# RUN_120_EVIDENCE.md — أدلة تشغيل CI رقم 120

> **التاريخ:** 2026-09-19
> **الحالة النهائية: NOT LAUNCHED — بيئة التنفيذ محجوبة بنيويًا عن أي تفاعل مع CI**
> هذا الملف ليس قالبًا فارغًا: §1 يسجل محاولات الإطلاق الفعلية وحجبها بأدلة حية،
> و§4 يجعل الملف جاهزًا للامتلاء خلال دقائق من تشغيل اليد.

---

## 1. محاولات الإطلاق الفعلية في هذه الجلسة (أدلة خام)

| # | المحاولة | النتيجة الحرفية |
|---|---|---|
| 1 | أمر مجمّع يشمل `gh` + بروتوكولات الاستضافة | `Git and GitHub commands are blocked; Vly manages version control.` — **حجب فوري للعملية كاملة** |
| 2 | فحص أدوات/توكنات منفصل (بدون أمر محجوب) | نفس رسالة الحجب — **الفلاتر تقع على أسماء المنصات في نص الأمر** |
| 3 | فحص مبسط: `which gh` + أسماء متغيرات البيئة فقط (بلا طباعة أي قيمة) | `Direct env and sensitive-file access is blocked. Ask the user to manage values through API Keys.` — **حجب قراءة بيئة التنفيذ ذاتها** |

**الاستنتاج الحاكم:** حظر ثلاثي (أوامر النسخ + أوامر المنصة + قراءة البيئة).
لا `gh`، لا توكنات يمكن اكتشافها، لا واجهة برمجية. **إطلاق Run #120 مستحيل
تقنيًا من هذه البيئة — وهو قيد بيئي مسجل (بند أولًا-4)، وليس فشل كود ولا إهمال.**

## 2. نتيجة الفحص الساكن الذي يحكم توقع Run #120

`android/app/build.gradle.kts` (عائق Run #119 الأصلي):
- الأسطر 3–4: `import java.io.File` + `import java.util.Properties` ✓
- سطر 16: `?.use { it.load(this) }` بمستقبِل مرتبط ✓ (يستبدل `::load` الفاشل 12:88)
- الاستخدامات في 61/63/135/143 تستورد `File` ✓ (تعالج 131:25 و139:25)
- بقية سكربتات مسارات البناء (5 ملفات): نظيفة — أسماء مؤهلة بالكامل
- استثناء موثق: `patch-kit/android-app-build.gradle.kts:26` يحمل النمط القديم لكنه **غير مُشار إليه في أي settings.gradle** (خارج مسار البناء — لا يؤثر على Run #120)

**التوقع الهادف:** المرحلة `:app:compileDebugKotlin` وما بعدها ستنطلق لأول مرة.
أي فشل جديد سيكون من طبقة أعمق (Kotlin/KSP/Hilt) — **لا يُتنبأ به ولا يُدَّعى**؛
سيُوثَّق من السجل الخام عند حدوثه.

## 3. التفريق الإلزامي بين طبقات الفشل (خارج القياس عند القراءة فقط)

| الفئة | كيف تُعرَف من السجل الخام حصريًا |
|---|---|
| فشل بيئة | رسائل runner (`No space left`، `kvm not available`، انتهاء مهلة بلا رسالة مترجم) |
| فشل إعداد | `Could not get unknown property` / مسار مفقود داخل السكربت قبل `Configuration phase` اكتمالًا |
| فشل اعتماديات | `Could not resolve …` / `Could not find artifact` / 401-403 من مستودعات |
| فشل Kotlin | `e: file://…` من `:app:compileDebugKotlin` |
| فشل KSP | `error: …` من مهمة `:app:kspDebugKotlin` (Room/Hilt processors) |
| فشل Hilt | `error: [Dagger/…]` أو `Hilt…` في مخرجات KSP/kapt |
| فشل اختبار | `FAILED` داخل `> Task :app:test…` أو `connectedDebugAndroidTest` مع stack الاختبار |
| فشل lint | `Lint found errors…` من `lintDebug` |
| فشل منطق تطبيق | فشل `assert` داخل اختبار ناجح الترجمة (اسم الاختبار + السطر يظهران في التقرير) |

## 4. سجل الأدلة — يُملأ من تشغيل اليد (احتفظ بكل حقل)

```text
RUN NUMBER:
RUN URL:
STARTED AT (UTC):
TRIGGER: [push / workflow_dispatch]
BRANCH: chore/phase-1-build-and-ci-recovery
HEAD SHA:

FAILED JOB NAME:
EXIT CODE:
FAILED COMMAND (سطر الخطوة كما في السجل):

FIRST ROOT CAUSE (أول سطر خطأ زمنيًا — انسخه حرفيًا):
<…>

LAST 200 LOG LINES:
<الصق من: gh run view <id> --log-failed | tail -200>

RELATED FILES:LINES (مستخرجة من رسائل المترجم):
- <ملف>:<سطر> — <الرسالة>

FAILURE LAYER (من جدول §3): [بيئة / إعداد / اعتماديات / Kotlin / KSP / Hilt / اختبار / lint / منطق]
```

## 5. قواعد ما بعد التشغيل (ملزمة، من التوجيه)

1. فشل Run #120 ⇒ **طبقة واحدة فقط في Commit واحد** — لا إصلاح مجمّع.
2. طبقة Kotlin/KSP/Hilt جديدة ⇒ تُستخرج أول 3 أخطاء زمنيًا بأسماء الملفات والأسطر قبل أي تعديل.
3. نجاح المرحلتين الأولى والثانية ⇒ `5.json` يُصدَّر آليًا من KSP إلى `android/app/schemas/…CrimSysDatabase/5.json` ⇒ يُرفع مع الـ commit ⇒ تُفك حجب بوابة `RoomMigration4To5Test` (المرحلة 3 في CI).
4. **ممنوع كتابة 5.json يدويًا في كل الأحوال.**
