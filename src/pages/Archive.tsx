import { useState, useMemo, useCallback } from "react";
import {
  Search,
  FileText,
  FolderOpen,
  Download,
  Trash2,
  Upload,
  Loader2,
  ScanLine,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAllAttachments } from "@/hooks/useSupabaseData";
import { processDocument } from "@/lib/open-source/ocr";
import type { OCRProcessingLog } from "@/lib/open-source";

const typeColors: Record<string, string> = {
  "صورة محضر الجلسة": "bg-clay-blue/10 text-clay-blue",
  "صورة حكم أول درجة": "bg-clay-rose/10 text-clay-rose",
  "صورة استمارة/إيصال الكفالة": "bg-clay-teal/10 text-clay-teal",
  "توكيل رسمي عام": "bg-clay-purple/10 text-clay-purple",
  "حافظة مستندات ومذكرة دفاع": "bg-clay-amber/10 text-clay-amber",
  "صورة حكم البراءة السابق": "bg-urgency-normal/10 text-urgency-normal",
  "أخرى": "bg-muted text-muted-foreground",
};

export default function Archive() {
  const { data: documents, loading, error } = useAllAttachments();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("الكل");
  const [caseFilter, setCaseFilter] = useState<string>("الكل");
  const [ocrFiles, setOcrFiles] = useState<(File | Blob)[]>([]);
  const [ocrResults, setOcrResults] = useState<OCRProcessingLog[]>([]);
  const [ocrProcessing, setOcrProcessing] = useState(false);
  const [ocrProgress, setOcrProgress] = useState<string>("");

  const caseCodes = useMemo(() => {
    if (!documents) return ["الكل"];
    const codes = [...new Set(documents.map((d) => d.case?.case_code ?? "—"))];
    return ["الكل", ...codes];
  }, [documents]);

  const documentTypes = useMemo(() => {
    if (!documents) return ["الكل"];
    const types = [...new Set(documents.map((d) => d.document_type ?? "أخرى"))];
    return ["الكل", ...types];
  }, [documents]);

  const filtered = useMemo(() => {
    if (!documents) return [];
    let result = documents;
    if (search) {
      result = result.filter(
        (d) =>
          (d.case?.case_code ?? "").includes(search) ||
          (d.document_type ?? "").includes(search) ||
          (d.notes ?? "").includes(search)
      );
    }
    if (typeFilter !== "الكل") {
      result = result.filter((d) => (d.document_type ?? "أخرى") === typeFilter);
    }
    if (caseFilter !== "الكل") {
      result = result.filter((d) => d.case?.case_code === caseFilter);
    }
    return result;
  }, [documents, search, typeFilter, caseFilter]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-sm text-red-500">خطأ في تحميل البيانات: {error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">الأرشيف</h1>
          <p className="text-sm text-muted-foreground mt-1">
            إدارة وتخزين الوثائق والمرفقات
          </p>
        </div>
        <div className="flex gap-2">
          <label className="clay-button flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground text-sm font-semibold rounded-xl cursor-pointer">
            <Upload className="w-4 h-4" />
            رفع وثيقة
            <input
              type="file"
              multiple
              accept="image/*,.pdf"
              className="hidden"
              onChange={(e) => {
                const files = Array.from(e.target.files ?? []);
                if (files.length > 0) setOcrFiles((prev) => [...prev, ...files]);
              }}
            />
          </label>
          {ocrFiles.length > 0 && (
            <button
              onClick={async () => {
                setOcrProcessing(true);
                setOcrResults([]);
                const results: OCRProcessingLog[] = [];
                for (let i = 0; i < ocrFiles.length; i++) {
                  setOcrProgress(`جاري معالجة ${i + 1} من ${ocrFiles.length}...`);
                  try {
                    const result = await processDocument(ocrFiles[i], (p) => {
                      setOcrProgress(`جاري معالجة ${i + 1} من ${ocrFiles.length}... ${(p * 100).toFixed(0)}%`);
                    });
                    results.push(result);
                  } catch {
                    // Skip failed files
                  }
                }
                setOcrResults(results);
                setOcrFiles([]);
                setOcrProcessing(false);
                setOcrProgress("");
              }}
              disabled={ocrProcessing}
              className="clay-button flex items-center gap-2 px-4 py-2.5 bg-clay-purple/10 text-clay-purple text-sm font-semibold rounded-xl disabled:opacity-50"
            >
              {ocrProcessing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <ScanLine className="w-4 h-4" />
              )}
              مسح OCR ({ocrFiles.length})
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="clay-card p-4 text-center">
          <FileText className="w-6 h-6 text-clay-rose mx-auto mb-2" />
          <p className="text-xl font-bold text-foreground">{documents?.length ?? 0}</p>
          <p className="text-xs text-muted-foreground">إجمالي الوثائق</p>
        </div>
        <div className="clay-card p-4 text-center">
          <FolderOpen className="w-6 h-6 text-clay-blue mx-auto mb-2" />
          <p className="text-xl font-bold text-foreground">{caseCodes.length - 1}</p>
          <p className="text-xs text-muted-foreground">قضايا لها وثائق</p>
        </div>
        <div className="clay-card p-4 text-center">
          <FileText className="w-6 h-6 text-clay-purple mx-auto mb-2" />
          <p className="text-xl font-bold text-foreground">{documentTypes.length - 1}</p>
          <p className="text-xs text-muted-foreground">أنواع الوثائق</p>
        </div>
      </div>

      {/* Filters */}
      <div className="clay-card p-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute end-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="بحث في الوثائق..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="clay-input w-full pe-10 ps-4 py-2.5 text-sm bg-background"
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="clay-input px-3 py-2 text-sm bg-background min-w-[120px]"
        >
          {documentTypes.map((t) => (
            <option key={t} value={t}>
              {t === "الكل" ? "جميع الأنواع" : t}
            </option>
          ))}
        </select>
        <select
          value={caseFilter}
          onChange={(e) => setCaseFilter(e.target.value)}
          className="clay-input px-3 py-2 text-sm bg-background min-w-[180px]"
        >
          {caseCodes.map((cc) => (
            <option key={cc} value={cc}>
              {cc === "الكل" ? "جميع القضايا" : cc}
            </option>
          ))}
        </select>
      </div>

      {/* OCR Processing Progress */}
      {ocrProcessing && (
        <div className="clay-card p-4">
          <div className="flex items-center gap-3">
            <Loader2 className="w-5 h-5 animate-spin text-clay-purple" />
            <span className="text-sm text-foreground font-medium">{ocrProgress}</span>
          </div>
        </div>
      )}

      {/* OCR Results */}
      {ocrResults.length > 0 && (
        <div className="clay-card p-4 space-y-3">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <ScanLine className="w-4 h-4 text-clay-purple" />
            نتائج المسح الضوئي ({ocrResults.length})
          </h3>
          {ocrResults.map((result, idx) => (
            <div key={idx} className="clay-card-soft p-3">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="w-4 h-4 text-urgency-normal" />
                <span className="text-sm font-medium text-foreground">
                  نتيجة #{idx + 1}
                </span>
                <span className="clay-badge text-[10px] bg-clay-blue/10 text-clay-blue px-2 py-0.5">
                  ثقة: {result.confidenceScore.toFixed(1)}%
                </span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
                {result.extractedFields.nationalId && (
                  <div>
                    <span className="text-muted-foreground">رقم قومي:</span>
                    <span className="font-medium text-foreground me-1">{result.extractedFields.nationalId}</span>
                  </div>
                )}
                {result.extractedFields.caseNo && (
                  <div>
                    <span className="text-muted-foreground">رقم القضية:</span>
                    <span className="font-medium text-foreground me-1">{result.extractedFields.caseNo}</span>
                  </div>
                )}
                {result.extractedFields.bailAmount && (
                  <div>
                    <span className="text-muted-foreground">الكفالة:</span>
                    <span className="font-medium text-foreground me-1">{result.extractedFields.bailAmount.toLocaleString("ar-EG")} ج.م</span>
                  </div>
                )}
                {result.extractedFields.judgeName && (
                  <div>
                    <span className="text-muted-foreground">القاضي:</span>
                    <span className="font-medium text-foreground me-1">{result.extractedFields.judgeName}</span>
                  </div>
                )}
                {result.extractedFields.courtName && (
                  <div>
                    <span className="text-muted-foreground">المحكمة:</span>
                    <span className="font-medium text-foreground me-1">{result.extractedFields.courtName}</span>
                  </div>
                )}
              </div>
              <pre className="mt-2 text-[10px] text-muted-foreground max-h-20 overflow-y-auto p-2 clay-inset rounded-lg">
                {result.extractedText.slice(0, 300)}
              </pre>
            </div>
          ))}
        </div>
      )}

      {/* Documents Table */}
      <div className="clay-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-start px-4 py-3 font-semibold text-muted-foreground text-xs uppercase">النوع</th>
                <th className="text-start px-4 py-3 font-semibold text-muted-foreground text-xs uppercase">القضية</th>
                <th className="text-start px-4 py-3 font-semibold text-muted-foreground text-xs uppercase">التاريخ</th>
                <th className="text-start px-4 py-3 font-semibold text-muted-foreground text-xs uppercase">ملاحظات</th>
                <th className="text-start px-4 py-3 font-semibold text-muted-foreground text-xs uppercase">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((doc) => {
                const typeName = doc.document_type ?? "أخرى";
                const colorClass = typeColors[typeName] ?? "bg-muted text-muted-foreground";
                return (
                  <tr
                    key={doc.id}
                    className="border-b border-border/50 hover:bg-muted/30 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className={cn("p-1.5 rounded-lg", colorClass)}>
                          <FileText className="w-3.5 h-3.5" />
                        </div>
                        <span className="font-medium text-foreground text-sm truncate max-w-[250px]">
                          {typeName}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-clay-blue">
                      {doc.case?.case_code ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {doc.uploaded_at.split("T")[0]}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {doc.notes ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button className="p-1.5 rounded-lg hover:bg-muted transition-colors">
                          <Download className="w-3.5 h-3.5 text-muted-foreground" />
                        </button>
                        <button className="p-1.5 rounded-lg hover:bg-destructive/5 transition-colors">
                          <Trash2 className="w-3.5 h-3.5 text-muted-foreground hover:text-destructive" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
