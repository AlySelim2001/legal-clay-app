import { useState, useMemo } from "react";
import { useParams, Link } from "react-router";
import { usePerson, useActions } from "@/hooks/useEnterprise";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowRight,
  Loader2,
  Briefcase,
  Clock,
  FileText,
  Phone,
  Mail,
  Shield,
  AlertTriangle,
  User,
} from "lucide-react";

export default function EnterprisePersonDetail() {
  const { personCode } = useParams<{ personCode: string }>();
  const { data: person, loading, error } = usePerson(personCode ?? "");
  const { data: allActions } = useActions();
  const [activeTab, setActiveTab] = useState("info");

  const personActions = useMemo(() => {
    if (!allActions || !person?.cases) return [];
    const caseIds = new Set(person.cases.map((c) => c.id));
    return allActions.filter((a) => caseIds.has(a.case_id));
  }, [allActions, person?.cases]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !person) {
    return (
      <Card className="clay-card">
        <CardContent className="p-8 text-center">
          <AlertTriangle className="mx-auto mb-3 h-10 w-10 text-urgency-critical" />
          <p className="text-sm font-medium">
            {error ?? "لم يتم العثور على الشخص"}
          </p>
          <Link to="/app/persons" className="mt-4 inline-block">
            <Button variant="outline" size="sm" className="gap-2">
              <ArrowRight className="h-4 w-4" />
              العودة للأشخاص
            </Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4 animate-fade-in" dir="rtl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Link to="/app/persons" className="hover:text-primary">
          الأشخاص
        </Link>
        <span>/</span>
        <span className="font-medium text-foreground">
          {person.legal_full_name}
        </span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <User className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-primary">
              {person.legal_full_name}
            </h1>
            <p className="text-sm text-muted-foreground">
              كود: {person.person_code}
            </p>
          </div>
        </div>
        <Link to="/app/persons">
          <Button variant="outline" size="sm" className="gap-2">
            <ArrowRight className="h-4 w-4" />
            رجوع
          </Button>
        </Link>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="info" className="gap-1">
            <User className="h-3 w-3" />
            البيانات الشخصية
          </TabsTrigger>
          <TabsTrigger value="cases" className="gap-1">
            <Briefcase className="h-3 w-3" />
            القضايا ({person.cases?.length ?? 0})
          </TabsTrigger>
          <TabsTrigger value="actions" className="gap-1">
            <Clock className="h-3 w-3" />
            الإجراءات ({personActions.length})
          </TabsTrigger>
          <TabsTrigger value="timeline" className="gap-1">
            <FileText className="h-3 w-3" />
            الجدول الزمني
          </TabsTrigger>
        </TabsList>

        {/* Personal Info Tab */}
        <TabsContent value="info" className="space-y-4">
          <Card className="clay-card">
            <CardHeader>
              <CardTitle className="text-base">بيانات الاتصال</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              <InfoRow label="الاسم القانوني" value={person.legal_full_name} />
              {person.name_as_recorded && (
                <InfoRow label="الاسم كما في السجل" value={person.name_as_recorded} />
              )}
              <InfoRow
                label="الرقم القومي (آخر 4 أرقام)"
                value={
                  person.national_id_display
                    ? `****${person.national_id_display}`
                    : "—"
                }
              />
              <InfoRow
                label="رقم الهاتف"
                value={person.phone_optional ?? "—"}
                icon={Phone}
              />
              <InfoRow
                label="البريد الإلكتروني"
                value={person.email ?? "—"}
                icon={Mail}
              />
              <InfoRow
                label="تاريخ الإنشاء"
                value={new Date(person.created_at).toLocaleDateString("ar-EG")}
              />
              <InfoRow
                label="آخر تعديل"
                value={new Date(person.updated_at).toLocaleDateString("ar-EG")}
              />
            </CardContent>
          </Card>

          {person.notes && (
            <Card className="clay-card">
              <CardHeader>
                <CardTitle className="text-base">ملاحظات</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{person.notes}</p>
              </CardContent>
            </Card>
          )}

          {/* Security notice */}
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-center text-xs text-blue-800 dark:bg-blue-950/30 dark:text-blue-300">
            <Shield className="mx-auto mb-1 h-4 w-4" />
            البيانات الحساسة محمية — الرقم القومي معروض بآخر 4 أرقام فقط
          </div>
        </TabsContent>

        {/* Cases Tab */}
        <TabsContent value="cases" className="space-y-4">
          {!person.cases || person.cases.length === 0 ? (
            <Card className="clay-card">
              <CardContent className="flex flex-col items-center justify-center py-16">
                <Briefcase className="mb-4 h-12 w-12 text-muted-foreground/40" />
                <p className="text-sm font-medium text-muted-foreground">
                  لا توجد قضايا مسجلة لهذا الشخص
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                {person.cases.length} قضية مرتبطة
              </p>
              {person.cases.map((c) => (
                <Link
                  key={c.id}
                  to={`/app/cases/${c.case_code}`}
                  className="block no-underline"
                >
                  <Card className="clay-card transition-all duration-200 hover:shadow-md">
                    <CardContent className="flex items-center justify-between p-4">
                      <div>
                        <p className="text-sm font-bold text-primary">
                          قضية رقم {c.case_number}/{c.case_year}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {c.court_name} — {c.case_type}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className="text-xs">{c.procedural_status}</Badge>
                        <Badge
                          variant="outline"
                          className={
                            c.confidence_status === "معتمد"
                              ? "border-green-300 text-green-700"
                              : c.confidence_status === "مراجع"
                              ? "border-yellow-300 text-yellow-700"
                              : ""
                          }
                        >
                          {c.confidence_status}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Actions Tab */}
        <TabsContent value="actions" className="space-y-4">
          {personActions.length === 0 ? (
            <Card className="clay-card">
              <CardContent className="flex flex-col items-center justify-center py-16">
                <Clock className="mb-4 h-12 w-12 text-muted-foreground/40" />
                <p className="text-sm font-medium text-muted-foreground">
                  لا توجد إجراءات مرتبطة
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {personActions.map((a) => (
                <Card key={a.id} className="clay-card">
                  <CardContent className="flex items-center justify-between p-3">
                    <div>
                      <p className="text-sm font-medium">{a.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {a.action_type} — {a.proposed_or_completed}
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className={
                        a.proposed_or_completed === "مكتمل"
                          ? "border-green-300 text-green-700"
                          : "border-yellow-300 text-yellow-700"
                      }
                    >
                      {a.proposed_or_completed}
                    </Badge>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Timeline Tab */}
        <TabsContent value="timeline" className="space-y-4">
          <Card className="clay-card">
            <CardHeader>
              <CardTitle className="text-base">الجدول الزمني للنشاط</CardTitle>
            </CardHeader>
            <CardContent>
              {person.cases && person.cases.length > 0 ? (
                <div className="relative space-y-4 border-r-2 border-primary/20 pe-6">
                  {person.cases
                    .sort(
                      (a, b) =>
                        new Date(b.created_at).getTime() -
                        new Date(a.created_at).getTime(),
                    )
                    .map((c) => (
                      <div key={c.id} className="relative">
                        <div className="absolute -end-8 top-1 h-3 w-3 rounded-full border-2 border-primary bg-white" />
                        <p className="text-xs text-muted-foreground">
                          {new Date(c.created_at).toLocaleDateString("ar-EG")}
                        </p>
                        <p className="text-sm font-medium">
                          قضية {c.case_number}/{c.case_year}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {c.court_name} — {c.procedural_status}
                        </p>
                      </div>
                    ))}
                </div>
              ) : (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  لا توجد سجلات زمنية
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function InfoRow({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon?: React.ElementType;
}) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="flex items-center gap-1 text-sm font-medium">
        {Icon && <Icon className="h-3 w-3 text-muted-foreground" />}
        {value}
      </p>
    </div>
  );
}
