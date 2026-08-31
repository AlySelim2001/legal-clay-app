import { useState, useEffect } from "react";
import { useParams, Link } from "react-router";
import {
  ArrowRight,
  FileText,
  Calendar,
  AlertTriangle,
  MessageSquare,
  Paperclip,
  Edit,
  Printer,
  Loader2,
  Clock,
  Upload,
  Download,
  FileDown,
  ScanLine,
  History,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useCase } from "@/hooks/useSupabaseData";
import { supabase } from "@/lib/supabase";
import { LegalDisclaimer } from "@/components/LegalDisclaimer";
import { FileUpload } from "@/components/FileUpload";
import { AuditTimeline } from "@/components/AuditTimeline";
import { generatePDF, downloadPDF } from "@/lib/open-source/pdf-generator";
import { processDocument } from "@/lib/open-source/ocr";

const tabs = [
  { id: "overview", label: "نظرة عامة", icon: FileText },
  { id: "hearings", label: "الجلسات", icon: Calendar },
  { id: "documents", label: "الوثائق", icon: Paperclip },
  { id: "procedural", label: "الإجراءات", icon: AlertTriangle },
  { id: "deadlines", label: "المواعيد", icon: Clock },
  { id: "timeline", label: "السجل", icon: History },
  { id: "notes", label: "الملاحظات", icon: MessageSquare },
];

interface AppealDeadline {
  deadline_type: string;
  deadline_date: string;
  days_remaining: number;
  urgency: string;
  legal_basis: string;
}

function getUrgencyStyle(urgency: string) {
  if (urgency === "critical") return "bg-urgency-critical/10 text-urgency-critical border-urgency-critical/20";
  if (urgency === "high") return "bg-urgency-high/10 text-urgency-high border-urgency-high/20";
  return "bg-urgency-normal/10 text-urgency-normal border-urgency-normal/20";
}

function getUrgencyLabel(urgency: string) {
  if (urgency === "critical") return "حرج";
  if (urgency === "high") return "مرتفع";
  return "عادي";
}

