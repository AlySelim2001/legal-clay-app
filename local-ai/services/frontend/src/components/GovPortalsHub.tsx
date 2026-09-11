import { announce } from "@/a11y/AccessibilityProvider";

/**
 * Digital Government Gateway Tracker.
 * Portal URLs mirror the legal-matrix entries (marked portal_unverified
 * there). Shown as external references only — the app never claims these
 * gateways are affiliated with or endorse this tool, and no document
 * submission happens through this UI.
 */
const PORTALS: {
  name: string;
  url: string;
  desc: string;
  icon: string;
}[] = [
  {
    name: "النيابة العامة",
    url: "https://ppo.gov.eg",
    desc: "استعلام عن القضايا والبلاغات — وخدمات النيابة الرقمية",
    icon: "🏛️",
  },
  {
    name: "وزارة العدل المصرية",
    url: "https://www.mjustice.gov.eg",
    desc: "جدول الجلسات والخدمات القضائية والشهر العقاري",
    icon: "⚖️",
  },
  {
    name: "مصر الرقمية",
    url: "https://digital.gov.eg",
    desc: "استخراج المستندات الرسمية لإثبات الشخصية والسجل المدني",
    icon: "🇪🇬",
  },
];

export function GovPortalsHub() {
  return (
    <section aria-labelledby="portals-heading" className="mx-auto max-w-5xl p-4">
      <h2 id="portals-heading" className="mb-2 text-2xl font-bold">
        🏛️ البوابات الحكومية الرقمية
      </h2>
      <p className="mb-6 text-lg">
        روابط رسمية للخدمات الحكومية — تُفتح في نافذة جديدة.
      </p>

      <div className="grid gap-4 sm:grid-cols-3">
        {PORTALS.map((p) => (
          <a
            key={p.url}
            href={p.url}
            target="_blank"
            rel="noopener noreferrer"
            className="touch-target flex flex-col gap-2 rounded-3xl border-4 border-[var(--color-ink)] p-6 font-bold hover:bg-[var(--color-brand)] hover:text-[var(--color-canvas)]"
            onClick={() => announce(`جاري فتح بوابة ${p.name}`)}
          >
            <span aria-hidden="true" className="text-4xl">{p.icon}</span>
            <span className="text-lg">{p.name}</span>
            <span className="text-sm font-normal opacity-90">{p.desc}</span>
            <span
              aria-hidden="true"
              className="text-sm underline underline-offset-4"
            >
              فتح البوابة ↗
            </span>
          </a>
        ))}
      </div>

      <div
        role="note"
        className="mt-6 rounded-2xl border-4 border-[var(--color-ink)] p-4 leading-8"
      >
        <p className="font-bold">تنبيه مهم:</p>
        <ul className="list-disc space-y-1 ps-6 text-base">
          <li>
            الروابط أعلاه مُدارة من جهات حكومية مستقلة عن هذا التطبيق — تأكد من
            العنوان قبل إدخال أي بيانات شخصية.
          </li>
          <li>
            هذا التطبيق أداة تنظيمية مساعدة فقط ولا يقدّم أي خدمة رسمية نيابة
            عن الجهات الحكومية.
          </li>
          <li>
            الإيداعات الإجرائية الرسمية (الطعون، البلاغات) تتم حصراً عبر قنوات
            الجهة المختصة أو بمحامٍ مفوض.
          </li>
        </ul>
      </div>
    </section>
  );
}
