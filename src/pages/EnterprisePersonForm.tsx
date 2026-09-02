import { useState, useCallback, useEffect } from "react";
import { useNavigate, useParams } from "react-router";
import { usePerson, useCreatePerson, useUpdatePerson } from "@/hooks/useEnterprise";
import { PersonInsertSchema, type PersonInsert } from "@/types/enterprise";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowRight, Loader2, Save, AlertTriangle, Shield } from "lucide-react";

export default function EnterprisePersonForm() {
  const navigate = useNavigate();
  const { personCode } = useParams<{ personCode: string }>();
  const isEdit = Boolean(personCode);
  const { data: existingPerson, loading: loadingPerson } = usePerson(personCode ?? "");
  const { create, loading: creating } = useCreatePerson();
  const { update, loading: updating } = useUpdatePerson();
  const loading = creating || updating;

  const [form, setForm] = useState<PersonInsert>({
    person_code: "",
    legal_full_name: "",
    name_as_recorded: "",
    national_id_encrypted: "",
    phone_optional: "",
    email: "",
    notes: "",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Populate form for edit mode
  useEffect(() => {
    if (existingPerson) {
      setForm({
        person_code: existingPerson.person_code,
        legal_full_name: existingPerson.legal_full_name,
        name_as_recorded: existingPerson.name_as_recorded ?? "",
        national_id_encrypted: existingPerson.national_id_encrypted ?? "",
        phone_optional: existingPerson.phone_optional ?? "",
        email: existingPerson.email ?? "",
        notes: existingPerson.notes ?? "",
      });
    }
  }, [existingPerson]);

  const setField = useCallback(
    <K extends keyof PersonInsert>(key: K, value: PersonInsert[K]) => {
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
    const parsed = PersonInsertSchema.safeParse(form);
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
    if (isEdit && existingPerson) {
      result = await update(existingPerson.id, parsed.data);
    } else {
      result = await create(parsed.data);
    }

    if (result) {
      navigate(`/app/persons/${result.person_code}`);
    }
  };

  if (isEdit && loadingPerson) {
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
        <button onClick={() => navigate("/app/persons")} className="hover:text-primary">
          الأشخاص
        </button>
        <span>/</span>
        <span className="font-medium text-foreground">
          {isEdit ? "تعديل بيانات الشخص" : "شخص جديد"}
        </span>
      </div>

      <h1 className="text-2xl font-bold text-primary">
        {isEdit ? "تعديل بيانات الشخص" : "إضافة شخص جديد"}
      </h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Person Code & Name */}
        <Card className="clay-card">
          <CardHeader>
            <CardTitle className="text-base">بيانات الهوية</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <Field label="كود الشخص" error={errors.person_code}>
              <Input
                value={form.person_code}
                onChange={(e) => setField("person_code", e.target.value)}
                placeholder="مثال: عم-001"
                className="clay-input"
                disabled={isEdit}
              />
            </Field>
            <Field label="الاسم القانوني الكامل" error={errors.legal_full_name}>
              <Input
                value={form.legal_full_name}
                onChange={(e) => setField("legal_full_name", e.target.value)}
                placeholder="الاسم كما في السجل"
                className="clay-input"
              />
            </Field>
          </CardContent>
        </Card>

        {/* Additional Info */}
        <Card className="clay-card">
          <CardHeader>
            <CardTitle className="text-base">بيانات إضافية</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <Field label="الاسم كما في السجل (اختياري)" error={errors.name_as_recorded}>
              <Input
                value={form.name_as_recorded ?? ""}
                onChange={(e) => setField("name_as_recorded", e.target.value)}
                placeholder="الاسم كما في السجل"
                className="clay-input"
              />
            </Field>
            <Field label="الرقم القومي (اختياري)" error={errors.national_id_encrypted}>
              <Input
                value={form.national_id_encrypted ?? ""}
                onChange={(e) => setField("national_id_encrypted", e.target.value)}
                placeholder="14 رقمًا"
                maxLength={14}
                dir="ltr"
                className="clay-input"
              />
            </Field>
          </CardContent>
        </Card>

        {/* Contact */}
        <Card className="clay-card">
          <CardHeader>
            <CardTitle className="text-base">بيانات الاتصال</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <Field label="رقم الهاتف (اختياري)" error={errors.phone_optional}>
              <Input
                value={form.phone_optional ?? ""}
                onChange={(e) => setField("phone_optional", e.target.value)}
                placeholder="01XXXXXXXXX"
                dir="ltr"
                className="clay-input"
              />
            </Field>
            <Field label="البريد الإلكتروني (اختياري)" error={errors.email}>
              <Input
                type="email"
                value={form.email ?? ""}
                onChange={(e) => setField("email", e.target.value)}
                placeholder="email@example.com"
                dir="ltr"
                className="clay-input"
              />
            </Field>
          </CardContent>
        </Card>

        {/* Notes */}
        <Card className="clay-card">
          <CardHeader>
            <CardTitle className="text-base">ملاحظات</CardTitle>
          </CardHeader>
          <CardContent>
            <textarea
              value={form.notes ?? ""}
              onChange={(e) => setField("notes", e.target.value)}
              rows={3}
              placeholder="ملاحظات إضافية..."
              className="clay-input w-full rounded-xl border bg-white px-3 py-2 text-sm dark:bg-background"
            />
          </CardContent>
        </Card>

        {/* Security Notice */}
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-center text-xs text-blue-800 dark:bg-blue-950/30 dark:text-blue-300">
          <Shield className="mx-auto mb-1 h-4 w-4" />
          سيتم تشفير الرقم القومي تلقائيًا — لا يظهر في الواجهة إلا آخر 4 أرقام
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={loading} className="gap-2 clay-button">
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {isEdit ? "حفظ التعديلات" : "إنشاء الشخص"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate("/app/persons")}
          >
            إلغاء
          </Button>
        </div>

        {/* Error display */}
        {Object.keys(errors).length > 0 && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:bg-red-950/30 dark:text-red-300">
            <AlertTriangle className="mx-auto mb-1 h-4 w-4" />
            يرجى تصحيح الأخطاء التالية قبل الحفظ
          </div>
        )}
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
