import { useState, useRef, useCallback } from 'react';
import { Upload, X, FileText, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import type { DocumentType } from '@/types/database';

interface FileUploadProps {
  caseId: string;
  onUploadComplete?: () => void;
}

interface PendingFile {
  file: File;
  documentType: DocumentType;
  status: 'pending' | 'uploading' | 'done' | 'error';
  error?: string;
}

const DOCUMENT_TYPES: DocumentType[] = [
  'صورة محضر الجلسة',
  'صورة حكم أول درجة',
  'صورة استمارة/إيصال الكفالة',
  'توكيل رسمي عام',
  'حافظة مستندات ومذكرة دفاع',
  'صورة حكم البراءة السابق',
  'أخرى',
];

export function FileUpload({ caseId, onUploadComplete }: FileUploadProps) {
  const [files, setFiles] = useState<PendingFile[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback((newFiles: FileList | File[]) => {
    const pending: PendingFile[] = Array.from(newFiles).map((file) => ({
      file,
      documentType: 'أخرى' as DocumentType,
      status: 'pending' as const,
    }));
    setFiles((prev) => [...prev, ...pending]);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      addFiles(e.dataTransfer.files);
    }
  }, [addFiles]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOver(false);
  }, []);

  const updateFileType = (index: number, type: DocumentType) => {
    setFiles((prev) => prev.map((f, i) => i === index ? { ...f, documentType: type } : f));
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const uploadAll = async () => {
    const pending = files.filter((f) => f.status === 'pending');
    if (pending.length === 0) return;

    for (let i = 0; i < pending.length; i++) {
      const pf = pending[i];
      const idx = files.indexOf(pf);

      setFiles((prev) => prev.map((f, fi) => fi === idx ? { ...f, status: 'uploading' } : f));

      try {
        const ext = pf.file.name.split('.').pop() ?? 'bin';
        const path = `${caseId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from('case-attachments')
          .upload(path, pf.file, { contentType: pf.file.type });

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from('case-attachments')
          .getPublicUrl(path);

        // Insert attachment record
        const { error: insertError } = await supabase
          .from('attachments')
          .insert({
            case_id: caseId,
            document_type: pf.documentType,
            storage_path: path,
            notes: pf.file.name,
          });

        if (insertError) throw insertError;

        setFiles((prev) => prev.map((f, fi) => fi === idx ? { ...f, status: 'done' } : f));
        void urlData; // used for signed URL access
      } catch (err) {
        setFiles((prev) => prev.map((f, fi) => fi === idx
          ? { ...f, status: 'error', error: err instanceof Error ? err.message : 'Upload failed' }
          : f));
      }
    }

    onUploadComplete?.();
    // Clear completed files after a short delay
    setTimeout(() => {
      setFiles((prev) => prev.filter((f) => f.status !== 'done'));
    }, 2000);
  };

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => fileInputRef.current?.click()}
        className={cn(
          "border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all",
          dragOver
            ? "border-clay-blue bg-clay-blue/5 scale-[1.01]"
            : "border-border hover:border-clay-blue/50 hover:bg-muted/30"
        )}
      >
        <Upload className={cn("w-8 h-8 mx-auto mb-3", dragOver ? "text-clay-blue" : "text-muted-foreground/40")} />
        <p className="text-sm font-medium text-foreground mb-1">
          اسحب الملفات هنا أو انقر للاختيار
        </p>
        <p className="text-xs text-muted-foreground">
          PDF، صور، Word — حد أقصى 20 ميجابايت
        </p>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.txt"
          className="hidden"
          onChange={(e) => e.target.files && addFiles(e.target.files)}
        />
      </div>

      {/* File list */}
      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((pf, idx) => (
            <div
              key={`${pf.file.name}-${idx}`}
              className="clay-card-soft p-3 flex items-center gap-3"
            >
              <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{pf.file.name}</p>
                <p className="text-[10px] text-muted-foreground">
                  {(pf.file.size / 1024 / 1024).toFixed(1)} MB
                </p>
              </div>
              <select
                value={pf.documentType}
                onChange={(e) => updateFileType(idx, e.target.value as DocumentType)}
                disabled={pf.status !== 'pending'}
                className="clay-input text-[10px] px-2 py-1 bg-background max-w-[140px]"
              >
                {DOCUMENT_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
              {pf.status === 'uploading' && <Loader2 className="w-4 h-4 animate-spin text-clay-blue shrink-0" />}
              {pf.status === 'done' && <span className="text-xs text-urgency-normal">✓</span>}
              {pf.status === 'error' && <span className="text-xs text-urgency-critical">✗</span>}
              {pf.status === 'pending' && (
                <button onClick={() => removeFile(idx)} className="p-1 rounded-lg hover:bg-muted transition-colors">
                  <X className="w-3.5 h-3.5 text-muted-foreground" />
                </button>
              )}
            </div>
          ))}

          <button
            onClick={uploadAll}
            disabled={files.every((f) => f.status !== 'pending')}
            className="clay-button w-full py-2.5 bg-primary text-primary-foreground text-sm font-semibold rounded-xl disabled:opacity-50"
          >
            رفع {files.filter((f) => f.status === 'pending').length} ملف(ات)
          </button>
        </div>
      )}
    </div>
  );
}