export default function CaseDetail() {
  const { caseCode } = useParams();
  const { data: caseData, loading, error } = useCase(caseCode ?? "");
  const [activeTab, setActiveTab] = useState("overview");
  const [appealDeadlines, setAppealDeadlines] = useState<AppealDeadline[]>([]);
  const [loadingAppeals, setLoadingAppeals] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [pdfFormat, setPdfFormat] = useState<"case-summary" | "bail-receipt" | "legal-memo" | "hearing-report">("case-summary");
  const [ocrProcessing, setOcrProcessing] = useState(false);
  const [ocrResult, setOcrResult] = useState<string | null>(null);

  // Fetch appeal deadlines when procedural tab is active
  useEffect(() => {
    if (activeTab === "deadlines" || activeTab === "procedural") {
      setLoadingAppeals(true);
      supabase.rpc("get_appeal_deadlines", { p_case_id: caseData?.id })
        .then(({ data, error: rpcError }) => {
          if (!rpcError && data) setAppealDeadlines(data as AppealDeadline[]);
          setLoadingAppeals(false);
        });
    }
  }, [activeTab, caseData?.id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !caseData) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-sm text-red-500">خطأ في تحميل البيانات: {error ?? "لم يتم العثور على القضية"}</p>
      </div>
    );
  }

  const clientName = caseData.client?.full_name ?? "—";
  const defenseName = caseData.defense?.name ?? "—";
  const stage = caseData.procedural_stage;

  return (
    <div className="space-y-0 animate-fade-in">
      {/* Legal Disclaimer Banner */}
      <LegalDisclaimer />

      <div className="p-6 space-y-6">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link to="/app/cases" className="hover:text-foreground transition-colors">
            القضايا
          </Link>
          <ArrowRight className="w-3 h-3" />
          <span className="text-foreground font-medium">{caseData.case_code}</span>
        </div>

        {/* Case Header */}
        <div className="clay-card p-6">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <span className="font-mono text-sm font-bold text-clay-blue">
                  {caseData.case_code}
                </span>
                <span className="clay-badge text-[10px] font-bold px-2.5 py-1 bg-clay-blue/10 text-clay-blue">
                  {caseData.procedural_status ?? "أخرى"}
                </span>
                <span className="clay-badge text-[10px] font-bold px-2.5 py-1 bg-urgency-normal/10 text-urgency-normal">
                  {defenseName}
                </span>
              </div>
              <h1 className="text-xl font-bold text-foreground">{caseData.case_no}</h1>
              <p className="text-sm text-muted-foreground mt-1">{caseData.memo_notes ?? ""}</p>
            </div>
            <div className="flex gap-2 flex-wrap">
              {/* PDF Export */}
              <div className="relative">
                <select
                  value={pdfFormat}
                  onChange={(e) => setPdfFormat(e.target.value as typeof pdfFormat)}
                  className="clay-input text-[10px] py-1 px-2 bg-background absolute -top-8 end-0 opacity-0 pointer-events-none"
                />
                <button
                  onClick={async () => {
                    if (!caseData) return;
                    setGeneratingPdf(true);
                    try {
                      const blob = await generatePDF(pdfFormat, {
                        case: caseData,
                        client: caseData.client ?? {
                          id: "",
                          client_code: "",
                          full_name: "",
                          national_id: "",
                          phone: null,
                          email: null,
                          created_at: "",
                          created_by: null,
                        },
                        defense: caseData.defense,
                        stage: caseData.procedural_stage,
                        memoTitle: "مذكرة دفاعية",
                        memoBody: caseData.memo_notes ?? "لا توجد ملاحظات",
                        authorName: "المحامي",
                      });
                      downloadPDF(blob, `CRIM-SYS-${caseData.case_code}-${pdfFormat}.pdf`);
                    } catch (err) {
                      console.error("PDF generation failed:", err);
                    } finally {
                      setGeneratingPdf(false);
                    }
                  }}
                  disabled={generatingPdf}
                  className="clay-button flex items-center gap-2 px-3 py-2 bg-clay-blue/10 text-clay-blue text-sm rounded-xl hover:bg-clay-blue/20 disabled:opacity-50"
                >
                  {generatingPdf ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <FileDown className="w-4 h-4" />
                  )}
                  تصدير PDF
                </button>
              </div>
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

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
            {[
              { label: "العميل", value: clientName },
              { label: "المحكمة", value: caseData.court_name },
              { label: "رقم القضية", value: caseData.case_no },
              { label: "التصنيف", value: caseData.tactical_classification ?? "—" },
            ].map((info) => (
              <div key={info.label} className="clay-inset p-3 rounded-xl">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">{info.label}</p>
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
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-3">معلومات القضية</h4>
                    <div className="space-y-2.5">
                      {[
                        ["رقم القضية", caseData.case_no],
                        ["تاريخ التقديم", caseData.filing_date],
                        ["المحكمة", caseData.court_name],
                        ["الكفالة", `${Number(caseData.bail_amount_egp).toLocaleString()} ج.م`],
                        ["تاريخ جلسة المعارضة", caseData.opposition_hearing_date ?? "—"],
                      ].map(([label, value]) => (
                        <div key={label} className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">{label}</span>
                          <span className="text-sm font-medium text-foreground">{value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="clay-card-soft p-4">
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-3">ملخص الحالة</h4>
                    <p className="text-sm text-foreground leading-relaxed">
                      {caseData.memo_notes ?? "لا توجد ملاحظات"}
                    </p>
                    <div className="mt-4 flex gap-2">
                      <div className="clay-badge bg-clay-blue/10 text-clay-blue text-xs font-semibold px-3 py-1.5">
                        📋 {caseData.schedules?.length ?? 0} جلسات
                      </div>
                      <div className="clay-badge bg-clay-purple/10 text-clay-purple text-xs font-semibold px-3 py-1.5">
                        📎 {caseData.attachments?.length ?? 0} وثائق
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Hearings Tab */}
            {activeTab === "hearings" && (
              <div className="space-y-3">
                {(caseData.schedules ?? []).length > 0 ? (
                  (caseData.schedules ?? []).map((h) => (
                    <div key={h.id} className="clay-card-soft p-4 flex items-start gap-4">
                      <div className="p-2.5 rounded-2xl bg-clay-blue/10 shrink-0">
                        <Calendar className="w-5 h-5 text-clay-blue" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-bold text-foreground">{h.session_type}</span>
                          <span className="clay-badge text-[10px] bg-clay-purple/10 text-clay-purple px-2 py-0.5">
                            {h.session_date}
                          </span>
                        </div>
                        <p className="text-sm text-foreground/80 mt-2">{h.required_action ?? "—"}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">لا توجد جلسات مسجلة لهذه القضية</p>
                )}
              </div>
            )}

            {/* Documents Tab */}
            {activeTab === "documents" && (
              <div className="space-y-6">
                {/* File Upload */}
                <div>
                  <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                    <Upload className="w-4 h-4" />
                    رفع وثائق جديدة
                  </h4>
                  <FileUpload caseId={caseData.id} onUploadComplete={() => window.location.reload()} />
                </div>

                {/* OCR Scanner */}
                <div className="clay-card-soft p-4">
                  <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                    <ScanLine className="w-4 h-4 text-clay-purple" />
                    مسح المستندات OCR
                  </h4>
                  <p className="text-xs text-muted-foreground mb-3">
                    ارفع صورة أو PDF لاستخراج البيانات تلقائياً (الرقم القومي، رقم القضية، مبلغ الكفالة)
                  </p>
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    className="block w-full text-sm text-muted-foreground file:me-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-clay-purple/10 file:text-clay-purple hover:file:bg-clay-purple/20 file:cursor-pointer"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      setOcrProcessing(true);
                      setOcrResult(null);
                      try {
                        const result = await processDocument(file);
                        const fields = result.extractedFields;
                        const summary = [
                          fields.nationalId && `الرقم القومي: ${fields.nationalId}`,
                          fields.caseNo && `رقم القضية: ${fields.caseNo}`,
                          fields.bailAmount && `مبلغ الكفالة: ${fields.bailAmount.toLocaleString("ar-EG")} ج.م`,
                          fields.judgeName && `القاضي: ${fields.judgeName}`,
                          fields.courtName && `المحكمة: ${fields.courtName}`,
                          fields.filingDate && `التاريخ: ${fields.filingDate}`,
                        ].filter(Boolean).join("\n");
                        setOcrResult(
                          `الثقة: ${result.confidenceScore.toFixed(1)}%\n\n${summary || "لم يتم العثور على بيانات مُعرفة"}\n\nالنص المستخرج:\n${result.extractedText.slice(0, 500)}`
                        );
                      } catch (err) {
                        setOcrResult(`خطأ في المعالجة: ${err instanceof Error ? err.message : "خطأ غير معروف"}`);
                      } finally {
                        setOcrProcessing(false);
                      }
                    }}
                  />
                  {ocrProcessing && (
                    <div className="flex items-center gap-2 mt-3 text-sm text-muted-foreground">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      جاري معالجة المستند...
                    </div>
                  )}
                  {ocrResult && (
                    <pre className="mt-3 p-3 clay-inset rounded-xl text-xs text-foreground whitespace-pre-wrap max-h-48 overflow-y-auto">
                      {ocrResult}
                    </pre>
                  )}
                </div>

                {/* Existing documents */}
                <div>
                  <h4 className="text-sm font-semibold text-foreground mb-3">الوثائق الموجودة</h4>
                  <div className="space-y-3">
                    {(caseData.attachments ?? []).length > 0 ? (
                      (caseData.attachments ?? []).map((doc) => (
                        <div key={doc.id} className="clay-card-soft p-4 flex items-center gap-4">
                          <div className="p-2.5 rounded-2xl bg-clay-rose/10 shrink-0">
                            <FileText className="w-5 h-5 text-clay-rose" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-foreground truncate">{doc.document_type ?? "وثيقة"}</p>
                            <p className="text-xs text-muted-foreground">
                              {doc.storage_path} — رُفع: {doc.uploaded_at.split("T")[0]}
                            </p>
                          </div>
                          <span className="text-xs text-muted-foreground">{doc.notes ?? ""}</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-8">لا توجد وثائق مرفقة</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Procedural Tab */}
            {activeTab === "procedural" && (
              <div className="space-y-4">
                {stage ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[
                      ["حالة الكفالة", stage.bail_payment_status],
                      ["تاريخ دفع الكفالة", stage.bail_payment_date ?? "—"],
                      ["مبلغ الكفالة المدفوع", stage.bail_amount_paid ? `${Number(stage.bail_amount_paid).toLocaleString()} ج.م` : "—"],
                      ["حالة رسوم الاستئناف", stage.appeal_fee_status],
                      ["تاريخ حكم المعارضة", stage.opposition_ruling_date ?? "—"],
                      ["حالة الاستئناف", stage.appeal_status],
                      ["مرجع الاستئناف", stage.appeal_reference ?? "—"],
                      ["الجلسة القادمة للاستئناف", stage.next_appeal_session ?? "—"],
                      ["حالة الطعن بالنقض", stage.cassation_status],
                      ["تاريخ التقادم", stage.prescription_date ?? "—"],
                    ].map(([label, value]) => (
                      <div key={label} className="clay-inset p-3 rounded-xl">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">{label}</p>
                        <p className="text-sm font-medium text-foreground">{value}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">لا توجد بيانات إجرائية مسجلة</p>
                )}
              </div>
            )}

            {/* Deadlines Tab */}
            {activeTab === "deadlines" && (
              <div className="space-y-4">
                <LegalDisclaimer />
                {loadingAppeals ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                  </div>
                ) : appealDeadlines.length > 0 ? (
                  <div className="space-y-3">
                    <h4 className="text-sm font-semibold text-foreground">مواعيد الاستئناف المحسوبة</h4>
                    {appealDeadlines.map((d, i) => (
                      <div key={i} className={cn("clay-card-soft p-4 border-2", getUrgencyStyle(d.urgency))}>
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <p className="text-sm font-semibold text-foreground">{d.deadline_type}</p>
                            <p className="text-xs text-muted-foreground mt-1">{d.legal_basis}</p>
                          </div>
                          <div className="text-end">
                            <p className="text-sm font-bold text-foreground">{d.deadline_date}</p>
                            <p className="text-xs text-muted-foreground">{d.days_remaining} يوم متبقي</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Clock className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">
                      لا توجد مواعيد استئناف محسوبة — تأكد من إدخال تاريخ حكم المعارضة في الإجراءات
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Timeline Tab */}
            {activeTab === "timeline" && (
              <AuditTimeline
                tableName="cases"
                recordId={caseData.id}
              />
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
                      <p className="text-[10px] text-muted-foreground">{caseData.updated_at.split("T")[0]}</p>
                    </div>
                  </div>
                  <p className="text-sm text-foreground/80 leading-relaxed mt-2">
                    {caseData.memo_notes ?? "لا توجد ملاحظات"}
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
    </div>
  );
}
