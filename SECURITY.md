# Security Policy — سياسة الأمن

<div dir="rtl">

## الإبلاغ عن ثغرة أمنية

أمن هذا التطبيق مسؤولية أخلاقية لأنه يحمل بيانات قضايا حقيقية. **لا تفتح Issue عاماً للثغرات** — استخدم إحدى القنوات الخاصة:

1. **GitHub Private Vulnerability Reporting**: من صفحة المستودع ← Security ← "Report a vulnerability" (الأسرع).
2. **البريد الإلكتروني:** security@crimsys.example *(استبدلها بعنوان المشرف الفعلي قبل الإطلاق)*.

## ما الذي نحتاجه منك؟

- وصف الثغرة وتأثيرها المحتمل.
- خطوات إعادة الإنتاج أو إثبات المفهوم (PoC).
- إصدار التطبيق / الكوميت المتأثر، وإصدار أندرويد.
- اقتراحك للإصلاح إن وُجد (اختياري).

## التزامنا تجاهك

- **الرد الأولي خلال 72 ساعة** من الإبلاغ.
- إبقاءك على اطلاع بالتقييم والإصلاح.
- الإشادة العلنية بك (إن رغبت) في الإصدار الذي يصلح الثغرة.

## نطاق الحماية

| داخل النطاق ✅ | خارج النطاق ❌ |
|----------------|----------------|
| تسريب/ضعف تشفير قاعدة بيانات SQLCipher أو إدارة مفتاح Keystore | اختبارات اختراق على خدمات Google/Firebase نفسها |
| تجاوز سياسة الشبكة (Network Security Config / TLS) | هجمات تتطلب جهازاً بروت كامل (rooted) بشكله الطبيعي |
| منطق طابور المزامنة وتسليم البيانات إلى Firestore | الثغرات في المكتبات يجب الإبلاغ عنها لمصدريها أولاً |
| مكوّنات واجهة معالجة بيانات حساسة | تقارير سبام أو من المختبرات الآلية بدون تفصيل |

## الأمان المعماري الحالي

- **تشفير محلي:** SQLCipher بمفتاح 256-bit عشوائي ملفوف بمفتاح Android Keystore (AES-GCM).
- **استبعاد النسخ الاحتياطي السحابي** لقاعدة البيانات وملف المفتاح (`backup_rules.xml`, `data_extraction_rules.xml`).
- **شبكة مغلقة:** Cleartext محظور؛ TLS مقيّد بنطاقات Google/Firebase + GitHub API فقط.
- **أسرار خارج المستودع:** `keystore.properties` و`google-services.json` في `.gitignore`.
- **R8/ProGuard** مع حفظ الـ mapping للتحليل الجنائي للأعطال.

</div>

<div dir="ltr">

## Reporting a Vulnerability

**Please do NOT open a public issue for security vulnerabilities.**

1. **Preferred:** GitHub Private Vulnerability Reporting (Repository → Security → Report a vulnerability).
2. **Email:** security@crimsys.example *(replace with the actual maintainer address before launch)*.

Include a description, reproduction steps/PoC, affected version/commit, and — if
possible — a suggested fix. We commit to an initial response within **72 hours**
and will keep you informed through triage and remediation.

## Supported Versions

| Version | Supported |
|---------|-----------|
| 2026.1.x | ✅ |
| < 2026.1 | ❌ (upgrade) |

## Architectural Security Summary

- SQLCipher-encrypted Room DB; passphrase is Keystore-wrapped random 256-bit key
- DB file + key blob excluded from cloud backups
- Cleartext blocked; TLS restricted to Google/Firebase endpoints + GitHub API
- Secrets never in VCS (`keystore.properties`, `google-services.json` git-ignored)
- R8 with retained mapping files for crash de-obfuscation

</div>
