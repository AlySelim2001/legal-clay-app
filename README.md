<p dir="rtl" align="center">

# ⚖️ CRIM-SYS 2026 — منظومة إدارة القضايا الجنائية

### LAW-SYS 2026 Master Edition

</p>

<p align="center">
  <a href="https://github.com/AlySelim2001/legal-clay-app/actions/workflows/android-build.yml">
    <img src="https://github.com/AlySelim2001/legal-clay-app/actions/workflows/android-build.yml/badge.svg" alt="CI/CD Build Status">
  </a>
  <a href="https://github.com/AlySelim2001/legal-clay-app">
    <img src="https://img.shields.io/badge/Version-2026.9-blue" alt="Version">
  </a>
  <a href="https://github.com/AlySelim2001/legal-clay-app">
    <img src="https://img.shields.io/badge/Platform-Android%20%7C%20Web-brightgreen" alt="Platform">
  </a>
  <a href="https://wa.me/201119886662">
    <img src="https://img.shields.io/badge/WhatsApp-01119886662-25D366?style=flat&logo=whatsapp" alt="WhatsApp Support">
  </a>
</p>

---

<p dir="rtl">

## نظرة عامة

منظومة شاملة لإدارة القضايا الجنائية والمدنية والتجارية وأحوال شخصية والقضاء الإداري والعمل — مصممة خصيصاً للممارسات القانونية المصرية. تتضمن نظام ذكاء اصطناعي متعدد التخصصات، حاسبة المواعيد النهائية، مسح المستندات بال	optical character recognition، وتصدير أندرويد أصلي.

</p>

---

## ✨ الميزات الرئيسية

### 🤖 وكيل الذكاء الاصطناعي المتعدد

| الوكيل | التخصص | القوانين المرجعية |
|--------|--------|-------------------|
| **مستشار الإجراءات والجنايات** | جنائي | قانون الإجراءات الجنائية 150/1950، القانون 174/2025 |
| **مستشار المدني والتجاري** | مدني وتجاري | القانون المدني 131/1948، قانون الإجراءات المدنية 13/1968 |
| **مستشار الأحوال الشخصية** | أسرة | القانون 25/1920، القانون 1/2000 |
| **مستشار القضاء الإداري** | إداري | قانون مجلس الدولة 47/1972 |
| **مستشار العمل والتأمينات** | عمل | قانون العمل 12/2003، التأمينات 148/2019 |
| **وكيل كولومبو التفتيشي** | تدقيق جنائي | المواد 40، 41، 44، 137 إجراءات جنائية |

### 📊 إدارة القضايا

- **سجل القضايا** — بحث وفرز وتصنيف ذكي
- **ملف القضية التفصيلي** — تبويبات: مراجعة، مراحل إجرائية، مرفقات، جدول زمني، كولومبو التفتيشي
- **olverالعملاء** — ملفات شخصية مع شبكة العلاقات والتداخل
- **حاسبة المواعيد** — جنائي، مدني، إداري، أحوال شخصية، عمل
- **كتالوج الدفوع الجنائية** — 6 دفوع مع أحكام محكمة النقض
- **محرك الأحكام القضائية** — بحث في أحكام محكمة النقض والمحكمة الإدارية العليا

### 🔧 الأدوات التقنية

- **مسح المستندات (OCR)** — Tesseract.js للتعرف على النصوص العربية
- **تصدير PDF** — جلسات، أحكام، مذكرات دفاع بالخط العربي (Amiri)
- **استيراد/تصدير Excel** — SheetJS للتوافق مع الأعمال الورقية
- **FullCalendar** — جدول جلسات المحاكم بدعم عربي RTL
- **وضع عدم الاتصال** — IndexedDB + TanStack Query للعمل داخل قاعات المحاكم
- **نسخ احتياطي واستعادة** — تصدير واستيراد شامل للبيانات

### 📱 أندرويد أصلي

- **CapacitorJS** — تطبيق أصلي مع إشعارات دفع وتخزين محلي
- **CI/CD** — GitHub Actions لبناء APK تلقائي عند كل دفع

---

## 🛠️ التقنيات المستخدمة

