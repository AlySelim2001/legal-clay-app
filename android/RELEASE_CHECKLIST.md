# CRIM-SYS 2026 — تقرير جاهزية الإنتاج / Production Readiness Report

> **الخط الفاصل بين "مشروع تجريبي" و"منتج تجاري حقيقي".**
> This document is the operating manual for cutting a signed release.
> Nothing below is optional for a production APK/AAB.

---

## 1. ما تم تنفيذه (What was hardened)

| # | المجال | التنفيذ |
|---|--------|---------|
| 1 | **المفاتيح والتوقيع** | `app/build.gradle.kts` يقرأ `android/keystore.properties` (خارج Git). مفقود؟ `assembleRelease` يفشل برسالة واضحة بدل توقيع خاطئ صامت. |
| 2 | **R8 / ProGuard** | قواعد keep دقيقة في `app/proguard-rules.pro`: Room (entities/DAOs/`_Impl`)، SQLCipher (JNI)، Hilt، Firestore، kotlinx.serialization، Coroutines، Compose-rich-editor + شطب `Log.v/d` فقط. |
| 3 | **حجم التطبيق** | `isMinifyEnabled` + `isShrinkResources` + `resourceConfigurations("ar","en")` (يحذف كل ترجمات المكتبات الأخرى) + استثناءات `packaging`. |
| 4 | **أمان الشبكة** | `network_security_config.xml`: منع cleartext كلياً، سماح فقط لنطاقات Google/Firestore، شهادات النظام فقط (بدون CA المستخدم). |
| 5 | **النسخ الاحتياطي** | `backup_rules.xml` + `data_extraction_rules.xml` يستثنيان `crimsys.db*` و`crimsys_security.xml` — قاعدة مشفرة بمفتاح Keystore محلي لا تُفك على جهاز آخر، ونسخة لا يمكن فتحها = انهيار عند أول قراءة. |
| 6 | **سرعة البدء** | `app/src/main/baseline-prof.txt` يغطي مسار Cold Start (Hilt → DB open → SyncManager → الشاشة الأولى) + Compose runtime. |
| 7 | **تسمية المخرجات** | مهام `copyReleaseApk` / `copyReleaseBundle` تنتج `CRIM-SYS-<version>-<git-sha>.apk/.aab` في `app/build/distribution/`. |
| 8 | **ML Kit OCR** | معطّل حالياً في التبعيات (لا حاجة لأذوناته في الإنتاج). قواعد keep الخاصة به جاهزة ومعلّقة في `proguard-rules.pro` لإعادة التفعيل المستقبلي. |

> ⚠️ **تنبيه حرج — mapping.txt:** كل بناء release يولّد ملف `app/build/outputs/mapping/release/mapping.txt` فريداً. بدون الأرشفة مع كل إصدار، ستصل تقارير الأعطال مشوّهة وغير قابلة للقراءة. ارفعه إلى Play Console مع كل AAB أو خزّنه مع نسخة التوزيع المباشر.

---

## 2. التهيئة لمرة واحدة (One-time setup)

### أ. إنشاء Keystore التوقيع

```bash
cd android
keytool -genkeypair -v \
  -keystore crimsys-release.jks \
  -alias crimsys \
  -keyalg RSA -keysize 2048 -validity 10000
```

> 🔴 **تحذيرات شائعة في هذه الخطوة بالتحديد:**
> - **فقدان ملف `.jks` أو كلمة المرور = فقدان التطبيق إلى الأبد.** لا يوجد استرداد من Google Play بعد النشر الأول. خزّن نسخة في مكان آمن خارج الأجهزة الشخصية (vault + نسخة باردة).
> - لا تضع `crimsys-release.jks` في Git إطلاقاً — مضاف بالفعل إلى `android/.gitignore`.
> - لا تعيد استخدام keystore تجريبي من مشاريع أخرى.

### ب. ملف المفاتيح

```bash
cp keystore.properties.example keystore.properties
# ثم املأ storePassword و keyPassword بالقيم الحقيقية
```

### ج. التحقق من التوقيع

```bash
# بعد البناء:
$ANDROID_HOME/build-tools/35.0.0/apksigner verify --verbose --print-certs \
  app/build/outputs/apk/release/app-release.apk
```

المتوقع: `Verifies = true`، المخطط `v2/v3`، والبصمة تطابق بصمة الشهادة من `keytool -list`.

---

## 3. بناء النسخ النهائية (Final build commands)

```bash
cd android

# تنظيف إلزامي — بناء فوق artifacts قديمة مصدر شائع لأعطال "يعمل عندي فقط"
./gradlew clean

# (1) APK للتوزيع المباشر على المحامين (خارج Google Play)
./gradlew copyReleaseApk
# → app/build/distribution/CRIM-SYS-<version>-<sha>.apk

# (2) AAB لرفعه على Google Play Console
./gradlew copyReleaseBundle
# → app/build/distribution/CRIM-SYS-<version>-<sha>.aab

# فحوصات ما قبل النشر
./gradlew :app:lintRelease          # lint على نسخة الإنتاج
./gradlew :app:assembleRelease -Pandroid.enableR8.fullMode=true
```

