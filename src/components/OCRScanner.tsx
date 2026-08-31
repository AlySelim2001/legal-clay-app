import { useState, useRef } from "react";
import { Scan, FileText, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

interface ExtractedData {
  national_id?: string;
  case_no?: string;
  bail_amount?: string;
  judge_name?: string;
}

interface ScanResult {
  status: "scanning" | "done" | "error";
  text: string;
  confidence: number;
  extracted: ExtractedData;
}

interface OCRScannerProps {
  attachmentId: string;
  filePath: string;
  onExtracted?: (data: ExtractedData) => void;
}

export function OCRScanner({ attachmentId, filePath, onExtracted }: OCRScannerProps) {
  const [result, setResult] = useState<ScanResult | null>(null);
  const [scanning, setScanning] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const runOCR = async (file: File) => {
    setScanning(true);
    setResult(null);

    try {
      // Dynamic import of Tesseract.js (loaded on demand to save bundle size)
      const Tesseract = await import("tesseract.js");
      const { data } = await Tesseract.recognize(file, "ara+eng", {});

      const extractedText = data.text;
      const confidence = data.confidence;

      // Extract structured data via RPC
      const { data: extracted } = await supabase.rpc("process_ocr_result", {
        p_attachment_id: attachmentId,
        p_extracted_text: extractedText,
        p_confidence: confidence,
      });

      const extractedData: ExtractedData = extracted ?? {};

      setResult({
        status: "done",
        text: extractedText,
        confidence,
        extracted: extractedData,
      });

      onExtracted?.(extractedData);
    } catch (err) {
      setResult({
        status: "error",
        text: err instanceof Error ? err.message : "فشل في المعالجة",
        confidence: 0,
        extracted: {},
      });
    } finally {
      setScanning(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Scan className="w-4 h-4 text-clay-blue" />
        <span className="text-sm font-semibold text-foreground">مسح المستند بالذكاء الاصطناعي</span>
      </div>

      {/* Scan Button */}
      <button
        onClick={() => fileInputRef.current?.click()}
        disabled={scanning}
        className={cn(
          "clay-button w-full py-3 flex items-center justify-center gap-2 text-sm font-semibold rounded-xl",
          scanning
            ? "bg-muted text-muted-foreground"
            : "bg-clay-blue/10 text-clay-blue hover:bg-clay-blue/20"
        )}
      >
        {scanning ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            جاري المسح والاستخراج...
          </>
        ) : (
          <>
            <Scan className="w-4 h-4" />
            مسح واستخراج البيانات من المستند
          </>
        )}
      </button>

      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png,.tiff"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) runOCR(file);
        }}
      />

      {/* Results */}
      {result && (
        <div className={cn(
          "clay-card-soft p-4 border-2",
          result.status === "done" ? "border-urgency-normal/20" : "border-urgency-critical/20"
        )}>
          {result.status === "done" ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-urgency-normal" />
                <span className="text-sm font-semibold text-foreground">
                  تم الاستخراج بنجاح — الثقة: {Math.round(result.confidence)}%
                </span>
              </div>

              {/* Extracted Fields */}
              {Object.keys(result.extracted).length > 0 && (
                <div className="grid grid-cols-2 gap-2">
                  {result.extracted.national_id && (
                    <div className="clay-inset p-2 rounded-lg">
                      <p className="text-[9px] text-muted-foreground uppercase">رقم الهوية</p>
                      <p className="text-xs font-bold text-foreground font-mono">{result.extracted.national_id}</p>
                    </div>
                  )}
                  {result.extracted.case_no && (
                    <div className="clay-inset p-2 rounded-lg">
                      <p className="text-[9px] text-muted-foreground uppercase">رقم القضية</p>
                      <p className="text-xs font-bold text-foreground">{result.extracted.case_no}</p>
                    </div>
                  )}
                  {result.extracted.bail_amount && (
                    <div className="clay-inset p-2 rounded-lg">
                      <p className="text-[9px] text-muted-foreground uppercase">مبلغ الكفالة</p>
                      <p className="text-xs font-bold text-foreground">{result.extracted.bail_amount} ج.م</p>
                    </div>
                  )}
                  {result.extracted.judge_name && (
                    <div className="clay-inset p-2 rounded-lg">
                      <p className="text-[9px] text-muted-foreground uppercase">اسم القاضي</p>
                      <p className="text-xs font-bold text-foreground">{result.extracted.judge_name}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Extracted Text Preview */}
              <div className="clay-inset p-3 rounded-xl max-h-32 overflow-y-auto">
                <p className="text-[10px] text-muted-foreground uppercase mb-1">النص المستخرج</p>
                <p className="text-xs text-foreground/80 leading-relaxed whitespace-pre-wrap">
                  {result.text.slice(0, 500)}{result.text.length > 500 ? "..." : ""}
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-urgency-critical" />
              <span className="text-sm text-urgency-critical">{result.text}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
