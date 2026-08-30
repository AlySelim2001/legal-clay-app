import { useState } from "react";
import { useParams, Link } from "react-router";
import {
  ArrowRight,
  FileText,
  Users,
  Calendar,
  AlertTriangle,
  MessageSquare,
  Paperclip,
  Edit,
  Printer,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { mockCases, mockHearings, mockDocuments, mockDeadlines } from "@/data/mock";

const tabs = [
  { id: "overview", label: "نظرة عامة", icon: FileText },
  { id: "hearings", label: "الجلسات", icon: Calendar },
  { id: "documents", label: "الوثائق", icon: Paperclip },
  { id: "deadlines", label: "المواعيد", icon: AlertTriangle },
  { id: "notes", label: "الملاحظات", icon: MessageSquare },
];

export default function CaseDetail() {
  const { caseCode } = useParams();
  const [activeTab, setActiveTab] = useState("overview");

  const caseData = mockCases.find((c) => c.caseCode === caseCode) || mockCases[0];
  const caseHearings = mockHearings.filter((h) => h.caseCode === caseData.caseCode);
  const caseDocs = mockDocuments.filter((d) => d.caseCode === caseData.caseCode);
  const caseDeadlines = mockDeadlines.filter((d) => d.caseCode === caseData.caseCode);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link to="/app/cases" className="hover:text-foreground transition-colors">
          القضايا
        </Link>
        <ArrowRight className="w-3 h-3" />
        <span className="text-foreground font-medium">{caseData.caseCode}</span>
      </div>

      {/* Case Header */}
      <div className="clay-card p-6">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="font-mono text-sm font-bold text-clay-blue">
                {caseData.caseCode}
              </span>
              <span
                className={cn(
                  "clay-badge text-[10px] font-bold px-2.5 py-1",
                  caseData.status === "活跃"
                    ? "bg-urgency-normal/10 text-urgency-normal"
                    : "bg-urgency-high/10 text-urgency-high"
                )}
              >
                {caseData.status}
              </span>
              <span
                className={cn(
                  "clay-badge text-[10px] font-bold px-2.5 py-1",
                  caseData.priority === "حرج"
                    ? "bg-urgency-critical/10 text-urgency-critical"
                    : caseData.priority === "مرتفع"
                    ? "bg-urgency-high/10 text-urgency-high"
                    : "bg-urgency-normal/10 text-urgency-normal"
                )}
              >
                {caseData.priority}
              </span>
            </div>
            <h1 className="text-xl font-bold text-foreground">{caseData.title}</h1>
            <p className="text-sm text-muted-foreground mt-1">{caseData.notes}</p>
          </div>
          <div className="flex gap-2">
            <button className="clay-button flex items-center gap-2 px-3 py-2 bg-card text-sm rounded-xl text-muted-foreground hover:text-foreground">
              <Printer className="w-4 h-4" />
              طباعة
            </button>
            <button className="clay-button flex items-center gap-2 px-3 py-2 bg-card text-sm rounded-xl text-muted-foreground hover:text-foreground">
              <Edit className="w-4 h-4" />
              تعديل
            </button>
          </div>
        </div>

        {/* Quick Info Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
          {[
            { label: "العميل", value: caseData.clientName },
            { label: "المحكمة", value: caseData.court },
            { label: "القاضي", value: caseData.judge },
            { label: "المحامي المسؤول", value: caseData.lawyer },
          ].map((info) => (
            <div key={info.label} className="clay-inset p-3 rounded-xl">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
                {info.label}
              </p>
              <p className="text-sm font-semibold text-foreground">{info.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="clay-card">
        <div className="flex border-b border-border overflow-x-auto clay-scrollbar">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex items-center gap-2 px-5 py-3.5 text-sm font-medium whitespace-nowrap transition-all border-b-2 -mb-px",
                  activeTab === tab.id
                    ? "text-clay-blue border-clay-blue"
                    : "text-muted-foreground border-transparent hover:text-foreground"
                )}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="p-6">
          {/* Overview Tab */}
          {activeTab === "overview" && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="clay-card-soft p-4">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-3">
                    معلومات القضية
                  </h4>
                  <div className="space-y-2.5">
                    {[
                      ["نوع الجريمة", caseData.crimeType],
                      ["تاريخ التقديم", caseData.filingDate],
                      ["الجلسة القادمة", caseData.nextHearing],
                      ["الموعد النهائي", caseData.deadline],
                    ].map(([label, value]) => (
                      <div key={label} className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">{label}</span>
                        <span className="text-sm font-medium text-foreground">{value}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="clay-card-soft p-4">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-3">
                    ملخص الحالة
                  </h4>
                  <p className="text-sm text-foreground leading-relaxed">
                    {caseData.notes}
                  </p>
                  <div className="mt-4 flex gap-2">
                    <div className="clay-badge bg-clay-blue/10 text-clay-blue text-xs font-semibold px-3 py-1.5">
                      📋 {caseHearings.length} جلسات
                    </div>
                    <div className="clay-badge bg-clay-purple/10 text-clay-purple text-xs font-semibold px-3 py-1.5">
                      📎 {caseDocs.length} وثائق
                    </div>
                    <div className="clay-badge bg-clay-rose/10 text-clay-rose text-xs font-semibold px-3 py-1.5">
                      ⏰ {caseDeadlines.filter((d) => d.status !== "مكتمل").length} مواعيد نشطة
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Hearings Tab */}
          {activeTab === "hearings" && (
            <div className="space-y-3">
              {caseHearings.length > 0 ? (
                caseHearings.map((h) => (
                  <div key={h.id} className="clay-card-soft p-4 flex items-start gap-4">
                    <div className="p-2.5 rounded-2xl bg-clay-blue/10 shrink-0">
                      <Calendar className="w-5 h-5 text-clay-blue" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-bold text-foreground">{h.type}</span>
                        <span className="clay-badge text-[10px] bg-clay-purple/10 text-clay-purple px-2 py-0.5">
                          {h.date} — {h.time}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">{h.court}</p>
                      <p className="text-xs text-muted-foreground mt-1">القاضي: {h.judge}</p>
                      <p className="text-sm text-foreground/80 mt-2">{h.notes}</p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">
                  لا توجد جلسات مسجلة لهذه القضية
                </p>
              )}
            </div>
          )}

          {/* Documents Tab */}
          {activeTab === "documents" && (
            <div className="space-y-3">
              {caseDocs.length > 0 ? (
                caseDocs.map((doc) => (
                  <div key={doc.id} className="clay-card-soft p-4 flex items-center gap-4">
                    <div className="p-2.5 rounded-2xl bg-clay-rose/10 shrink-0">
                      <FileText className="w-5 h-5 text-clay-rose" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{doc.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {doc.type.toUpperCase()} — {doc.size} — رفعه: {doc.uploadedBy}
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground">{doc.uploadDate}</span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">
                  لا توجد وثائق مرفقة
                </p>
              )}
            </div>
          )}

          {/* Deadlines Tab */}
          {activeTab === "deadlines" && (
            <div className="space-y-3">
              {caseDeadlines.length > 0 ? (
                caseDeadlines.map((d) => (
                  <div
                    key={d.id}
                    className={cn(
                      "clay-card-soft p-4 border-2",
                      d.urgency === "critical"
                        ? "border-urgency-critical/20"
                        : d.urgency === "high"
                        ? "border-urgency-high/20"
                        : "border-urgency-normal/20"
                    )}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm font-semibold text-foreground">{d.description}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          النوع: {d.type} — الموعد: {d.dueDate}
                        </p>
                      </div>
                      <span
                        className={cn(
                          "clay-badge text-[10px] font-bold px-2 py-1",
                          d.status === "مكتمل"
                            ? "bg-urgency-normal/10 text-urgency-normal"
                            : d.urgency === "critical"
                            ? "bg-urgency-critical/10 text-urgency-critical"
                            : "bg-urgency-high/10 text-urgency-high"
                        )}
                      >
                        {d.status}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">
                  لا توجد مواعيد نهائية
                </p>
              )}
            </div>
          )}

          {/* Notes Tab */}
          {activeTab === "notes" && (
            <div className="space-y-4">
              <div className="clay-card-soft p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-xl bg-clay-blue/20 flex items-center justify-center">
                    <span className="text-xs font-bold text-clay-blue">م</span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">محمد فتحي</p>
                    <p className="text-[10px] text-muted-foreground">15 أغسطس 2026</p>
                  </div>
                </div>
                <p className="text-sm text-foreground/80 leading-relaxed mt-2">
                  {caseData.notes}
                </p>
              </div>
              <div className="clay-inset p-4 rounded-xl">
                <textarea
                  placeholder="أضف ملاحظة جديدة..."
                  className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground/50 resize-none focus:outline-none min-h-[80px]"
                />
                <div className="flex justify-end mt-2">
                  <button className="clay-button px-4 py-2 bg-primary text-primary-foreground text-xs font-semibold rounded-xl">
                    إرسال
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
