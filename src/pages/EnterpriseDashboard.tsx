import { useDashboardStats, useUpcomingSessions, useOverdueActions } from "@/hooks/useEnterprise";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "react-router";
import {
  Briefcase,
  Users,
  CalendarClock,
  AlertTriangle,
  FileText,
  Clock,
  ArrowLeft,
} from "lucide-react";

// ---- KPI Card ----
function KPICard({
  title,
  value,
  icon: Icon,
  color,
  loading,
  href,
}: {
  title: string;
  value: number | string;
  icon: React.ElementType;
  color: string;
  loading: boolean;
  href?: string;
}) {
  const content = (
    <Card className="clay-card transition-all duration-200 hover:shadow-lg">
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground">{title}</p>
            {loading ? (
              <div className="mt-1 h-8 w-16 animate-pulse rounded bg-muted" />
            ) : (
              <p className={`text-2xl font-bold ${color}`}>{value}</p>
            )}
          </div>
          <div className={`rounded-2xl p-3 ${color} bg-opacity-10`}>
            <Icon className="h-6 w-6 opacity-80" />
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return href ? (
    <Link to={href} className="block no-underline">
      {content}
    </Link>
  ) : (
    content
  );
}

// ---- Main Dashboard ----
export default function EnterpriseDashboard() {
  const stats = useDashboardStats();
  const upcoming = useUpcomingSessions();
  const overdue = useOverdueActions();

  return (
    <div className="space-y-6 animate-fade-in" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-primary">لوحة التحكم</h1>
          <p className="text-sm text-muted-foreground">
            نظرة عامة على النظام — آخر تحديث:{" "}
            {stats.data
              ? new Date(stats.data.lastUpdated).toLocaleString("ar-EG")
              : "—"}
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <KPICard
          title="القضايا"
          value={stats.data?.totalCases ?? 0}
          icon={Briefcase}
          color="text-primary"
          loading={stats.loading}
          href="/app/cases"
        />
        <KPICard
          title="الأشخاص"
          value={stats.data?.totalPersons ?? 0}
          icon={Users}
          color="text-clay-teal"
          loading={stats.loading}
          href="/app/persons"
        />
        <KPICard
          title="جلسات قادمة"
          value={stats.data?.upcomingSessions ?? 0}
          icon={CalendarClock}
          color="text-clay-blue"
          loading={stats.loading}
          href="/app/calendar"
        />
        <KPICard
          title="إجراءات متأخرة"
          value={stats.data?.overdueActions ?? 0}
          icon={AlertTriangle}
          color="text-urgency-critical"
          loading={stats.loading}
          href="/app/actions"
        />
        <KPICard
          title="مستندات بانتظار المراجعة"
          value={stats.data?.unreviewedDocuments ?? 0}
          icon={FileText}
          color="text-clay-amber"
          loading={stats.loading}
          href="/app/archive"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Upcoming Sessions */}
        <Card className="clay-card">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-bold">الجلسات القادمة</CardTitle>
              <Link to="/app/calendar">
                <Button variant="ghost" size="sm" className="gap-1 text-xs">
                  <ArrowLeft className="h-3 w-3" />
                  عرض الكل
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {upcoming.loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-14 animate-pulse rounded-xl bg-muted" />
                ))}
              </div>
            ) : !upcoming.data || upcoming.data.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                لا توجد جلسات قادمة
              </p>
            ) : (
              <div className="space-y-2">
                {upcoming.data.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between rounded-xl border p-3 transition-colors hover:bg-muted/50"
                  >
                    <div className="flex items-center gap-3">
                      <Clock className="h-4 w-4 text-clay-blue" />
                      <div>
                        <p className="text-sm font-medium">{s.session_type}</p>
                        <p className="text-xs text-muted-foreground">
                          {(s as unknown as Record<string, unknown>).case != null && (
                            (s as unknown as { case: { case_code: string; case_number: string } }).case.case_number
                          )}
                        </p>
                      </div>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {new Date(s.session_date_time).toLocaleDateString("ar-EG")}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Overdue Actions */}
        <Card className="clay-card">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-bold">
                إجراءات متأخرة
              </CardTitle>
              <Link to="/app/actions">
                <Button variant="ghost" size="sm" className="gap-1 text-xs">
                  <ArrowLeft className="h-3 w-3" />
                  عرض الكل
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {overdue.loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-14 animate-pulse rounded-xl bg-muted" />
                ))}
              </div>
            ) : !overdue.data || overdue.data.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                لا توجد إجراءات متأخرة — ممتاز!
              </p>
            ) : (
              <div className="space-y-2">
                {overdue.data.map((a) => (
                  <div
                    key={a.id}
                    className="flex items-center justify-between rounded-xl border border-red-200 bg-red-50/50 p-3 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <AlertTriangle className="h-4 w-4 text-urgency-critical" />
                      <div>
                        <p className="text-sm font-medium">{a.description}</p>
                        <p className="text-xs text-muted-foreground">
                          {a.action_type}
                        </p>
                      </div>
                    </div>
                    <Badge variant="destructive" className="text-xs">
                      متأخر
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Legal Disclaimer */}
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-center text-sm text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
        ⚠️ هذا النظام أداة تنظيم ومتابعة فقط. جميع البيانات والإجراءات مقترحة تحتاج إلى مراجعة واعتماد محامٍ مختص.
      </div>
    </div>
  );
}
