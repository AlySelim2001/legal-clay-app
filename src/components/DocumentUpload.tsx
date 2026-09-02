import { useState, useRef, useCallback } from "react";
import { useCreateDocument } from "@/hooks/useEnterprise";
import { supabase } from "@/lib/supabase";
import { audit } from "@/lib/enterprise/audit";
import { DocumentInsertSchema, type DocumentInsert, type DocumentTypeValue, type ReviewStatusType } from "@/types/enterprise";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Upload, Loader2, AlertTriangle, FileText, X } from "lucide-react";

const DOCUMENT_TYPES: DocumentTypeValue[] = [
  "محضر جلسة", "حكم", "استمارة كفالة", "توكيل رسمي", "مذكرة دفاع", "مستند آخر",
];
const ALLOWED_MIME = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
];
const MAX_SIZE_MB = 20;

interface DocumentUploadProps {
  caseId: string;
  onUploaded?: () => void;
}

export function DocumentUpload({ caseId, onUploaded }: DocumentUploadProps) {
  const { create, loading } = useCreateDocument();
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [docType, setDocType] = useState<DocumentTypeValue>("مستند آخر");
  const [reviewStatus, setReviewStatus] = useState<ReviewStatusType>("بانتظار المراجعة");
  const [notes, setNotes] = useState("");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = useCallback((file: File) => {
    setUploadError(null);
    if (!ALLOWED_MIME.includes(file.type)) {
      setUploadError("نوع الملف غير مدعوم — يرجى استخدام PDF أو صورة (JPG/PNG)");
      return;
    }
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      setUploadError(`حجم الملف يتجاوز الحد الأقصى (${MAX_SIZE_MB} MB)`);
      return;
    }
    setSelectedFile(file);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  const handleUpload = async () => {
    if (!selectedFile) return;
    setUploading(true);
    setUploadError(null);

    try {
      // Generate unique storage key
      const ext = selectedFile.name.split(".").pop() ?? "bin";
      const storageKey = `cases/${caseId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

      // Upload to Supabase Storage
      const { error: uploadErr } = await supabase.storage
        .from("case-attachments")
        .upload(storageKey, selectedFile, {
          contentType: selectedFile.type,
          upsert: false,
        });

      if (uploadErr) throw new Error(uploadErr.message);

      // Compute checksum
      const buffer = await selectedFile.arrayBuffer();
      const hashArray = Array.from(new Uint8Array(buffer));
      const checksum = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

      // Insert document record
      const docData: DocumentInsert = {
        case_id: caseId,
        document_type: docType,
        original_file_name: selectedFile.name,
        secure_storage_key: storageKey,
        mime_type: selectedFile.type,
        file_size: selectedFile.size,
        checksum,
        uploaded_by: null,
        review_status: reviewStatus,
        document_date: null,
        notes: notes || undefined,
      };

      const parsed = DocumentInsertSchema.safeParse(docData);
      if (!parsed.success) {
        throw new Error(parsed.error.issues[0]?.message ?? "بيانات غير صحيحة");
      }

      const result = await create(parsed.data);
      if (result) {
        audit.documentUploaded(result.id, selectedFile.name);
        setSelectedFile(null);
        setNotes("");
        setDocType("مستند آخر");
        setReviewStatus("بانتظار المراجعة");
        onUploaded?.();
      }
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "خطأ غير معروف");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-3" dir="rtl">
      {/* Drop Zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileRef.current?.click()}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 transition-all ${
          dragOver
            ? "border-primary bg-primary/5"
            : "border-border hover:border-primary/50 hover:bg-muted/30"
        }`}
      >
        <Upload className="mb-2 h-8 w-8 text-muted-foreground" />
        <p className="text-sm font-medium text-muted-foreground">
          اسحب الملف هنا أو انقر لاختيار ملف
        </p>
        <p className="mt-1 text-xs text-muted-foreground/60">
          PDF, JPG, PNG — حد أقصى {MAX_SIZE_MB} MB
        </p>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png,.webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = "";
        }}
      />

      {/* Selected File */}
      {selectedFile && (
        <div className="flex items-center justify-between rounded-lg border bg-muted/20 p-3">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            <div>
              <p className="text-sm font-medium">{selectedFile.name}</p>
              <p className="text-xs text-muted-foreground">
                {(selectedFile.size / 1024).toFixed(1)} KB
              </p>
            </div>
          </div>
          <button
            onClick={() => setSelectedFile(null)}
            className="rounded-lg p-1 hover:bg-muted"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Document Type & Review Status */}
      {selectedFile && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label className="mb-1 block text-sm">نوع المستند</Label>
            <select
              value={docType}
              onChange={(e) => setDocType(e.target.value as DocumentTypeValue)}
              className="clay-input w-full rounded-xl border bg-white px-3 py-2 text-sm dark:bg-background"
            >
              {DOCUMENT_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div>
            <Label className="mb-1 block text-sm">حالة المراجعة</Label>
            <select
              value={reviewStatus}
              onChange={(e) => setReviewStatus(e.target.value as ReviewStatusType)}
              className="clay-input w-full rounded-xl border bg-white px-3 py-2 text-sm dark:bg-background"
            >
              <option value="بانتظار المراجعة">بانتظار المراجعة</option>
              <option value="تمت المراجعة">تمت المراجعة</option>
              <option value="مرفوض">مرفوض</option>
            </select>
          </div>
        </div>
      )}

      {/* Notes */}
      {selectedFile && (
        <div>
          <Label className="mb-1 block text-sm">ملاحظات</Label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="clay-input w-full rounded-xl border bg-white px-3 py-2 text-sm dark:bg-background"
            placeholder="ملاحظات حول هذا المستند..."
          />
        </div>
      )}

      {/* Error */}
      {uploadError && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-700 dark:bg-red-950/30 dark:text-red-300">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {uploadError}
        </div>
      )}

      {/* Upload Button */}
      {selectedFile && (
        <Button
          onClick={handleUpload}
          disabled={uploading || loading}
          className="gap-2 clay-button"
        >
          {uploading || loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Upload className="h-4 w-4" />
          )}
          رفع المستند
        </Button>
      )}
    </div>
  );
}
