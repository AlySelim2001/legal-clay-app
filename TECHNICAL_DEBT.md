# TECHNICAL_DEBT.md — سجل الديون التقنية

> **التاريخ:** 2026-09-19 · **النطاق:** دفعة تنظيف lint (46 أخطاء → 0)
> **الحالة بعد الدفعة (متحقق بالأوامر):** `bun tsc -b --noEmit` → exit 0 · `bun run lint` → exit 0، **0 أخطاء / 25 تحذيرًا**
> **قاعدة الدفعة:** لا تُعالج التحذيرات داخل هذه الدفعة إلا إذا كان الإصلاح آمنًا ومحدودًا —
> إصلاح واحد مستقل استُثني (unused-disable في `text.ts`، حذف سطر تعليق ميت)؛ الباقي مسجّل أدناه.

---

## 1. ملخص

| الفئة | العدد | الأولوية | طبيعة الدين |
|---|---|---|---|
| react-refresh/only-export-components | 21 | P3 (منخفضة) | نقيلة أنماط قائمة — استشارية بحكم التصميم |
| Unused eslint-disable directive (ملفات مولَّدة ×4) | 4 | P4 (تجاهل موثق) | دين مولَّد-بذاته، يعود مع كل codegen |
| **المجموع** | **25** | | |

**لماذا P3/P4؟** كلها تحذيرات (لا أخطاء)، بوابة lint صارت صلبة وهي تمر exit 0،
والإصلاح الجماعي (نقل الثوابت لملفات منفصلة / تغيير eslint.config) يلامس 13+ ملفًا
منها ملفات shadcn الأصلية وملف المنصة للقراءة فقط — مكسب وظيفي صفر مقابل مخاطرة انحدار.

---

## 2. الفئة الأولى: react-refresh/only-export-components (21 تحذيرًا — P3)

**السبب الجذري الموحد:** القاعدة تمنع تصدير قيم غير-مكوّنات من ملفات المكوّنات (تكسر Fast Refresh).
الأنماط القائمة في المشروع: تصدير `*Variants` بجانب المكوّن (شادcn الرسمي)، وتصدير hooks/constants
بجانب الـProvider (نمط Context الموثق رسميًا).

| # | الملف | السطر | الرموز المصدر للتحذير | النمط | generated؟ | خطة الإزالة | الأولوية |
|---|---|---|---|---|---|---|---|
| 1 | `src/components/ui/badge.tsx` | 46 | `badgeVariants` | تصدير variants بجانب المكوّن (shadcn الرسمي) | نعم (shadcn) | إما استثناء ضيق بالقاعدة لملفات `ui/*` أو قبول الدين (النمط الرسمي للمكتبة) | P3 |
| 2 | `src/components/ui/button.tsx` | 62 | `buttonVariants` | نفسه | نعم (shadcn) | نفسه | P3 |
| 3 | `src/components/ui/toggle.tsx` | 45 | `toggleVariants` | نفسه | نعم (shadcn) | نفسه | P3 |
| 4 | `src/components/ui/form.tsx` | 158 | `useFormField` + سياق | hook بجانب المكوّنات (shadcn الرسمي) | نعم (shadcn) | نفسه | P3 |
| 5 | `src/components/ui/navigation-menu.tsx` | 158 | `useNavigationMenuContext` | نفسه | نعم (shadcn) | نفسه | P3 |
| 6 | `src/components/ui/sidebar.tsx` | 701 | `useSidebar` | نفسه | نعم (shadcn) | نفسه | P3 |
| 7 | `src/components/ui/button-group.tsx` | 78 | دوال مساعدة + مكوّنات | shadcn صيغة حديثة | نعم (shadcn) | نفسه | P3 |
| 8 | `src/contexts/ConvexProvider.tsx` | 14 | `CONVEX_URL` (ثابت بيئة) | ثابت بجانب Provider | لا | نقل `CONVEX_URL` إلى `src/lib/env.ts` جديد (نمط المشروع) — آمن ومحدود | P2 |
| 9 | `src/contexts/ConvexProvider.tsx` | 28 | `useConvexAvailable` | hook بجانب Provider | لا | يُبقى (نمط Context موثق؛ فصل الملف نسخ-لصق لكل مستدعي) | P3 |
| 10 | `local-ai/.../a11y/AccessibilityProvider.tsx` | 63,134,140,156 | `AccessibilityProvider` + `useA11y` + `announce` + `speak` | Provider+API في ملف واحد (4 تحذيرات بسطر واحد معلن) | لا | يُبقى: API الصوت/الوصولية جوهري مقرون بالسياق؛ الفصل يضخّم السطح بلا مكسب | P3 |
| 11 | `local-ai/services/frontend/src/main.tsx` | — | (تصدير غير-مكوّن من ملف الدخول) | ملف دخول | لا | يُبقى: ملف دخول لا يشارك في Fast Refresh عمليًا | P4 |
| 12 | `vly-toolbar-readonly.tsx` | 4 مواقع | `FiberNode`, `ComponentInfo`, دوال أداة | **ملف المنصة للقراءة فقط** | نعم (منصة) | ممنوع تعديله؛ يُستثنى في eslint.config إذا أزعج | P4 |

