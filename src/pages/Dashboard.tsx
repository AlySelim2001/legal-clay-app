import {
  Gavel,
  FolderOpen,
  Users,
  AlertTriangle,
  Clock,
  CheckCircle,
  Loader2,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { useDashboardStats, useUpcomingHearings } from "@/hooks/useSupabaseData";
import { cn } from "@/lib/utils";

const urgencyBg: Record<string, string> = {
  critical: "bg-urgency-critical/10 border-urgency-critical/20",
  high: "bg-urgency-high/10 border-urgency-high/20",
  normal: "bg-urgency-normal/10 border-urgency-normal/20",
};

const monthlyData = [
  { name: "يناير", القضايا: 4, المنتهية: 1 },
  { name: "فبراير", القضايا: 6, المنتهية: 2 },
  { name: "مارس", القضايا: 3, المنتهية: 1 },
  { name: "أبريل", القضايا: 5, المنتهية: 3 },
  { name: "مايو", القضايا: 7, المنتهية: 2 },
  { name: "يونيو", القضايا: 4, المنتهية: 1 },
];

const typeData = [
  { name: "اختلاس", value: 25, color: "#6B8FB5" },
  { name: "تزوير", value: 30, color: "#7FC4AD" },
  { name: "سرقة", value: 20, color: "#9B7FC4" },
  { name: "مخدرات", value: 15, color: "#C49B7F" },
  { name: "أخرى", value: 10, color: "#C47F9B" },
];

function getUrgencyForDueDate(dueDate: string): "critical" | "high" | "normal" {
  const now = new Date();
  const due = new Date(dueDate);
  const diffDays = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays <= 3) return "critical";
  if (diffDays <= 7) return "high";
  return "normal";
}

