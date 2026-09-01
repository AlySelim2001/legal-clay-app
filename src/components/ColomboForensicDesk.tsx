// ============================================================
// Colombo Forensic Desk — Case Detail Tab Component
// مكتب كولومبو التفتيشي — تبويب تفاصيل القضية
// Interactive crime scene timeline & discrepancy matrix
// ============================================================

import { useState } from "react";
import {
  Eye,
  Clock,
  AlertTriangle,
  Download,
  ChevronRight,
  FileText,
  Scale,
} from "lucide-react";
import { LegalDisclaimer } from "@/components/LegalDisclaimer";
import type { CaseWithClient } from "@/types/database";

interface ColomboForensicDeskProps {
  caseData: CaseWithClient & {
    defense?: { name: string } | null;
    procedural_stage?: { prescription_date?: string | null } | null;
  };
}

interface TimelineEvent {
  id: string;
  date: string;
  time: string;
  event: string;
  source: "official" | "defense" | "forensic";
  officer?: string;
  hasDiscrepancy?: boolean;
  discrepancyNote?: string;
}

interface DiscrepancyRow {
  category: string;
  officialVersion: string;
  defenseVersion: string;
  forensicEvidence: string;
  clashLevel: "critical" | "high" | "medium";
  articleRef: string;
}

// ---- Mock data for demonstration ----
const MOCK_TIMELINE: TimelineEvent[] = [
  {
    id: "t1",
    date: "2026-01-15",
    time: "14:30",
    event: "وقوع الحادث المنسوب",
    source: "official",
    hasDiscrepancy: false,
  },
  {
    id: "t2",
    date: "2026-01-15",
    time: "22:00",
    event: "تحرير محضر الضبط (محضر رقم 1234)",
    source: "official",
    officer: "مقدم الشرطة أحمد محمود",
    hasDiscrepancy: true,
    discrepancyNote:
      "تأخير 7.5 ساعة من وقوع الحادث دون تبرير — يثير الشكوك حول صحة الإبلاغ",
  },
  {
    id: "t3",
    date: "2026-01-16",
    time: "10:15",
    event: "عرض المتهم أمام النيابة العامة",
    source: "official",
    officer: "النيابة العامة —ested القسم",
    hasDiscrepancy: true,
    discrepancyNote:
      "تجاوز 24 ساعة من تحرير المحضر — مخالفة المادة 36 إجراءات جنائية",
  },
  {
    id: "t4",
    date: "2026-01-16",
    time: "11:00",
    event: "أقوال الشاهد الأول — نفي الحضور في موقع الحادث",
    source: "defense",
  },
  {
    id: "t5",
    date: "2026-01-17",
    time: "09:00",
    event: "تقرير الطب الشرعي — تحديد وقت الإصابة بفارق 4 ساعات",
    source: "forensic",
    hasDiscrepancy: true,
    discrepancyNote:
      "矛盾 مع أقوال الشاهد الرسمي — فارق 4 ساعات في تحديد وقت الإصابة",
  },
  {
    id: "t6",
    date: "2026-01-20",
    time: "14:00",
    event: "نتيجة التحليل الكيميائي — عدم اكتشاف مواد مشبوهة",
    source: "forensic",
  },
];

const MOCK_DISCREPANCIES: DiscrepancyRow[] = [
  {
    category: "توقيت الإصابة",
    officialVersion: "الساعة 14:30 يوم 15/1/2026",
    defenseVersion: "الساعة 10:30 يوم 15/2026 — وفق شهادة شاهد الإثبات",
    forensicEvidence: "الساعة 18:30 تقريباً — وفق تقرير الطب الشرعي",
    clashLevel: "critical",
    articleRef: "المادة 36 إجراءات جنائية",
  },
  {
    category: "مكان الحادث",
    officialVersion: "شارع [___] — أمام المتجر رقم [___]",
    defenseVersion: "شارع [___] — على بعد 200 متر",
    forensicEvidence: "لم يتمكن التحقيق من تحديد الموقع بدقة",
    clashLevel: "high",
    articleRef: "المادة 137 إجراءات جنائية",
  },
  {
    category: "السلاح المستخدم",
    officialVersion: "آلة حادة — سكين مطبخ",
    defenseVersion: "لم يكن بحوزته أي أداة",
    forensicEvidence: "لم يتم العثور على أثر حمض أو دم على أي أداة",
    clashLevel: "critical",
    articleRef: "المادة 40 إجراءات جنائية",
  },
];

// ---- Sub-components ----

function SourceBadge({ source }: { source: string }) {
  const config = {
    official: { label: "رسمي", color: "bg-blue-100 text-blue-700" },
    defense: { label: "دفاع", color: "bg-green-100 text-green-700" },
    forensic: { label: "فني", color: "bg-purple-100 text-purple-700" },
  };
  const c = config[source as keyof typeof config] ?? config.official;
  return (
    <span className={`clay-badge text-[9px] font-bold px-1.5 py-0.5 ${c.color}`}>
      {c.label}
    </span>
  );
}

function ClashBadge({ level }: { level: string }) {
  const colors = {
    critical: "bg-red-100 text-red-700 border-red-200",
    high: "bg-amber-100 text-amber-700 border-amber-200",
    medium: "bg-blue-100 text-blue-700 border-blue-200",
  };
  const labels: Record<string, string> = {
    critical: "تناقض حرج",
    high: "تناقض مرتفع",
    medium: "ملاحظة",
  };
  return (
    <span
      className={`clay-badge text-[9px] font-bold px-1.5 py-0.5 border ${colors[level as keyof typeof colors]}`}
    >
      {labels[level] ?? level}
    </span>
  );
}

// ---- Main Component ----