> 🔴 **خطأ شائع:** بناء release من جهاز بلا JDK 17 أو SDK 35 → `assembleDebug` يعمل وrelease يفشل. تأكد: `java -version` (يجب 17.x) و `sdkmanager --list | grep android-35`.

> 🔴 **خطأ شائع:** تعديل `versionCode` بلا رفع `versionName` (أو العكس) يربك Play Console وتتبع الأعطال. ارفعهما معاً في كل إصدار.

---

## 4. اختبار ما بعد البناء (Post-build smoke test)

قبل توزيع أي APK، جرّب يدوياً على جهاز حقيقي:

1. **Cold start** — التطبيق يفتح على لوحة القضايا خلال < ثانيتين.
2. **إنشاء قضية** (بدون إنترنت) — تظهر القضية فوراً، والشريط العلوي يعرض "غير متصل — ستستأنف الرفعات تلقائياً".
3. **تشغيل الشبكة** — بعد عودة الاتصال، أيقونة المزامنة تتحول للسحابة الصحيحة ويصفَّر عدّاد الانتظار.
4. **إعادة تشغيل التطبيق** — البيانات ما زالت موجودة (Room + SQLCipher يعملان).
5. **محرر المذكرة** — عريض/مائل/قوائم ثم حفظ: تظهر رسالة "تم حفظ المذكرة".
6. **تقويم الجلسات** — النقاط الحمراء تظهر على الأيام المحمّلة.
7. **الاستعادة من نسخة احتياطية** (اختياري لكنه مهم قانونياً): استعادة على جهاز آخر يجب ألا تعيد قاعدة بيانات غير قابلة للفتح — يجب أن يعمل التطبيق فارغاً ثم يزامن.

---

## 5. شهادة الإطلاق النهائي (Final Release Certificate)

اطبع هذا القسم وعلّم على كل بند قبل النشر:

### الأمان والمفاتيح
- [ ] `keystore.properties` موجود محلياً و**غير** مضاف إلى Git (`git status` نظيف منه)
- [ ] `crimsys-release.jks` محفوظ في مكانين آمنين على الأقل + كلمات المرور في vault
- [ ] بصمة SHA-256 للشهادة مسجلة في Firebase Console (إن فُعّلت المزامنة)
- [ ] `google-services.json` غير موجود في Git (مضاف بالفعل إلى `app/.gitignore`)
- [ ] لا توجد مفاتيح API في الكود المصدري أو في `BuildConfig` الظاهرة

### البناء والتوقيع
- [ ] `./gradlew clean` ثم `copyReleaseApk` / `copyReleaseBundle` نجحا من دون تحذيرات signing
- [ ] `apksigner verify` = `Verifies: true` على المخرج النهائي
- [ ] `mapping.txt` مؤرشف باسم الإصدار في مكان آمن
- [ ] `versionCode` أُزيح عن الإصدار السابق المنشور

### الأداء والحجم
- [ ] حجم APK/AAB ضمن الحدود المتوقعة (< 15MB مستهدف لهذا التطبيق)
- [ ] Cold start مُقاس (< 2 ثانية على جهاز متوسط)
- [ ] `resourceConfigurations ar,en` فعّالة (لا ترجمات ميتة في المخرج)

### الوظائف الحرجة (Smoke test §4)
- [ ] إنشاء قضية أوفلاين + مزامنة تلقائية عند العودة
- [ ] المذكرة تُحفظ وتُحمّل بعد إعادة التشغيل
- [ ] التقويم يعرض جلسات الأيام الصحيحة
- [ ] لا انهيار عند دوران الشاشة أو تعطيل الإنترنت أثناء الاستخدام

### الأذونات والخصوصية (متطلب Play + متطلب قانوني لمكتبة محاماة)
- [ ] الأذونات في النهاية: `INTERNET` + `ACCESS_NETWORK_STATE` فقط
- [ ] سياسة الخصوصية محدثة (التطبيق يعالج بيانات قضايا حساسة محلياً)
- [ ] Data safety form في Play Console تطابق السلوك الفعلي (التشفير عند السكون = نعم عبر SQLCipher)

---

## 6. ملحق: إعادة تفعيل OCR لاحقاً

عند الحاجة لمسح المستندات على الجهاز:

1. أعد التبعية في `libs.versions.toml` + `app/build.gradle.kts`:
   `com.google.mlkit:text-recognition-arabic:16.0.1`
2. أعد الإذن `CAMERA` في `AndroidManifest.xml` (وأضف `<uses-feature android:name="android.hardware.camera" android:required="false" />`)
3. فك التعليق عن قواعد ML Kit في `proguard-rules.pro` — وإلا سينهار تحميل النموذج في release فقط.
4. أضف نطاقات ML Kit إلى `network_security_config.xml` إذا كان النموذج يُنزّل وقت التشغيل.
