import { useState, useCallback } from "react";
import { useNavigate, useParams } from "react-router";
import { useCase, useCreateCase, useUpdateCase, usePersons } from "@/hooks/useEnterprise";
import { CaseInsertSchema, type CaseInsert, type CaseTypeValue, type ProceduralStatusType, type ConfidenceStatusType, type LegalNoteStatusType } from "@/types/enterprise";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowRight, Loader2, Save, AlertTriangle } from "lucide-react";

const CASE_TYPES: CaseTypeValue[] = ["جنح", "جناية", "مخالفات", "إدارية", "أخرى"];
const STATUS_OPTIONS: ProceduralStatusType[] = [
  "جديدة", "قيد المحاكمة", "محدد لها جلسة", "تأجلت الجلسة",
  "صدر الحكم بالبراءة", "صدر الحكم بالإدانة", "جاري الاستئناف", "انتهت",
];
const CONFIDENCE_OPTIONS: ConfidenceStatusType[] = ["غير مؤكد", "مراجع", "معتمد"];
const LEGAL_NOTE_OPTIONS: LegalNoteStatusType[] = ["مسودة", "بانتظار المراجعة", "معتمد"];

export default function EnterpriseCaseCreateEdit() {
  const navigate = useNavigate();
  const { caseCode } = useParams<{ caseCode: string }>();
  const isEdit = Boolean(caseCode);
  const { data: existingCase, loading: loadingCase } = useCase(caseCode ?? "");
  const { data: persons } = usePersons();
  const { create, loading: creating } = useCreateCase();
  const { update, loading: updating } = useUpdateCase();

  const loading = creating || updating;

  const [form, setForm] = useState<CaseInsert>({
    case_code: existingCase?.case_code ?? `CASE-${Date.now()}`,
    case_number: existingCase?.case_number ?? "",
    case_year: existingCase?.case_year ?? new Date().getFullYear(),
    case_type: existingCase?.case_type ?? "جنح",
    court_name: existingCase?.court_name ?? "",
    police_station_or_prosecution: existingCase?.police_station_or_prosecution ?? "",
    jurisdiction: existingCase?.jurisdiction ?? "",
    person_id: existingCase?.person_id ?? "",
    linked_case_group_id: existingCase?.linked_case_group_id ?? null,
    procedural_status: existingCase?.procedural_status ?? "جديدة",
    source_document_id: existingCase?.source_document_id ?? null,
    confidence_status: existingCase?.confidence_status ?? "غير مؤكد",
    legal_note_status: existingCase?.legal_note_status ?? "مسودة",
    next_action: existingCase?.next_action ?? "",
    next_action_due_at: existingCase?.next_action_due_at ?? null,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const setField = useCallback(
    <K extends keyof CaseInsert>(key: K, value: CaseInsert[K]) => {
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
    const parsed = CaseInsertSchema.safeParse(form);
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
    if (isEdit && existingCase) {
      result = await update(existingCase.id, parsed.data);
    } else {
      result = await create(parsed.data);
    }

    if (result) {
      navigate(`/app/cases/${result.case_code}`);
    }
  };

  if (isEdit && loadingCase) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4 animate-fade-in" dir="rtl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <button onClick={() => navigate("/app/cases")} className="hover:text-primary">
          القضايا
        </button>
        <span>/</span>
        <span className="font-medium text-foreground">
          {isEdit ? "تعديل القضية" : "قضية جديدة"}
        </span>
      </div>

      <h1 className="text-2xl font-bold text-primary">
        {isEdit ? "تعديل بيانات القضية" : "إنشاء قضية جديدة"}
      </h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Case Number & Year */}
        <Card className="clay-card">
          <CardHeader>
            <CardTitle className="text-base">رقم القضية</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <Field label="رقم القضية" error={errors.case_number}>
              <Input
                value={form.case_number}
                onChange={(e) => setField("case_number", e.target.value)}
                placeholder="مثال: 12345"
                className="clay-input"
              />
            </Field>
            <Field label="السنة" error={errors.case_year}>
              <Input
                type="number"
                value={form.case_year}
                onChange={(e) => setField("case_year", parseInt(e.target.value) || new Date().getFullYear())}
                min={1950}
                max={2100}
                className="clay-input"
              />
            </Field>
          </CardContent>
        </Card>

        {/* Case Info */}
        <Card className="clay-card">
          <CardHeader>
            <CardTitle className="text-base">بيانات القضية</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Field label="نوع القضية" error={errors.case_type}>
              <select
                value={form.case_type}
                onChange={(e) => setField("case_type", e.target.value as CaseTypeValue)}
                className="clay-input w-full rounded-xl border bg-white px-3 py-2 text-sm dark:bg-background"
              >
                {CASE_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </Field>
            <Field label="المحكمة" error={errors.court_name}>
              <Input
                value={form.court_name}
                onChange={(e) => setField("court_name", e.target.value)}
                placeholder="محكمة شمال شبرا الخيمة الابتدائية"
                className="clay-input"
              />
            </Field>
            <Field label="النيابة / قسم الشرطة" error={errors.police_station_or_prosecution}>
              <Input
                value={form.police_station_or_prosecution ?? ""}
                onChange={(e) => setField("police_station_or_prosecution", e.target.value)}
                placeholder="نيابة قسم شبرا"
                className="clay-input"
              />
            </Field>
            <Field label="الاختصاص" error={errors.jurisdiction}>
              <Input
                value={form.jurisdiction ?? ""}
                onChange={(e) => setField("jurisdiction", e.target.value)}
                placeholder="جنح"
                className="clay-input"
              />
            </Field>
          </CardContent>
        </Card>

        {/* Person Link */}
        <Card className="clay-card">
          <CardHeader>
            <CardTitle className="text-base">الشخص المرتبط</CardTitle>
          </CardHeader>
          <CardContent>
            <Field label="اختر الشخص" error={errors.person_id}>
              <select
                value={form.person_id}
                onChange={(e) => setField("person_id", e.target.value)}
                className="clay-input w-full rounded-xl border bg-white px-3 py-2 text-sm dark:bg-background"
              >
                <option value="">— اختر شخص —</option>
                {(persons ?? []).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.legal_full_name} ({p.person_code})
                  </option>
                ))}
              </select>
            </Field>
          </CardContent>
        </Card>

        {/* Status & Classification */}
        <Card className="clay-card">
          <CardHeader>
            <CardTitle className="text-base">الحالة والتصنيف</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <Field label="الحالة الإجرائية" error={errors.procedural_status}>
              <select
                value={form.procedural_status}
                onChange={(e) => setField("procedural_status", e.target.value as ProceduralStatusType)}
                className="clay-input w-full rounded-xl border bg-white px-3 py-2 text-sm dark:bg-background"
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </Field>
            <Field label="حالة التأكيد" error={errors.confidence_status}>
              <select
                value={form.confidence_status}
                onChange={(e) => setField("confidence_status", e.target.value as ConfidenceStatusType)}
                className="clay-input w-full rounded-xl border bg-white px-3 py-2 text-sm dark:bg-background"
              >
                {CONFIDENCE_OPTIONS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </Field>
            <Field label="حالة الملاحظات القانونية" error={errors.legal_note_status}>
              <select
                value={form.legal_note_status}
                onChange={(e) => setField("legal_note_status", e.target.value as LegalNoteStatusType)}
                className="clay-input w-full rounded-xl border bg-white px-3 py-2 text-sm dark:bg-background"
              >
                {LEGAL_NOTE_OPTIONS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </Field>
            <Field label="الإجراء التالي" error={errors.next_action}>
              <Input
                value={form.next_action ?? ""}
                onChange={(e) => setField("next_action", e.target.value)}
                placeholder="typing next action..."
                className="clay-input"
              />
            </Field>
            <Field label="موعد الإجراء التالي" error={errors.next_action_due_at}>
              <Input
                type="date"
                value={form.next_action_due_at ? form.next_action_due_at.split("T")[0] : ""}
                onChange={(e) => setField("next_action_due_at", e.target.value ? e.target.value + "T00:00:00Z" : null)}
                className="clay-input"
              />
            </Field>
          </CardContent>
        </Card>

        {/* Legal Disclaimer */}
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-center text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
          ⚠️ جميع البيانات والإجراءات مقترحة — يجب التحقق منها مع المحامي المختص قبل اتخاذ أي إجراء قانوني.
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={loading} className="gap-2 clay-button">
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {isEdit ? "حفظ التعديلات" : "إنشاء القضية"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate(-1)}
            className="gap-2"
          >
            <ArrowRight className="h-4 w-4" />
            إلغاء
          </Button>
        </div>
      </form>
    </div>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <Label className="mb-1 block text-sm">{label}</Label>
      {children}
      {error && (
        <p className="mt-1 flex items-center gap-1 text-xs text-red-600">
          <AlertTriangle className="h-3 w-3" />
          {error}
        </p>
      )}
    </div>
  );
}
