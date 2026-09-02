import { useState, useCallback } from "react";
import { useParams, Link } from "react-router";
import { useCase } from "@/hooks/useEnterprise";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DocumentUpload } from "@/components/DocumentUpload";
import { SessionModal } from "@/components/SessionModal";
import {
  ArrowRight,
  Loader2,
  Calendar,
  FileText,
  CheckCircle,
  Clock,
  AlertTriangle,
  Pencil,
  Plus,
} from "lucide-react";

const TABS = [
  { value: "overview", label: "ملخص", icon: Clock },
  { value: "sessions", label: "الجلسات", icon: Calendar },
  { value: "documents", label: "المستندات", icon: FileText },
  { value: "actions", label: "الإجراءات", icon: CheckCircle },
];

export default function EnterpriseCaseDetail() {
  const { caseCode } = useParams<{ caseCode: string }>();
  const { data: caseData, loading, error } = useCase(caseCode ?? "");
  const [activeTab, setActiveTab] = useState("overview");
  const [sessionModalOpen, setSessionModalOpen] = useState(false);
  const [showUpload, setShowUpload] = useState(false);

  const handleSessionCreated = useCallback(() => {
    setSessionModalOpen(false);
  }, []);

  const handleDocumentUploaded = useCallback(() => {
    setShowUpload(false);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !caseData) {
    return (
      <Card className="clay-card">
        <CardContent className="p-8 text-center">
          <AlertTriangle className="mx-auto mb-3 h-10 w-10 text-urgency-critical" />
          <p className="text-sm font-medium">
            {error ?? "لم يتم العثور على القضية"}
          </p>
          <Link to="/app/cases" className="mt-4 inline-block">
            <Button variant="outline" size="sm" className="gap-2">
              <ArrowRight className="h-4 w-4" />
              العودة للقضايا
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
        <Link to="/app/cases" className="hover:text-primary">
          القضايا
        </Link>
        <span>/</span>
        <span className="font-medium text-foreground">{caseData.case_number}</span>
      </div>

      {/* Header with Edit Button */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-primary">
            قضية رقم {caseData.case_number}/{caseData.case_year}
          </h1>
          <p className="text-sm text-muted-foreground">{caseData.court_name}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge className="text-xs">{caseData.procedural_status}</Badge>
          <Link to={`/app/cases/${caseData.case_code}/edit`}>
            <Button variant="outline" size="sm" className="gap-1">
              <Pencil className="h-3 w-3" />
              تعديل
            </Button>
          </Link>
        </div>
      </div>

      {/* Confidence & Legal Note Status */}
      <div className="flex gap-2">
        <Badge
          variant="outline"
          className={
            caseData.confidence_status === "معتمد"
              ? "border-green-300 text-green-700"
              : caseData.confidence_status === "مراجع"
              ? "border-yellow-300 text-yellow-700"
              : "border-gray-300 text-gray-600"
          }
        >
          حالة التأكيد: {caseData.confidence_status}
        </Badge>
        <Badge
          variant="outline"
          className={
            caseData.legal_note_status === "معتمد"
              ? "border-green-300 text-green-700"
              : caseData.legal_note_status === "بانتظار المراجعة"
              ? "border-yellow-300 text-yellow-700"
              : "border-gray-300 text-gray-600"
          }
        >
          حالة الملاحظات: {caseData.legal_note_status}
        </Badge>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          {TABS.map((t) => (
            <TabsTrigger key={t.value} value={t.value} className="gap-1">
              <t.icon className="h-3 w-3" />
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <Card className="clay-card">
            <CardHeader>
              <CardTitle className="text-base">بيانات القضية</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              <InfoRow label="رقم القضية" value={caseData.case_number} />
              <InfoRow label="السنة" value={String(caseData.case_year)} />
              <InfoRow label="نوع القضية" value={caseData.case_type} />
              <InfoRow label="المحكمة" value={caseData.court_name} />
              <InfoRow
                label="النيابة / القسم"
                value={caseData.police_station_or_prosecution ?? "—"}
              />
              <InfoRow label="الاختصاص" value={caseData.jurisdiction ?? "—"} />
              <InfoRow
                label="الإجراء التالي"
                value={caseData.next_action ?? "—"}
              />
              <InfoRow
                label="موعد الإجراء التالي"
                value={
                  caseData.next_action_due_at
                    ? new Date(caseData.next_action_due_at).toLocaleDateString("ar-EG")
                    : "—"
                }
              />
            </CardContent>
          </Card>

          {/* Person Card */}
          {caseData.person && (
            <Card className="clay-card">
              <CardHeader>
                <CardTitle className="text-base">الشخص المرتبط</CardTitle>
              </CardHeader>
              <CardContent>
                <Link
                  to={`/app/persons/${caseData.person.person_code}`}
                  className="text-sm font-medium text-primary hover:underline"
                >
                  {caseData.person.legal_full_name}
                </Link>
                <p className="mt-1 text-xs text-muted-foreground">
                  كود: {caseData.person.person_code}
                  {caseData.person.national_id_display &&
                    ` — آخر 4 أرقام: ****${caseData.person.national_id_display}`}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Notes */}
          {caseData.legal_note_status && (
            <Card className="clay-card">
              <CardHeader>
                <CardTitle className="text-base">ملاحظات</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  حالة الملاحظات: {caseData.legal_note_status}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  تم التعديل:{" "}
                  {new Date(caseData.updated_at).toLocaleString("ar-EG")}
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Sessions Tab */}
        <TabsContent value="sessions" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold">الجلسات</h3>
            <Button
              variant="outline"
              size="sm"
              className="gap-1"
              onClick={() => setSessionModalOpen(true)}
            >
              <Plus className="h-3 w-3" />
              إضافة جلسة
            </Button>
          </div>
          {!caseData.sessions || caseData.sessions.length === 0 ? (
            <EmptyState message="لا توجد جلسات مسجلة لهذه القضية" />
          ) : (
            <div className="space-y-2">
              {caseData.sessions.map((s) => (
                <Card key={s.id} className="clay-card">
                  <CardContent className="flex items-center justify-between p-3">
                    <div>
                      <p className="text-sm font-medium">{s.session_type}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(s.session_date_time).toLocaleString("ar-EG")}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {s.attendance_status}
                    </Badge>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Documents Tab */}
        <TabsContent value="documents" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold">المستندات</h3>
            <Button
              variant="outline"
              size="sm"
              className="gap-1"
              onClick={() => setShowUpload(!showUpload)}
            >
              <Plus className="h-3 w-3" />
              {showUpload ? "إخفاء" : "رفع مستند"}
            </Button>
          </div>

          {/* Document Upload Component */}
          {showUpload && (
            <DocumentUpload
              caseId={caseData.id}
              onUploaded={handleDocumentUploaded}
            />
          )}

          {!caseData.documents || caseData.documents.length === 0 ? (
            <EmptyState message="لا توجد مستندات مرفقة لهذه القضية" />
          ) : (
            <div className="space-y-2">
              {caseData.documents.map((d) => (
                <Card key={d.id} className="clay-card">
                  <CardContent className="flex items-center justify-between p-3">
                    <div>
                      <p className="text-sm font-medium">{d.original_file_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {d.document_type} — {(d.file_size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className={
                        d.review_status === "تمت المراجعة"
                          ? "border-green-300 text-green-700"
                          : d.review_status === "مرفوض"
                          ? "border-red-300 text-red-700"
                          : "border-yellow-300 text-yellow-700"
                      }
                    >
                      {d.review_status}
                    </Badge>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Actions Tab */}
        <TabsContent value="actions" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold">الإجراءات</h3>
            <Button variant="outline" size="sm" className="gap-1">
              <Plus className="h-3 w-3" />
              إضافة إجراء
            </Button>
          </div>
          {!caseData.actions || caseData.actions.length === 0 ? (
            <EmptyState message="لا توجد إجراءات مسجلة لهذه القضية" />
          ) : (
            <div className="space-y-2">
              {caseData.actions.map((a) => (
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
      </Tabs>

      {/* Session Modal */}
      <SessionModal
        open={sessionModalOpen}
        onClose={handleSessionCreated}
        caseId={caseData.id}
      />

      {/* Legal Disclaimer */}
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-center text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
⚠️ جميع البيانات والإجراءات مقترحة تحتاج إلى مراجعة واعتماد محامٍ مختص.
      </div>
    </div>
  );
}

// ---- Helpers ----

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{value}</p>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <Card className="clay-card">
      <CardContent className="py-10 text-center text-sm text-muted-foreground">
        {message}
      </CardContent>
    </Card>
  );
}
