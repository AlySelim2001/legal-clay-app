# FLUTTER_APPROVAL_MATRIX.md — مصفوفة موافقة حزم سطح Flutter

> **التاريخ:** 2026-09-19
> **قاعدة التوجيه:** لا تعديل على `pubspec.yaml` — هذا الملف للقرار فقط.
> كل بند مبني على فحص الاستيرادات الفعلي (FLUTTER_GAP_REPORT §2–§3) وفحص ساكن إضافي
> لملفات إعداد الأندرويد (`mobile_app/android/app/build.gradle.kts`: minSdk 23).
> أعمدة الترخيص/الصيانة: أفضل معرفة لحظة الكتابة — **تُؤكَّد نهائيًا من pub.dev عند الاعتماد**.

**أساس القرار الموحد:** الاستخدام فعلي (استيرادات حية في الكود) لكل الحزم الثلاث عشرة —
لا توجد حزمة وهمية في القائمة؛ لكن لا يوجد Flutter SDK للاختبار هنا ⇒ **DEFER الافتراضي
لكل حزمة حتى تتوفر بيئة `flutter analyze && flutter test`** (محلية أو CI). لا يُرفع أي
إصدار إلى pubspec قبل ACCEPT صريح من المالك + نجاح الاختبارات في بيئة حقيقية.

| # | الحزمة | مكان الاستخدام | الاستخدام | الإصدار المقترح | سبب الحاجة | الترخيص* | توافق Flutter/Dart* | مخاطر الصيانة | البديل | أثر المنصات | إعداد أصلي؟ | حجم التطبيق | القرار |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | provider | 6 استيرادات في `presentation/**` (HomeShell، حقن AppContainer وa11y/voice controllers) | **فعلي** | ^4.5.4 | طبقة حقن الحالة القائمة — إزالتها إعادة كتابة معمارية | MIT | متوافق (Dart ≥3.0) | منخفض — ناضج جدًا | InheritedWidget يدويًا (كبير ومكلف) | Android/iOS؛ لا أثر ويب (السطح موبايل فقط) | لا | ضئيل (<50KB) | **DEFER** |
| 2 | dio | `data/backend/backend_client.dart` (+ `dio/io`) | **فعلي** | ^5.7.0 | HTTPS-only + TLS pin fail-closed (عقد README الأمني) | MIT | متوافق | متوسطة — سطح API واسع | `http` المعلن (يفقد interceptors/pinning — لا يفي العقد) | Android/iOS | لا | ~300KB | **DEFER** |
| 3 | camera | `presentation/scanner/scanner_page.dart` | **فعلي** | ^0.11.0 | التقاط المستندات في الماسح | BSD-3 | متوافق | منخفضة (flutter/packages) | image_picker (تغيير واجهة المسح) | **Android/iOS — لا يعمل على الويب** (وقد يكون مقصودًا) | **نعم — أذونات كاميرا في AndroidManifest** (CAMERA + features) | كبير (native libs) | **DEFER** |
| 4 | crypto | استيراد واحد (SHA-256 لسلسلة العهدة/التجزئة) | **فعلي** | ^3.0.6 | تجزئة الأدلة — أساس حوسبي | BSD-3 | متوافق | منخفضة جدًا (dart-lang/core) | لا — التنفيذ اليدوي مرفوض أمنيًا | الكل | لا | ضئيل | **ACCEPT جاهز عند فك الحجب** |
| 5 | flutter_secure_storage | `data/local/db_key_manager.dart` | **فعلي** | ^9.2.2 | تخزين مفتاح DB بمتانة Keystore — شرط أمني | BSD-3 | متوافق | منخفضة-متوسطة (قنوات منصة متعددة) | لا بديل آمن مكافئ | Android (Keystore)/iOS (Keychain) | **نعم — proguard rules قائمة فعلًا** في `mobile_app/android/app/proguard-rules.pro` | ضئيل-متوسط | **DEFER** |
| 6 | flutter_tts | `presentation/voice/voice_gateway.dart` | **فعلي** | ^4.2.0 | بوابة الصوت (TTS) | MIT | متوافق | منخفضة | لا بديل | Android/iOS | لا (إعدادات صمت اختيارية) | متوسط (روابط منصة) | **DEFER** |
| 7 | speech_to_text | `voice_gateway.dart` | **فعلي** | ^7.0.0 | بوابة الصوت (STT) | MIT | متوافق | منخفضة | لا بديل | **Android: RECORD_AUDIO إذن وقت التشغيل**؛ iOS: NSSpeechRecognition* | **نعم — إذن مايك وقت التشغيل** | متوسط | **DEFER** |
| 8 | intl | `intl` + `intl/date_symbol_data_local` (تهيئة التواريخ العربية) | **فعلي** | ^0.20.0 (يُقفل مطابقًا لـ flutter_localizations) | تنسيق/تحقق مواعيد المواعيد القانونية العربية | BSD-3 | متوافق | منخفضة (dart-lang) | يدوي (هش على تقويمات/أرقام عربية) | الكل | لا | ~500KB (بيانات locales) | **DEFER** |
| 9 | flutter_localizations | SDK flutter — استيراد واحد | **فعلي** | يتبع SDK | Material تعريب + RTL رسمي | BSD-3 | مرآة SDK | لا شيء | جزئي يدويًا فقط | الكل | لا | ضمن SDK | **ACCEPT جاهز عند فك الحجب** |
| 10 | path | استيراد واحد (مسارات ملفات الأدلة) | **فعلي** | ^1.9.0 | معالجة مسارات محمولة | BSD-3 | متوافق | لا شيء (dart-team) | dart:io يدويًا (هش على Windows/مسارات) | الكل | لا | ضئيل | **ACCEPT جاهز عند فك الحجب** |
| 11 | path_provider | استيراد واحد (مجلدات التخزين) | **فعلي** | ^2.1.4 | مواقع دليل الأدلة المشفرة | BSD-3 | متوافق | منخفضة (flutter/packages) | لا بديل | Android/iOS | لا | ضئيل | **DEFER** |
| 12 | sqflite | `data/local/app_database.dart` | **فعلي** | ^2.4.0 | طبقة SQLite المحمولة | MIT | متوافق | منخفضة (tekartik، نشط) | لا بديل عملي | **Android/iOS فقط** | لا | متوسط | **DEFER** |
| 13 | sqflite_sqlcipher | `app_database.dart` + `db_key_manager.dart` | **فعلي** | ^3.1.0 (ترخيص yُؤكد من pub.dev) | تشفير AES-256 — **أساس ادعاء أمني موثق** | MIT (يُؤكد) | متوافق (Dart ≥3) | متوسطة (binary لكل منصة) | لا — استبداله يهدم الضمانة | **Android/iOS فقط** | **نعم — native .so** | كبير (native libs لكل ABI) | **DEFER** |

