import { Scale, AlertTriangle, FileText, Search } from "lucide-react";
import { useState } from "react";

const laws = [
  {
    id: "1",
    name: "قانون الإجراءات الجنائية",
    number: "ل.ج. 150 لسنة 1950",
    description:
      "القانون الأساسي الذي ينظم إجراءات التحقيق والمحاكمة الجنائية في مصر، بما في ذلك قواعد الإثبات وحقوق الدفاع والسلطات القضائية.",
    articles: [
      "المادة 1 — تعريف الجريمة",
      "المادة 137 — بطلان الإجراءات",
      "المادة 216 — اختصاص المحكمة",
      "المادة 230 — الصلاحية",
    ],
    status: "مفعّل",
  },
  {
    id: "2",
    name: "قانون العقوبات",
    number: "ل.ع. 58 لسنة 1937",
    description:
      "ينظم الأحكام العامة للعقوبات والجرائم والعقوبات المترتبة عليها، ويشمل الأحوال المعفية والمبررة والمخففة.",
    articles: [
      "المادة 34 — عبء الإثبات",
      "المادة 41 — الإفصاح الطوعي",
      "المادة 49 — الضرورة القصوى",
      "المادة 51 — الإكراه",
      "المادة 15 — التقادم",
    ],
    status: "مفعّل",
  },
  {
    id: "3",
    name: "قانون مكافحة غسل الأموال",
    number: "ل.غ.أ. 80 لسنة 2018",
    description:
      "يحدد الجرائم المتعلقة بغسل الأموال وتمويل الإرهاب، وión الإجراءات الخاصة بالتحري والتحقيق في هذه الجرائم.",
    articles: [
      "المادة 2 — تعريف غسل الأموال",
      "المادة 5 — العقوبات",
      "المادة 10 — التحفظ على الأموال",
    ],
    status: "مفعّل",
  },
  {
    id: "4",
    name: "قانون مكافحة المخدرات",
    number: "ل.م. 182 لسنة 1960",
    description:
      "ينظم جرائم اتجار المخدرات والمؤثرات العقلية، وiones العقوبات الخاصة بها، وإجراءات التحقيق والمحاكمة.",
    articles: [
      "المادة 2 — تعريف المخدرات",
      "المادة 6 — العقوبات على الاتجار",
      "المادة 8 — العقوبات على الحيازة",
    ],
    status: "مفعّل",
  },
];

const updates = [
  {
    id: "1",
    date: "2025-11-15",
    title: "قانون 174 لسنة 2025 — تعديلات على قانون الإجراءات الجنائية",
    description:
      "صدر القانون 174 لسنة 2025 المعدّل لبعض أحكام قانون الإجراءات الجنائية، ويشمل تعديلات جوهرية على إجراءات التحقيق والمحاكمة.",
    changes: [
      "تعزيز حق المحامي في الحضور أثناء التحقيقات",
      "تحديد مدد التحقيقات الإلزامية",
      "تحسين إجراءاتɝature الصادرة عن المحاكم",
      "تنظيم استخدام التقنيات الحديثة في المحاكمات",
    ],
    impact: "مرتفع",
  },
  {
    id: "2",
    date: "2025-06-01",
    title: " Decision constitutional على المادة 137",
    description:
      "قرار المحكمة الدستورية العليا بشأن تفسير المادة 137 من قانون الإجراءات الجنائية liên.borderColor بطلان الإجراءات.",
    changes: [
      "توسيع نطاق البطلان للإجراءات الجذرية فقط",
      "تأكيد مبدأ النسبة في تطبيق البطلان",
    ],
    impact: "مرتفع",
  },
];