**خطة إزالة مجمعة (عند إقرارها):**
1. **P2 وحيد:** نقل `CONVEX_URL` إلى `src/lib/env.ts` — commit مستقل، `tsc`+`lint` بعده.
2. **P3 جماعي (6 ملفات shadcn):** إضافة استثناء ضيق في `eslint.config.js`:
   `files: ["src/components/ui/**"], rules: { "react-refresh/only-export-components": "off" }`
   مع تعليق يوثق أن النمط هو توصية shadcn الرسمية. يلغي 7 تحذيرات دفعة واحدة.
3. **الباقي (AccessProvider/ConvexProvider/toolbar):** قبول موثق — الأنماط صحيحة معماريًا.

---

## 3. الفئة الثانية: Unused eslint-disable directive في الملفات المولَّدة (4 — P4)

| # | الملف | السطر | القاعدة المكتومة | السبب | generated؟ | خطة الإزالة | الأولوية |
|---|---|---|---|---|---|---|---|
| 1 | `src/convex/_generated/api.js` | 1:1 | الكل (`/* eslint-disable */` لم يعد يكتم شيئًا) | الملف نظيف lint-أصلاً؛ الترويسة من مولّد Convex | نعم (Convex codegen) | تعديل مولّد Convex خارج النطاق؛ الإزالة اليدوية عديمة الجدوى (يعود مع كل codegen) | P4 |
| 2 | `src/convex/_generated/dataModel.d.ts` | 1:1 | نفسه | نفسه | نعم | نفسه | P4 |
| 3 | `src/convex/_generated/server.d.ts` | 1:1 | نفسه | نفسه | نعم | نفسه | P4 |
| 4 | `src/convex/_generated/server.js` | 1:1 | نفسه | نفسه | نعم | نفسه | P4 |

**بديل ذكي بدل الدين الدائم (عند إقراره):** في `eslint.config.js` أضف:
`{ ignores: ["src/convex/_generated/**"] }` — يلغي التحذيرات الأربعة نهائيًا ويمنع
أي فحص مستقبلي لكود مولَّد. **غير منفذ في هذه الدفعة** (تعديل إعداد CI-عابر للأسطح،
يُقتصر ضمن بند 11). **ملاحظة تشغيلية:** لو رُفض، تُضبط `--report-unused-disable-directives`
على "off" للـ`_generated` فقط أو يُقبل الدين.

---

## 4. الديون المرتبطة المكتشفة أثناء الدفعة (خارج نطاق lint — مرجع)

| البند | الموقع | الوصف | الأولوية |
|---|---|---|---|
| eslint.config بلا argsIgnorePattern | `eslint.config.js` | غياب `argsIgnorePattern: "^_"` اكتشافات no-unused-vars للبارامترات المهملة؛ عولج هذه المرة بالحذف الصحيح | P3 |
| بذور React Compiler | eslint.config.js | قواعد react-hooks تعمل بمترجم React Compiler (رسائل "Compilation Skipped") — قد تظهر أنماط جديدة عند كل ترقية | P3 |

---

## 5. سجل التغييرات داخل هذا الملف

| التاريخ | التغيير | الدليل |
|---|---|---|
| 2026-09-19 | إنشاء السجل بعد دفعة lint (46→0)؛ إصلاح unused-disable الوحيد الآمن (text.ts)؛ التحذيرات 26→25 | `/tmp` سجل lint (جلسة تنفيذ) + `bun run lint` exit 0 |
