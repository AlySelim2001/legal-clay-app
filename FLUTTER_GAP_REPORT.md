# FLUTTER_GAP_REPORT.md — سطح Flutter (`mobile_app/`)

> **التاريخ:** 2026-09-19
> **المنهجية:** فحص ساكن فقط — لا يوجد Flutter/Dart SDK في بيئة التنفيذ، لذلك لم يُنفَّذ
> `flutter analyze` ولا `flutter pub get`. كل بند أدناه مستخرج بـ `grep`/`find` مباشرة
> من `mobile_app/lib/**` و `mobile_app/test/**` مقابل `mobile_app/pubspec.yaml`.
> **لا ادعاء بناء ولا اختبار — الفحص ساكن حصريًا.**

---

## 1. الحكم التنفيذي

❌ **السطح غير قابل للبناء بصيغته الحالية — بعائقين مستقلين:**

1. **فجوة pubspec:** 13 حزمة مستوردة في الكود **غير معلنة** في `pubspec.yaml` (§2).
2. **استيرادات مكسورة بنيويًا (لا يصلحها إكمال pubspec):** 3 ملفات اختبار تستورد باسم
   حزمة خاطئ (`package:legal_clay/…` و `package:mobile/…` بينما اسم الحزمة `mobile_app`)،
   و1 `export` نسبي يُشير لمسار غير موجود (§3).

أي أمر من `flutter pub get && flutter analyze && flutter test && flutter build apk`
سيفشل حتى بعد إقرار جدول §5 دون معالجة §3 أيضًا.

عدد ملفات Dart المفحوصة: **33 ملفًا** (28 في `lib/` + 5 في `test/`).

---

## 2. حزم مستخدمة وغير معلنة (تمنع البناء)

مستخرجة بـ: `grep -rhE "^(import|export) " mobile_app/lib mobile_app/test --include="*.dart"`

| الحزمة المستوردة | مواضع الاستيراد | معلنة؟ | الغرض الفعلي في الكود | البديل المحلي/المفتوح |
|---|---|---|---|---|
| `package:provider` | 6 استيرادات | ❌ | طبقة `presentation` (حقن الحالة في HomeShell ومتحكمات a11y/voice) | `InheritedWidget` يدويًا (إعادة كتابة كبيرة — غير عملي) |
| `package:dio` + `package:dio/io` | 2 | ❌ | `data/backend/backend_client.dart` (HTTPS-only + TLS pin fail-closed كما في README) | `http` معلن فعلًا لكنه لا يوفر interceptors/pinning بنفس العقد |
| `package:camera` | 1 | ❌ | `presentation/scanner/scanner_page.dart` (التقاط المستندات) | `image_picker` (تغيير واجهة) |
| `package:crypto` | 1 | ❌ | SHA-256 لسلسلة عهدة الأدلة/التجزئة | تنفيذ يدوي (مرفوض أمنيًا) |
| `package:flutter_secure_storage` | 1 | ❌ | `data/local/db_key_manager.dart` (مفتاح SQLCipher Keystore-backed) | لا بديل آمن مكافئ |
| `package:flutter_tts` | 1 | ❌ | `presentation/voice/voice_gateway.dart` (بوابة الصوت) | لا بديل |
| `package:intl` + `package:intl/date_symbol_data_local` | 2 | ❌ | تهيئة التواريخ العربية/تنسيق الموعد القانوني | تنفيذ يدوي (هشّ) |
| `package:path` | 1 | ❌ | معالجة مسارات ملفات الأدلة | `dart:io` يدويًا |
| `package:path_provider` | 1 | ❌ | مجلدات تخزين الأدلة المشفرة | لا بديل |
| `package:sqflite` | 1 | ❌ | `data/local/app_database.dart` | لا بديل |
| `package:sqflite_sqlcipher` | 1 | ❌ | التشفير AES-256 لقاعدة البيانات (ادعاء README الأمني الأساسي) | SQLCipher مطلوب أمنيًا — لا يُستبدل |
| `package:speech_to_text` | 1 | ❌ | `voice_gateway.dart` (STT) | لا بديل |
| `flutter_localizations` (SDK) | 1 | ❌ | تعريب مادي + RTL | يدوي جزئيًا فقط |

> ملاحظة توثيقية: README (`mobile_app/README.md`) يصف dio/SQLCipher/pinning/PII-gate
> **كأنها موجودة** — والكود يستوردها فعلًا لكن pubspec لا يعلنها. الاتجاه الأصح
> هندسيًا هو "رفع الكود لمستوى الوثائق" عبر إقرار جدول §5، والقرار النهائي لصاحب
> المشروع (البند 2 من AUDIT_REPORT §29).

---

## 3. استيرادات مكسورة بنيويًا (تمنع الترجمة حتى بعد §5)

مستخرجة بفحص وجود الهدف لكل استيراد نسبي/باسم حزمة:

| الملف | السطر | الاستيراد | المشكلة |
|---|---|---|---|
| `test/egyptian_deadline_calculator_test.dart` | 2 | `package:legal_clay/domain/legal/egyptian_deadline_calculator.dart` | اسم الحزمة الصحيح `mobile_app` — **اسم خاطئ** |
| `test/pii_scrubber_test.dart` | 2 | `package:legal_clay/domain/security/pii_scrubber.dart` | **اسم خاطئ** |
| `test/features/rag/rag_repository_test.dart` | 5 | `package:mobile/features/rag/data/rag_repository.dart` | **اسم خاطئ** (`package:mobile` ≠ `package:mobile_app`) |
| `lib/presentation/main_container.dart` | 4 | `export '../../main.dart' show AppContainer;` | الهدف `mobile_app/main.dart` — **الملف غير موجود** (نقطة الدخول `lib/main.dart` فقط) |