export function ColomboForensicDesk({ caseData }: ColomboForensicDeskProps) {
  const [activeView, setActiveView] = useState<"timeline" | "matrix">(
    "timeline"
  );

  return (
    <div className="space-y-4 animate-fade-in" dir="rtl">
      {/* Disclaimer */}
      <LegalDisclaimer />

      {/* Case Summary Bar */}
      <div className="clay-card p-4 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <Eye className="w-4 h-4 text-red-500" />
          <span className="text-sm font-bold text-foreground">
            مكتب كولومبو التفتيشي
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <FileText className="w-3 h-3" />
          <span>القضية: {caseData.case_no}</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Scale className="w-3 h-3" />
          <span>{caseData.court_name}</span>
        </div>
        {caseData.defense && (
          <span className="clay-badge bg-primary/10 text-primary text-[10px] font-bold px-2 py-0.5">
            {caseData.defense.name}
          </span>
        )}
      </div>

      {/* View Toggle */}
      <div className="flex gap-2">
        <button
          onClick={() => setActiveView("timeline")}
          className={`clay-button px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 ${
            activeView === "timeline"
              ? "bg-red-600 text-white"
              : "bg-card text-foreground"
          }`}
        >
          <Clock className="w-4 h-4" />
          إعادة بناء التسلسل الزمني
        </button>
        <button
          onClick={() => setActiveView("matrix")}
          className={`clay-button px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 ${
            activeView === "matrix"
              ? "bg-red-600 text-white"
              : "bg-card text-foreground"
          }`}
        >
          <AlertTriangle className="w-4 h-4" />
          جدول تناقضات التحقيق
        </button>
      </div>

      {/* Timeline View */}
      {activeView === "timeline" && (
        <div className="clay-card p-6">
          <h3 className="text-sm font-bold text-foreground mb-4">
            🕐 إعادة بناء مسرح الجريمة والتسلسل الزمني
          </h3>
          <div className="relative">
            {/* Vertical line */}
            <div className="absolute top-0 bottom-0 end-4 w-0.5 bg-border" />

            <div className="space-y-4">
              {MOCK_TIMELINE.map((event) => (
                <div key={event.id} className="flex gap-4 relative">
                  {/* Timeline dot */}
                  <div
                    className={`absolute end-2.5 w-3 h-3 rounded-full border-2 ${
                      event.hasDiscrepancy
                        ? "bg-red-500 border-red-300"
                        : event.source === "defense"
                          ? "bg-green-500 border-green-300"
                          : event.source === "forensic"
                            ? "bg-purple-500 border-purple-300"
                            : "bg-blue-500 border-blue-300"
                    }`}
                  />

                  {/* Content */}
                  <div className="me-8 flex-1">
                    <div
                      className={`clay-card-soft p-3 ${
                        event.hasDiscrepancy
                          ? "border-r-2 border-r-red-400"
                          : ""
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-mono text-muted-foreground">
                          {event.date} — {event.time}
                        </span>
                        <SourceBadge source={event.source} />
                        {event.hasDiscrepancy && (
                          <span className="clay-badge bg-red-100 text-red-700 text-[9px] font-bold px-1.5 py-0.5">
                            تناقض
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-medium text-foreground">
                        {event.event}
                      </p>
                      {event.officer && (
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          المسؤول: {event.officer}
                        </p>
                      )}
                      {event.discrepancyNote && (
                        <div className="mt-2 p-2 bg-red-50 rounded-lg border border-red-100">
                          <p className="text-[10px] text-red-600 leading-relaxed">
                            ⚠️ {event.discrepancyNote}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Discrepancy Matrix */}
      {activeView === "matrix" && (
        <div className="clay-card p-6">
          <h3 className="text-sm font-bold text-foreground mb-4">
            🔍 جدول تناقضات التحقيق — Investigation Discrepancy Matrix
          </h3>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-start p-2 text-[10px] font-bold text-muted-foreground">
                    الفئة
                  </th>
                  <th className="text-start p-2 text-[10px] font-bold text-muted-foreground">
                    الرواية الرسمية
                  </th>
                  <th className="text-start p-2 text-[10px] font-bold text-muted-foreground">
                    رواية الدفاع
                  </th>
                  <th className="text-start p-2 text-[10px] font-bold text-muted-foreground">
                    الدليل الفني
                  </th>
                  <th className="text-start p-2 text-[10px] font-bold text-muted-foreground">
                    التصنيف
                  </th>
                </tr>
              </thead>
              <tbody>
                {MOCK_DISCREPANCIES.map((row, idx) => (
                  <tr key={idx} className="border-b border-border/50">
                    <td className="p-2">
                      <span className="text-xs font-bold text-foreground">
                        {row.category}
                      </span>
                    </td>
                    <td className="p-2 text-xs text-muted-foreground">
                      {row.officialVersion}
                    </td>
                    <td className="p-2 text-xs text-green-700">
                      {row.defenseVersion}
                    </td>
                    <td className="p-2 text-xs text-purple-700">
                      {row.forensicEvidence}
                    </td>
                    <td className="p-2">
                      <ClashBadge level={row.clashLevel} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-3 flex items-center gap-2">
            <ChevronRight className="w-3 h-3 text-muted-foreground" />
            <span className="text-[10px] text-muted-foreground">
              مرجع قانوني:{" "}
              {MOCK_DISCREPANCIES[0]?.articleRef} — يرجى التحقق مع المحامي
              المختص
            </span>
          </div>
        </div>
      )}

      {/* Export Button */}
      <button className="clay-button bg-green-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2">
        <Download className="w-4 h-4" />
        تصدير تقرير التدقيق الجنائي واستخراج الثغرات الإجرائية
      </button>
    </div>
  );
}

export default ColomboForensicDesk;
