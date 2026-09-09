<div dir="rtl">

# ⚠️ إخلاء المسؤولية القانوني — Legal Disclaimer & Privacy Policy

> **آخر تحديث / Last updated:** سبتمبر 2026

---

## 1) طبيعة الأداة — أداة تنظيمية، ليست استشارة قانونية

**CRIM-SYS 2026** (والمعروف أيضاً بـ LAW-SYS 2026) هو **أداة مساعدة لإدارة المعلومات وتنظيم البيانات القانونية** في المكاتب القانونية. التطبيق:

- **لا يقدّم استشارة قانونية** ولا يُنشئ علاقة محامٍ وموكل،
- **لا يُغني بأي شكل** عن خبرة المحامي المختص ومراجعته اليدوية للملف،
- مخرجاته — بما فيها **حسابات المواعيد النهائية، مدد الطعن، تواريخ الجلسات، وتصنيفات القضايا** — **استرشادية وتقديرية بحتة**.

**القاعدة الذهبية:** قبل اتخاذ أي إجراء قانوني بناءً على ما يعرضه التطبيق، يجب التحقق منه من المصادر الرسمية ومن المحامي المسؤول عن القضية.

## 2) لا مسؤولية عن ضياع المواعيد أو القضايا

إلى أقصى حد يسمح به القانون، **يُخلّي المطوّر مسؤوليته تماماً** عن أي ضرر مباشر أو غير مباشر، بما في ذلك على سبيل المثال لا الحصر:

- **ضياع قضية أو حق أو موعد إجرائي** نتيجة الاعتماد على حسابات التطبيق التلقائية للمواعيد أو المدد،
- أخطاء أو تعطّل في التقويم أو الجداول الزمنية أو المزامنة،
- **انقطاع الشبكة** أو فشل المزامنة السحابية أو تأخرها،
- فقدان بيانات نتيجة عطل في الجهاز أو حذف التطبيق أو إعادة ضبط المصنع أو فشل النسخ الاحتياطي،
- أي استخدام مخالف لدليل الاستخدام أو لإخلاء المسؤولية هذا.

استخدام التطبيق يعني **إقرارك بمسؤوليتك الكاملة** عن متابعة مواعيد قضاياك من القنوات الرسمية، وأن التطبيق مجرد مساعد تنظيمي.

## 3) دقة المحتوى القانوني

القوانين والإجراءات المصرية (قانون الإجراءات الجنائية 150/1950، القانون 174/2025 وغيرها) قابلة للتعديل والتفسير. أي نصوص قانونية أو مراجع أو أحكام معروضة داخل التطبيق:

- **لأغراض المرجعية التنظيمية فقط** ولا تُعدّ نصاً رسمياً،
- قد تكون قديمة أو غير مطابقة لآخر تعديل تشريعي أو قضائي،
- يجب التحقق من نصوصها الرسمية عبر الجريدة الرسمية وقواعد بيانات الأحكام المتخصصة.

## 4) عدم وجود ضمان

البرنامج مقدَّم "كما هو" دون أي ضمان من أي نوع (راجع بند الضمان في [LICENSE](LICENSE)). لا يضمن المطوّر العمل دون انقطاع، أو خلو البرمجيات من الأخطاء، أو ملاءمتها لغرض معين.

## 5) الطرف الثالث

التطبيق قد يستخدم خدمات خارجية اختيارية (مثل مزامنة Firebase Firestore، أو فحص التحديثات عبر GitHub). هذه الخدمات تخضع لسياسات أصحابها، والمطوّر غير مسؤول عن توافرها أو سياساتها. **جميع الوظائف الأساسية تعمل دون هذه الخدمات.**

---

## 🔐 سياسة الخصوصية — Privacy Policy

### ما نجمعه: **لا شيء.**

النسخة الأصلية للتطبيق **دون خوادم ودون حسابات**:

- **كل بيانات القضايا تُخزَّن محلياً على جهازك فقط**، داخل قاعدة بيانات **مشفّرة بـ SQLCipher**.
- مفتاح التشفير (256-bit عشوائي) **يُولَّد على جهازك** ويُحفظ ملفوفاً بمفتاح **Android Keystore** (AES-GCM) — لا يمكن استخراجه من الجهاز، ولا نملك نسخة منه. **إن نسيت قفل الجهاز أو حُذف ملف المفتاح، لا يمكن لأحد — لا نحن ولا أي جهة — فك تشفير البيانات.**
- **لا إعلانات، لا تتبع، لا تحليلات، لا وصول لجهات اتصالك أو ملفاتك** خارج نطاق عمل التطبيق.
- **التطبيق مستثنى من النسخ الاحتياطي السحابي** لقاعدة البيانات (Android Backup) — حتى لا تنتقل بيانات مشفّرة إلى أجهزة أخرى بلا مفاتيحها.