\* يُؤكَّد نهائيًا من pub.dev لحظة الاعتماد — لا يُعتمد هذا الجدول بديلاً عن التحقق.

**ملخص القرار:** 0 ACCEPT نهائي الآن · 3 ACCEPT-جاهز (crypto, flutter_localizations, path) · 10 DEFER · 0 REJECT.
**سقف الحجم التقديري عند ACCEPT الكامل:** ~1–1.5MB إضافية أساسًا من intl + native libs (3، 13).
**ملاحظة أذونات:** ACCEPT الجماعي يستلزم مراجعة AndroidManifest (CAMERA/RECORD_AUDIO وقت التشغيل) — جزء من خطوة ما بعد الموافقة، ليس الآن.

---

## ملحق أ — Patch المقترح لأسما الحزم الخاطئة في الاختبارات (لا يُطبَّق الآن — عرض فقط)

**تحقق الأدلة قبل الاقتراح:** `name:` في pubspec.yaml = `mobile_app`؛ الأهداف الثلاثة
موجودة فعلاً في `lib/` (فحص وجود مباشر). التعديل: اسم الحزمة فقط، بلا تغيير مسارات.

```diff
--- a/mobile_app/test/egyptian_deadline_calculator_test.dart
+++ b/mobile_app/test/egyptian_deadline_calculator_test.dart
@@
-import 'package:legal_clay/domain/legal/egyptian_deadline_calculator.dart';
+import 'package:mobile_app/domain/legal/egyptian_deadline_calculator.dart';

--- a/mobile_app/test/pii_scrubber_test.dart
+++ b/mobile_app/test/pii_scrubber_test.dart
@@
-import 'package:legal_clay/domain/security/pii_scrubber.dart';
+import 'package:mobile_app/domain/security/pii_scrubber.dart';

--- a/mobile_app/test/features/rag/rag_repository_test.dart
+++ b/mobile_app/test/features/rag/rag_repository_test.dart
@@
-import 'package:mobile/features/rag/data/rag_repository.dart';
+import 'package:mobile_app/features/rag/data/rag_repository.dart';
```

## ملحق ب — Patch المقترح للـ export المكسور (لا يُطبَّق الآن — عرض فقط)

**تحقق الأدلة:** `mobile_app/lib/main.dart` موجود ويضم `class AppContainer` (سطر 29)؛
المستوردون الثلاثة (`assistant_page.dart`, `deadlines_page.dart`, `scanner_page.dart`)
يستوردون `../main_container.dart`. الفحص النسبي يكشف أن `'../../main.dart'` من
`lib/presentation/` يشير لغير موجود؛ المسار الصحيح نسبةً لـ `lib/presentation/` هو `../main.dart`.

```diff
--- a/mobile_app/lib/presentation/main_container.dart
+++ b/mobile_app/lib/presentation/main_container.dart
@@
-export '../../main.dart' show AppContainer;
+export '../main.dart' show AppContainer;
```

**ملحق ج — التنظيف المستقل (غير طالب موافقة):** `cupertino_icons ^1.0.8` معلنة
وصفر استخدامات — يُحذف في commit مستقل عند أول فتح لعقد pubspec بعد الموافقة.

**قاعدة التنفيذ بعد الموافقة:** كل patch أعلاه commit مستقل ⇒ `flutter analyze` ⇒
`flutter test` ⇒ ثم فقط فتح ملف pubspec وفق جدول ACCEPT المعتمد. أي فشل يعالج
طبقة-طبقة، بلا إضافات خارج الجدول.
