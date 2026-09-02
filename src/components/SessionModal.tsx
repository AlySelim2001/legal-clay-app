import { useState, useCallback } from "react";
import { useCreateSession, useUpdateSession, useCases } from "@/hooks/useEnterprise";
import { audit } from "@/lib/enterprise/audit";
import { SessionInsertSchema, type SessionInsert, type SessionTypeValue, type AttendanceStatusType } from "@/types/enterprise";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Save, AlertTriangle } from "lucide-react";

const SESSION_TYPES: SessionTypeValue[] = ["نظر القضية", "إعلان الحكم", "جراحة", "استئناف", "معارضة", "أخرى"];
const ATTENDANCE_OPTIONS: AttendanceStatusType[] = ["حاضر", "غائب", "يحدد لاحقاً"];

interface SessionModalProps {
  open: boolean;
  onClose: () => void;
  caseId?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  existingSession?: any;
}

export function SessionModal({ open, onClose, caseId, existingSession }: SessionModalProps) {
  const isEdit = Boolean(existingSession);
  const { data: cases } = useCases();
  const { create, loading: creating } = useCreateSession();
  const { update, loading: updating } = useUpdateSession();
  const loading = creating || updating;

  const [form, setForm] = useState<SessionInsert>(() => ({
    case_id: existingSession?.case_id ?? caseId ?? "",
    session_date_time: existingSession?.session_date_time ?? "",
    session_type: existingSession?.session_type ?? "نظر القضية",
    courtroom_optional: existingSession?.courtroom_optional ?? "",
    required_action: existingSession?.required_action ?? "",
    reminder_enabled: existingSession?.reminder_enabled ?? true,
    attendance_status: existingSession?.attendance_status ?? "يحدد لاحقاً",
    outcome_note: existingSession?.outcome_note ?? "",
    source_document_id: existingSession?.source_document_id ?? null,
  }));

  const [errors, setErrors] = useState<Record<string, string>>({});

  const setField = useCallback(
    <K extends keyof SessionInsert>(key: K, value: SessionInsert[K]) => {
      setForm((prev) => ({ ...prev, [key]: value }));
      setErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    },
    [],
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = SessionInsertSchema.safeParse(form);
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      parsed.error.issues.forEach((issue) => {
        const field = issue.path[0] as string;
        fieldErrors[field] = issue.message;
      });
      setErrors(fieldErrors);
      return;
    }

    let result;
    if (isEdit) {
      result = await update(existingSession.id, parsed.data);
      if (result) audit.sessionUpdated(result.id);
    } else {
      result = await create(parsed.data);
      if (result) audit.sessionCreated(result.id);
    }

    if (result) {
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-primary">
            {isEdit ? "تعديل الجلسة" : "إضافة جلسة جديدة"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Case Selection */}
          {!caseId && (
            <div>
              <Label className="mb-1 block text-sm">القضية</Label>
              <select
                value={form.case_id}
                onChange={(e) => setField("case_id", e.target.value)}
                className="clay-input w-full rounded-xl border bg-white px-3 py-2 text-sm dark:bg-background"
              >
                <option value="">— اختر القضية —</option>
                {(cases ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    قضية {c.case_number}/{c.case_year} — {c.court_name}
                  </option>
                ))}
              </select>
              {errors.case_id && (
                <p className="mt-1 flex items-center gap-1 text-xs text-red-600">
                  <AlertTriangle className="h-3 w-3" />{errors.case_id}
                </p>
              )}
            </div>
          )}

          {/* Session Date & Time */}
          <div>
            <Label className="mb-1 block text-sm">موعد الجلسة</Label>
            <Input
              type="datetime-local"
              value={form.session_date_time ? form.session_date_time.slice(0, 16) : ""}
              onChange={(e) => setField("session_date_time", e.target.value ? new Date(e.target.value).toISOString() : "")}
              className="clay-input"
              dir="ltr"
            />
            {errors.session_date_time && (
              <p className="mt-1 flex items-center gap-1 text-xs text-red-600">
                <AlertTriangle className="h-3 w-3" />{errors.session_date_time}
              </p>
            )}
          </div>

          {/* Session Type */}
          <div>
            <Label className="mb-1 block text-sm">نوع الجلسة</Label>
            <select
              value={form.session_type}
              onChange={(e) => setField("session_type", e.target.value as SessionTypeValue)}
              className="clay-input w-full rounded-xl border bg-white px-3 py-2 text-sm dark:bg-background"
            >
              {SESSION_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          {/* Courtroom */}
          <div>
            <Label className="mb-1 block text-sm">قاعة المحكمة (اختياري)</Label>
            <Input
              value={form.courtroom_optional ?? ""}
              onChange={(e) => setField("courtroom_optional", e.target.value)}
              placeholder="الغرفة 3 — الدائرة الجنائية"
              className="clay-input"
            />
          </div>

          {/* Required Action */}
          <div>
            <Label className="mb-1 block text-sm">الإجراء المطلوب</Label>
            <Input
              value={form.required_action ?? ""}
              onChange={(e) => setField("required_action", e.target.value)}
              placeholder="الإجراء المطلوب بعد الجلسة..."
              className="clay-input"
            />
          </div>

          {/* Attendance Status */}
          <div>
            <Label className="mb-1 block text-sm">حالة الحضور</Label>
            <select
              value={form.attendance_status}
              onChange={(e) => setField("attendance_status", e.target.value as AttendanceStatusType)}
              className="clay-input w-full rounded-xl border bg-white px-3 py-2 text-sm dark:bg-background"
            >
              {ATTENDANCE_OPTIONS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          {/* Reminder Toggle */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={form.reminder_enabled}
              onChange={(e) => setField("reminder_enabled", e.target.checked)}
              className="h-4 w-4 rounded"
            />
            <Label className="text-sm">تفعيل التذكير</Label>
          </div>

          {/* Outcome Note */}
          <div>
            <Label className="mb-1 block text-sm">ملاحظات النتيجة</Label>
            <textarea
              value={form.outcome_note ?? ""}
              onChange={(e) => setField("outcome_note", e.target.value)}
              rows={2}
              className="clay-input w-full rounded-xl border bg-white px-3 py-2 text-sm dark:bg-background"
              placeholder="ملاحظات على نتيجة الجلسة..."
            />
          </div>

          <DialogFooter className="gap-2">
            <Button type="submit" disabled={loading} className="gap-2 clay-button">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {isEdit ? "حفظ" : "إضافة"}
            </Button>
            <Button type="button" variant="outline" onClick={onClose}>
              إلغاء
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