function daysUntil(dateStr: string): number {
  const now = new Date();
  const target = new Date(dateStr);
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

export default function Dashboard() {
  const { data: stats, loading: statsLoading } = useDashboardStats();
  const { data: hearings, loading: hearingsLoading } = useUpcomingHearings();

  if (statsLoading || hearingsLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const kpis = [
    {
      label: "القضايا النشطة",
      value: stats?.totalCases ?? 0,
      icon: FolderOpen,
      color: "bg-clay-blue/15 text-clay-blue",
      change: "إجمالي",
      changeUp: true,
    },
    {
      label: "إجمالي العملاء",
      value: stats?.totalClients ?? 0,
      icon: Users,
      color: "bg-clay-teal/15 text-clay-teal",
      change: "مسجل",
      changeUp: true,
    },
    {
      label: "مواعيد هذا الأسبوع",
      value: stats?.upcomingCount ?? 0,
      icon: AlertTriangle,
      color: "bg-urgency-high/10 text-urgency-high",
      change: "تحتاج متابعة",
      changeUp: false,
    },
    {
      label: "مواعيد حرجة",
      value: stats?.urgentCount ?? 0,
      icon: CheckCircle,
      color: "bg-urgency-critical/10 text-urgency-critical",
      change: "خلال 3 أيام",
      changeUp: false,
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">لوحة التحكم</h1>
        <p className="text-sm text-muted-foreground mt-1">
          نظرة عامة على حال القضايا والمواعيد
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <div
              key={kpi.label}
              className="clay-card p-5 group hover:scale-[1.01] transition-transform"
            >
              <div className="flex items-start justify-between mb-3">
                <div className={cn("p-2.5 rounded-2xl", kpi.color)}>
                  <Icon className="w-5 h-5" />
                </div>
                <span
                  className={cn(
                    "text-xs font-medium px-2 py-1 rounded-xl",
                    kpi.changeUp
                      ? "bg-urgency-normal/10 text-urgency-normal"
                      : "bg-urgency-critical/10 text-urgency-critical"
                  )}
                >
                  {kpi.changeUp ? "↑" : "↓"} {kpi.change}
                </span>
              </div>
              <p className="text-3xl font-bold text-foreground">{kpi.value}</p>
              <p className="text-sm text-muted-foreground mt-1">{kpi.label}</p>
            </div>
          );
        })}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Bar Chart */}
        <div className="lg:col-span-2 clay-card p-6">
          <h3 className="text-base font-bold text-foreground mb-4">القضايا الشهرية</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyData} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="#D4C5B5" strokeOpacity={0.5} />
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#8A7D70" }} />
                <YAxis tick={{ fontSize: 12, fill: "#8A7D70" }} />
                <Tooltip
                  contentStyle={{
                    background: "#fff",
                    border: "none",
                    borderRadius: "12px",
                    boxShadow: "4px 4px 12px rgba(0,0,0,0.08)",
                  }}
                />
                <Bar dataKey="القضايا" fill="#6B8FB5" radius={[6, 6, 0, 0]} />
                <Bar dataKey="المنتهية" fill="#7FC4AD" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Pie Chart */}
        <div className="clay-card p-6">
          <h3 className="text-base font-bold text-foreground mb-4">توزيع الجرائم</h3>
          <div className="h-64 flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={typeData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {typeData.map((entry, idx) => (
                    <Cell key={idx} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-2 gap-2 mt-2">
            {typeData.map((d) => (
              <div key={d.name} className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: d.color }} />
                {d.name}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Row: Hearings + Critical Deadlines */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upcoming Hearings */}
        <div className="clay-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold text-foreground">الجلسات القادمة</h3>
            <a href="/app/calendar" className="text-xs text-clay-blue hover:underline">
              عرض الكل
            </a>
          </div>
          <div className="space-y-3">
            {(hearings ?? []).slice(0, 4).map((h) => (
              <div
                key={h.id}
                className="clay-card-soft p-3 flex items-start gap-3"
              >
                <div className="p-2 rounded-xl bg-clay-blue/10 shrink-0">
                  <Gavel className="w-4 h-4 text-clay-blue" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">
                    {h.case?.case_code ?? "—"} — {h.case?.client?.full_name ?? "—"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {h.case?.court_name ?? "—"}
                  </p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-xs font-medium text-clay-blue">
                      📅 {h.session_date}
                    </span>
                  </div>
                </div>
                <span className="clay-badge text-[10px] font-semibold bg-clay-purple/10 text-clay-purple px-2 py-1 shrink-0">
                  {h.session_type}
                </span>
              </div>
            ))}
            {(!hearings || hearings.length === 0) && (
              <p className="text-sm text-muted-foreground text-center py-4">لا توجد جلسات قادمة</p>
            )}
          </div>
        </div>

        {/* Critical Deadlines */}
        <div className="clay-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold text-foreground">المواعيد الحرجة</h3>
            <a href="/app/deadlines" className="text-xs text-clay-blue hover:underline">
              عرض الكل
            </a>
          </div>
          <div className="space-y-3">
            {(hearings ?? [])
              .filter((h) => {
                const days = daysUntil(h.session_date);
                return days >= 0 && days <= 7;
              })
              .slice(0, 5)
              .map((h) => {
                const urgency = getUrgencyForDueDate(h.session_date);
                return (
                  <div
                    key={h.id}
                    className={cn(
                      "clay-card-soft p-3 border-2",
                      urgencyBg[urgency]
                    )}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">
                          {h.case?.case_code ?? "—"} — {h.case?.client?.full_name ?? "—"}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {h.session_type}
                        </p>
                      </div>
                      <span
                        className={cn(
                          "clay-badge text-[10px] font-bold px-2 py-1 shrink-0",
                          urgency === "critical"
                            ? "bg-urgency-critical/10 text-urgency-critical"
                            : urgency === "high"
                            ? "bg-urgency-high/10 text-urgency-high"
                            : "bg-urgency-normal/10 text-urgency-normal"
                        )}
                      >
                        {urgency === "critical"
                          ? "حرج"
                          : urgency === "high"
                          ? "مرتفع"
                          : "عادي"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <Clock className="w-3 h-3 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">
                        الموعد: {h.session_date}
                      </span>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      </div>
    </div>
  );
}