### المزامنة السحابية: اختيارية

- عند تفعيل المزامنة (اختياري تماماً)، تُرسَل الإجراءات المسجلة إلى مشروع **Firebase Firestore** تملكه أنت/مكتبك، عبر اتصال TLS مقيّد بنطاقات Google فقط.
- يمكنك تعطيل المزامنة نهائياً من الإعدادات؛ يعمل التطبيق بكامل وظائفه دون اتصال.
- قاعدة البيانات ومفتاحها **لا يُرسلان أبداً** — فقط محتوى الإجراءات التي أنشأتها.

### فاحص التحديثات

يتصل التطبيق بـ **GitHub Releases API** (قراءة فقط، بلا أي معرفات أو بيانات مستخدم) للتحقق من وجود إصدار أحدث. هذا الاتصال لا يرسل شيئاً عنك سوى عنوان الطلب نفسه.

### حقوقك

- بياناتك ملكك: تصديرها واستيرادها يتم من داخل التطبيق.
- إلغاء التثبيت يحذف قاعدة البيانات المشفّرة نهائياً من الجهاز.

**للاستفسارات المتعلقة بالخصوصية:** راسلنا عبر قنوات التواصل في [README.md](README.md).

---

## 📜 ملخص تنفيذي (للمطوّرين)

هذا الملف **جزء لا يتجزأ من توزيع التطبيق**: يجب أن يظهر داخل التطبيق في شاشة "حول" عند أول تشغيل وعند كل تحديث كبير، وأن يُرفق مع أي نسخة APK موزّعة خارج متجر Google Play.

</div>

---

<div dir="ltr">

# Legal Disclaimer & Privacy Policy (English)

## 1) Nature of the Tool — Organizational Aid, Not Legal Advice

**CRIM-SYS 2026** (aka LAW-SYS 2026) is an **information-management aid** for
legal practices. It:

- provides **no legal advice** and creates no attorney–client relationship,
- does **not replace** the judgment or manual review of the responsible attorney,
- produces outputs — **including deadline calculations, appeal windows, hearing
  dates, and case classifications** — that are **estimates for reference only**.

**Golden rule:** verify everything the app shows against official sources and the
responsible attorney before taking any procedural action.

## 2) No Liability for Missed Deadlines or Cases

To the maximum extent permitted by law, **the developer disclaims all liability**
for any direct or indirect damage, including without limitation:

- **loss of a case, right, or procedural deadline** resulting from reliance on the
  app's automatic date/deadline computations,
- errors or downtime in the calendar, timeline, or sync features,
- **network outages** or failed/delayed cloud synchronization,
- data loss from device failure, app uninstall, factory reset, or failed backups,
- any use contrary to the usage guidance or this disclaimer.

By using the app you acknowledge **full personal responsibility** for tracking
your own case deadlines through official channels.

## 3) Accuracy of Legal Content

Egyptian statutes and procedures (CPC 150/1950, Law 174/2025, etc.) are subject
to amendment and interpretation. Any legal texts, references, or rulings shown
in-app are **for organizational reference only**, may be outdated, and must be
verified against the Official Gazette and specialized case-law databases.

## 4) No Warranty

The software is provided "AS IS" without warranty of any kind (see the warranty
clause in [LICENSE](LICENSE)).

## 5) Third-Party Services

Optional external services (Firebase Firestore sync, GitHub update checks) are
governed by their owners' policies; the developer is not responsible for their
availability. **All core functionality works without them.**

## 🔐 Privacy Policy (English)

- **We collect nothing.** The app is server-less and account-less.
- All case data lives **only on your device**, in a **SQLCipher-encrypted**
  database. The random 256-bit key is generated on-device and wrapped by
  **Android Keystore** (AES-GCM). Nobody — including us — can decrypt your data
  without the device.
- No ads, no tracking, no analytics, no contact/file access beyond the app's purpose.
- The database and its key are **excluded from Android cloud backups**.
- **Sync is optional**: when enabled, action payloads go to *your* Firestore
  project over TLS restricted to Google domains; the database and key are never
  uploaded. Disable it entirely in Settings.
- The update checker talks to the **GitHub Releases API** (read-only, sends no
  user data).
- Uninstalling permanently deletes the encrypted database.

</div>

---

<div align="center">

**باختصار: الأداة تنظّم عملك — والمحامي المسؤول يوقّع على كل إجراء.**
**In short: the tool organizes your work — the responsible attorney signs off on every action.**

</div>