الإصلاح الصحيح (بعد الموافقة): تعديل الاسماء الثلاثة إلى `package:mobile_app/…`،
وحسم `export` الـ `main_container` (إما إنشاء `lib/main.dart` كنقطة دخول أو
تغيير المسار النسبي) — قرار صغير لكنه يُنفَّذ كتغيير مستقل قابل للتراجع.

**تنبيه أوسع:** بالإضافة إلى أعلاه، توجد 4 استيرادات نسبية تجتاز فحص الوجود
(`../domain/models/*.dart`, `../a11y/…`, `../theme/clay_theme.dart`, `../voice/voice_gateway.dart`)
لكنها تنطلق من ملفات داخل `lib/features/**` و`lib/presentation/**` — أي أنها
تعتمد على أن أهدافها داخل نفس الشجرة. فحص الوجود الثابت عبرها ✅، لكن التحقق
النهائي من المسارات يعود بعد أول `flutter analyze` حقيقي.

---

## 4. معلنة وغير مستخدمة (تنظيف، لا يمنع البناء)

| الحزمة | الحالة | الإجراء المقترح |
|---|---|---|
| `cupertino_icons` (معلنة `^1.0.8`) | صفر استخدامات في `lib/` و`test/` | حذفها من `pubspec.yaml` عند أول تعديل معتمد (تغيير مستقل) |

---

## 5. جدول الموافقة (إلزامي قبل أي تعديل على pubspec — بند 5 من البروتوكول)

> لا يُعدَّل `pubspec.yaml` قبل إقرار صاحب المشروع لهذا الجدول. أعمدة الترخيص
> والصيانة تُتأكد نهائيًا من pub.dev لحظة القبول؛ الأعمدة أدناه قيد أولي عالي
> الثقة ولا تُغني عن التأكيد.

| الحزمة | الإصدار المقترح | الترخيص (قيد أولي) | الصيانة | سبب الحاجة | المخاطر | البديل |
|---|---|---|---|---|---|---|
| provider | ^4.5.4 | MIT | نشط (flutter.dev) | 6 استخدامات قائمة | منخفضة — ناضج جدًا | لا عمليًا |
| dio | ^5.7.0 | MIT | نشط | BackendClient + pinning | متوسطة — سطح API واسع | `http` (يفقد العقد الحالي) |
| camera | ^0.11.0 | BSD-3 | نشط (flutter/packages) | ماسح المستندات | منخفضة | image_picker |
| crypto | ^3.0.6 | BSD-3 | نشط (dart-lang) | SHA-256 للعهدة | منخفضة جدًا | لا (مرفوض أمنيًا) |
| flutter_secure_storage | ^9.2.2 | BSD-3 | نشط | مفتاح DB Keystore-backed | منخفضة-متوسطة (قنوات المنصة) | لا |
| flutter_tts | ^4.2.0 | MIT | نشط | بوابة الصوت TTS | منخفضة | لا |
| speech_to_text | ^7.0.0 | MIT | نشط | بوابة الصوت STT | منخفضة | لا |
| intl | ^0.20.0 | BSD-3 | نشط (dart-lang) | تواريخ عربية للمواعيد القانونية | **يجب مطابقة إصدار `flutter_localizations` المثبت** | يدوي (هشّ) |
| flutter_localizations | SDK (flutter) | BSD-3 | رسمي | تعريب + RTL | لا شيء | لا |
| path | ^1.9.0 | BSD-3 | نشط | مسارات الأدلة | لا شيء | يدوي |
| path_provider | ^2.1.4 | BSD-3 | نشط (flutter/packages) | مجلدات التخزين | منخفضة | لا |
| sqflite | ^2.4.0 | MIT | نشط | طبقة SQLite | منخفضة | لا |
| sqflite_sqlcipher | ^3.1.0 | MIT (يُؤكد) | نشط (tekartik) | تشفير AES-256 — أساس ادعاء أمني | متوسطة (native binary لكل منصة) | لا — استبداله يهدم الضمانة الأمنية |

**مستبعد عمدًا:** لا يُضاف أي شيء آخر (لا state management إضافي، لا getit/bloc،
لا firebase) — كل سطر في الجدول له استخدام فعلي موثق في §2.

---

## 6. خطة التنفيذ بعد الموافقة (بالترتيب، كل خطوة بوابة للتي بعدها)

1. تعديلات §3 (أسماء الحزم + export) — **commit مستقل**.
2. إدراج جدول §5 في `pubspec.yaml` + حذف `cupertino_icons` — **commit مستقل**.
3. `flutter pub get` → ثم `flutter analyze` → ثم `flutter test` → ثم `flutter build apk --release`.
4. أي خطأ يظهر يُعالَج في commit منفصل — بلا تخمين وبلا إضافات خارج الجدول.
5. في بيئة التنفيذ الحالية: الخطوات 3 لم تُنفَّذ (**Flutter SDK غير متوفر**) — تُنفَّذ
   على جهاز المالك أو CI (`release-mobile` موجود في `main.yml` لكنه بوابة إصدار موسومة فقط).

---

**نهاية التقرير — لا تعديل على أي ملف Dart أو pubspec قبل إقرار جدول §5.**