| الطبقة | التقنيات |
|--------|----------|
| **Frontend** | React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui |
| **State Management** | TanStack Query (cache + offline persistence), Zustand (UI state) |
| **Backend** | Supabase (PostgreSQL + Auth + RLS + Storage) |
| **AI/OCR** | Tesseract.js (client-side), multi-agent legal swarm architecture |
| **PDF** | jsPDF + pdfmake (Amiri Arabic font) |
| **Calendar** | FullCalendar (Arabic RTL, daygrid + timegrid) |
| **Export** | SheetJS/xlsx (Excel import/export) |
| **Mobile** | CapacitorJS (Android native), PWA manifest |
| **CI/CD** | GitHub Actions (quality check + APK build) |

---

## 🚀 البدء السريع

```bash
# استنساخ المستودع
git clone https://github.com/AlySelim2001/legal-clay-app.git
cd legal-clay-app

# تثبيت التبعيات
bun install

# تشغيل خادم التطوير
bun run dev

# بناء APK أندرويد
bun run cap:sync
bun run cap:open
```

> 📖 راجع [BUILD_GUIDE.md](BUILD_GUIDE.md) للتعليمات التفصيلية.

---

## 📱 بناء APK أندرويد

### عبر GitHub Actions (تلقائي)

1. افتح [GitHub Actions](https://github.com/AlySelim2001/legal-clay-app/actions)
2. اختر أحدث بناء ناجح
3. حمّل `LAW-SYS-2026-Debug-APK`

### عبر الخطوط الأوامر (محلي)

```bash
bun run build
bunx cap sync android
cd android && ./gradlew assembleDebug
# المسار: android/app/build/outputs/apk/debug/app-debug.apk
```

---

## 🔒 الأمان والخصوصية

- **RLS** — سياسات Row Level Security على جميع جداول PostgreSQL
- **مصادقة** — Supabase Auth (بريد إلكتروني + كلمة مرور)
- **أدوار** — `admin` (محامي رئيسي) و `assistant` (فريق قانوني)
- **تخزين خاص** — ملفات محفوظة بعنوان URL مؤقت (3600 ثانية)
- **عمل غير متصل** — IndexedDB محلي لبيانات قاعات المحاكم
- **سجل المراجعة** — تتبع شامل لكل تعديل على البيانات

---

## ⚠️ إخلاء المسؤولية القانوني

> **⚠️ نتيجة تقديرية — يجب التحقق منها مع المحامي المختص قبل اتخاذ أي إجراء.**

هذا النظام هو أداة مساعدة لإدارة المعلومات وتنظيم البيانات القانونية. لا يُغني بأي شكل من الأشكال عن الاستشارة القانونية المتخصصة. جميع حسابات المواعيد النهائية والنتائج والتصنيفات تقديرية ويجب مراجعتها والتحقق من صحتها مع المحامي المختص قبل اتخاذ أي إجراء قانوني.

---

## 📞 التواصل والدعم الفني

<div dir="rtl">

| القناة | التفاصيل |
|--------|----------|
| 📱 **واتساب** | [01119886662](https://wa.me/201119886662?text=%D8%A7%D9%84%D8%B3%D9%84%D8%A7%D9%85%20%D8%B9%D9%84%D9%8A%D9%83%D9%85%D8%8C%20%D8%A3%D9%88%D8%AF%20%D8%A7%D9%84%D8%A7%D8%B3%D8%AA%D9%81%D8%B3%D8%A7%D8%B1%20%D8%A8%D8%B4%D8%A3%D9%86%20%D9%86%D8%B8%D8%A7%D9%85%20%D8%A5%D8%AF%D8%A7%D8%B1%D8%A9%20%D8%A7%D9%84%D9%82%D8%B6%D9%8A%D8%A7%20%D9%88%D8%A7%D9%84%D9%85%D9%86%D8%B8%D9%88%D9%85%D8%A9%20%D8%A7%D9%84%D9%82%D8%A7%D9%86%D9%88%D9%86%D9%8A%D8%A9%20CRIM-SYS%202026.) |
| 🔗 **GitHub** | [AlySelim2001/legal-clay-app](https://github.com/AlySelim2001/legal-clay-app) |
| 🐛 **الأخطاء** | [Issues](https://github.com/AlySelim2001/legal-clay-app/issues) |

</div>

---

## 📄 الترخيص

هذا المشروع خاص. جميع الحقوق محفوظة.

---

<p align="center">

**✨ صُنع بشغف للمجتمع القانوني المصري ✨**

</p>