export default function LegalFramework() {
  const [search, setSearch] = useState("");

  const filteredLaws = laws.filter(
    (l) =>
      !search ||
      l.name.includes(search) ||
      l.description.includes(search) ||
      l.number.includes(search)
  );

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">الإطار القانوني</h1>
        <p className="text-sm text-muted-foreground mt-1">
          المراجع القانونية والإجراءاتية والتحديثات التشريعية
        </p>
      </div>

      {/* Law 174/2025 Notice — CRITICAL */}
      <div className="clay-card border-2 border-urgency-critical/20 p-6 animate-pulse-glow">
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-2xl bg-urgency-critical/10 shrink-0">
            <AlertTriangle className="w-6 h-6 text-urgency-critical" />
          </div>
          <div>
            <h2 className="text-base font-bold text-urgency-critical mb-1">
              ⚠ تنبيه هام — القانون 174 لسنة 2025
            </h2>
            <p className="text-sm text-foreground/80 leading-relaxed">
              صدر القانون 174 لسنة 2025 المعدّل لبعض أحكام قانون الإجراءات الجنائية. يرجى مراجعة
              التعديلات التي تؤثر بشكل مباشر على إجراءات التحقيق والمحاكمة، بما في ذلك تعزيز حق
              المحامي في الحضور وتحديد مدد التحقيقات.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="clay-badge text-xs font-semibold bg-urgency-critical/10 text-urgency-critical px-3 py-1.5">
                🔴 تأثير مرتفع
              </span>
              <span className="clay-badge text-xs font-semibold bg-card text-foreground px-3 py-1.5 border border-border">
                📅 15 نوفمبر 2025
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="clay-card p-4">
        <div className="relative">
          <Search className="absolute end-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="بحث في القوانين والمراجع..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="clay-input w-full pe-10 ps-4 py-2.5 text-sm bg-background"
          />
        </div>
      </div>

      {/* Laws Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {filteredLaws.map((law) => (
          <div key={law.id} className="clay-card p-5">
            <div className="flex items-start gap-3 mb-3">
              <div className="p-2.5 rounded-2xl bg-clay-blue/10 shrink-0">
                <Scale className="w-5 h-5 text-clay-blue" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-bold text-foreground">{law.name}</h3>
                <p className="text-xs text-muted-foreground font-mono mt-0.5">
                  {law.number}
                </p>
              </div>
              <span className="clay-badge text-[10px] font-bold bg-urgency-normal/10 text-urgency-normal px-2 py-0.5">
                {law.status}
              </span>
            </div>
            <p className="text-xs text-foreground/70 leading-relaxed mb-3">
              {law.description}
            </p>
            <div className="clay-inset p-3 rounded-xl">
              <p className="text-[10px] text-muted-foreground uppercase font-semibold mb-2">
                مواد مرجعية
              </p>
              <div className="flex flex-wrap gap-1.5">
                {law.articles.map((article, i) => (
                  <span
                    key={i}
                    className="text-[10px] font-medium bg-card text-foreground px-2 py-1 rounded-lg border border-border/50"
                  >
                    {article}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Updates */}
      <div>
        <h2 className="text-lg font-bold text-foreground mb-4">التحديثات التشريعية الأخيرة</h2>
        <div className="space-y-4">
          {updates.map((update) => (
            <div key={update.id} className="clay-card p-5">
              <div className="flex items-start gap-3 mb-3">
                <div className="p-2.5 rounded-2xl bg-clay-purple/10 shrink-0">
                  <FileText className="w-5 h-5 text-clay-purple" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-sm font-bold text-foreground">{update.title}</h3>
                    <span className="clay-badge text-[10px] font-bold bg-urgency-critical/10 text-urgency-critical px-2 py-0.5">
                      {update.impact}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mb-2">{update.date}</p>
                  <p className="text-xs text-foreground/70 leading-relaxed">
                    {update.description}
                  </p>
                </div>
              </div>
              <div className="me-8">
                <p className="text-xs font-semibold text-muted-foreground mb-2">
                  أبرز التعديلات:
                </p>
                <ul className="space-y-1.5">
                  {update.changes.map((change, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-2 text-xs text-foreground/70"
                    >
                      <span className="text-clay-blue mt-0.5">•</span>
                      {change}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
