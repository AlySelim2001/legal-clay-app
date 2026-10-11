import { useState, useMemo } from "react";
import {
  FileText,
  ChevronDown,
  Plus,
  Trash2,
  Eye,
  Download,
  Loader2,
  CheckCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type DocumentFormat = "case-summary" | "bail-receipt" | "legal-memo" | "hearing-report";
export type ProcedureStep = "form" | "preview" | "generated";

interface DocumentGeneratorCardProps {
  caseCode: string;
  caseName: string;
  defaultFormat?: DocumentFormat;
  onGenerate?: (format: DocumentFormat, data: Record<string, string>) => Promise<Blob>;
  onDownload?: (blob: Blob, filename: string) => void;
  className?: string;
}

const documentFormats: Record<DocumentFormat, { label: string; icon: string; description: string }> = {
  "case-summary": {
    label: "ملخص القضية",
    icon: "📋",
    description: "ملخص شامل لحالة القضية والإجراءات المتخذة",
  },
  "bail-receipt": {
    label: "إيصال الكفالة",
    icon: "🧾",
    description: "إيصال رسمي لدفع مبلغ الكفالة",
  },
  "legal-memo": {
    label: "مذكرة دفاعية",
    icon: "📄",
    description: "مذكرة قانونية دفاعية شاملة",
  },
  "hearing-report": {
    label: "تقرير الجلسة",
    icon: "📝",
    description: "تقرير تفصيلي لجلسة المحكمة",
  },
};

export function DocumentGeneratorCard({
  caseCode,
  caseName,
  defaultFormat = "case-summary",
  onGenerate,
  onDownload,
  className,
}: DocumentGeneratorCardProps) {
  const [step, setStep] = useState<ProcedureStep>("form");
  const [selectedFormat, setSelectedFormat] = useState<DocumentFormat>(defaultFormat);
  const [isGenerating, setIsGenerating] = useState(false);
  const [formData, setFormData] = useState<Record<string, string>>({
    caseCode,
    caseName,
    author: "",
    notes: "",
  });
  const [expandedFormat, setExpandedFormat] = useState<DocumentFormat | null>(null);

  const handleFormatSelect = (format: DocumentFormat) => {
    setSelectedFormat(format);
    setStep("form");
  };

  const handleFormChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleGenerate = async () => {
    if (!onGenerate) return;
    setIsGenerating(true);

    try {
      const blob = await onGenerate(selectedFormat, formData);
      setStep("generated");

      // Auto-trigger download if handler provided
      if (onDownload) {
        const filename = `${caseCode}-${selectedFormat}-${Date.now()}.pdf`;
        onDownload(blob, filename);
      }
    } catch (error) {
      console.error("Document generation failed:", error);
    } finally {
      setIsGenerating(false);
    }
  };

  const selectedFormatConfig = documentFormats[selectedFormat];

  return (
    <div className={cn("clay-card p-6 space-y-6", className)}>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-lg bg-clay-blue/20 flex items-center justify-center">
          <FileText className="w-5 h-5 text-clay-blue" />
        </div>
        <div>
          <h3 className="text-base font-bold text-foreground">منشئ المستندات القانونية</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {caseCode} — {caseName}
          </p>
        </div>
      </div>

      {/* Format Selection */}
      <div className="space-y-3">
        <label className="text-sm font-semibold text-foreground block">
          نوع المستند
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {(Object.entries(documentFormats) as [DocumentFormat, typeof documentFormats[DocumentFormat]][]).map(
            ([format, config]) => (
              <button
                key={format}
                onClick={() => handleFormatSelect(format)}
                className={cn(
                  "clay-button min-h-[56px] p-3 rounded-xl text-start transition-all active:scale-[0.98]",
                  "focus-visible:ring-2 focus-visible:ring-amber-500 outline-none",
                  selectedFormat === format
                    ? "ring-2 ring-clay-blue bg-clay-blue/10 border border-clay-blue/30"
                    : "bg-muted hover:bg-muted/70 border border-border"
                )}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-foreground">{config.icon} {config.label}</p>
                    <p className="text-xs text-muted-foreground mt-1">{config.description}</p>
                  </div>
                  {selectedFormat === format && (
                    <CheckCircle className="w-5 h-5 text-clay-blue shrink-0 mt-0.5" />
                  )}
                </div>
              </button>
            )
          )}
        </div>
      </div>

      {/* Form Fields */}
      {step === "form" && (
        <div className="space-y-4 py-4 border-t border-border">
          <label className="text-sm font-semibold text-foreground block">
            بيانات المستند
          </label>

          {/* Author Field */}
          <div>
            <label className="block text-xs font-medium text-foreground mb-2">
              اسم المحامي (المؤلف)
            </label>
            <input
              type="text"
              value={formData.author}
              onChange={(e) => handleFormChange("author", e.target.value)}
              placeholder="أدخل اسم المحامي..."
              className={cn(
                "clay-input w-full px-4 py-3 text-sm bg-background min-h-[56px]",
                "focus-visible:ring-2 focus-visible:ring-amber-500"
              )}
            />
          </div>

          {/* Notes Field */}
          <div>
            <label className="block text-xs font-medium text-foreground mb-2">
              ملاحظات إضافية
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => handleFormChange("notes", e.target.value)}
              placeholder="أضف ملاحظاتك هنا..."
              rows={4}
              className={cn(
                "clay-input w-full px-4 py-3 text-sm bg-background resize-none",
                "focus-visible:ring-2 focus-visible:ring-amber-500"
              )}
            />
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-3 pt-4 border-t border-border">
        {step === "form" && (
          <>
            <button
              onClick={handleGenerate}
              disabled={isGenerating}
              className={cn(
                "flex-1 clay-button min-h-[56px] flex items-center justify-center gap-2",
                "bg-gradient-to-r from-clay-blue to-clay-blue/80 text-white font-semibold rounded-xl",
                "hover:shadow-lg active:scale-[0.98] transition-all duration-200",
                "disabled:opacity-50 disabled:cursor-not-allowed",
                "focus-visible:ring-2 focus-visible:ring-amber-500 outline-none"
              )}
            >
              {isGenerating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <FileText className="w-4 h-4" />
                  <span>إنشاء المستند</span>
                </>
              )}
            </button>

            <button
              onClick={() => setFormData({ caseCode, caseName, author: "", notes: "" })}
              className={cn(
                "clay-button min-h-[56px] min-w-[56px] p-3 rounded-xl",
                "bg-muted hover:bg-muted/70 border border-border",
                "focus-visible:ring-2 focus-visible:ring-amber-500 outline-none"
              )}
              title="إعادة تعيين"
            >
              <Trash2 className="w-4 h-4 text-muted-foreground" />
            </button>
          </>
        )}

        {step === "generated" && (
          <button
            onClick={() => setStep("form")}
            className={cn(
              "flex-1 clay-button min-h-[56px] flex items-center justify-center gap-2",
              "bg-clay-teal/20 text-clay-teal font-semibold rounded-xl",
              "hover:bg-clay-teal/30 active:scale-[0.98] transition-all",
              "focus-visible:ring-2 focus-visible:ring-amber-500 outline-none"
            )}
          >
            <CheckCircle className="w-4 h-4" />
            <span>تم الإنشاء بنجاح ✓</span>
          </button>
        )}
      </div>

      {/* Preview Section */}
      {step === "generated" && (
        <div className="py-4 px-4 bg-clay-teal/10 rounded-lg border border-clay-teal/20">
          <p className="text-sm text-clay-teal font-medium">
            ✓ تم إنشاء المستند بنجاح وتم تحميله تلقائيًا
          </p>
        </div>
      )}

      {/* Ease Mode Enhancements */}
      <style>{`
        .ma-at-ease .document-generator-card,
        [data-ma-at-ease="true"] .document-generator-card {
          font-size: 1.1em;
        }
        
        .ma-at-ease .document-generator-card input,
        .ma-at-ease .document-generator-card textarea,
        .ma-at-ease .document-generator-card button,
        [data-ma-at-ease="true"] .document-generator-card input,
        [data-ma-at-ease="true"] .document-generator-card textarea,
        [data-ma-at-ease="true"] .document-generator-card button {
          min-height: 64px;
          font-size: 1.0625rem;
          font-weight: 600;
        }
      `}</style>
    </div>
  );
}
