import { useState, useEffect, useCallback } from "react";
import {
  Gavel,
  FolderOpen,
  Users,
  AlertTriangle,
  Loader2,
  Shield,
  Calendar,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { supabase } from "@/lib/supabase";
import { useUpcomingHearings } from "@/hooks/useSupabaseData";
import { cn } from "@/lib/utils";

interface DashboardStats {
  total_cases: number;
  active_cases: number;
  total_clients: number;
  urgent_deadlines: number;
  total_bail_unpaid: number;
  nearest_prescription_date: string | null;
  nearest_prescription_case: string | null;
}

const monthlyData = [
  { name: "يناير", القضايا: 4, المنتهية: 1 },
  { name: "فبراير", القضايا: 6, المنتهية: 2 },
  { name: "مارس", القضايا: 3, المنتهية: 1 },
  { name: "أبريل", القضايا: 5, المنتهية: 3 },
  { name: "مايو", القضايا: 7, المنتهية: 2 },
  { name: "يونيو", القضايا: 4, المنتهية: 1 },
];



export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const { data: hearings, loading: hearingsLoading } = useUpcomingHearings();

  const fetchStats = useCallback(async () => {
    const { data, error } = await supabase.rpc("get_dashboard_stats");
    if (!error && data && data.length > 0) {
      setStats(data[0] as DashboardStats);
    }
    setStatsLoading(false);
  }, []);

  // Initial fetch + auto-refresh every 60 seconds
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    fetchStats();
    const interval = setInterval(fetchStats, 60_000);
    return () => clearInterval(interval);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [fetchStats]);

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
      value: stats?.active_cases ?? 0,
      icon: FolderOpen,
      color: "bg-clay-blue/15 text-clay-blue",
      sub: `${stats?.total_cases ?? 0} إجمالي`,
    },
    {
      label: "إجمالي العملاء",
      value: stats?.total_clients ?? 0,
      icon: Users,
      color: "bg-clay-teal/15 text-clay-teal",
      sub: "مسجل",
    },
    {
      label: "مواعيد حرجة",
      value: stats?.urgent_deadlines ?? 0,
      icon: AlertTriangle,
      color: "bg-urgency-critical/10 text-urgency-critical",
      sub: "خلال 3 أيام",
    },
    {
      label: "الكفالة غير المسددة",
      value: stats?.total_bail_unpaid ? `${Math.abs(Number(stats.total_bail_unpaid)).toLocaleString()}` : "0",
      suffix: "ج.م",
      icon: Shield,
      color: "bg-urgency-high/10 text-urgency-high",
      sub: "إجمالي",
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">لوحة التحكم</h1>
        <p className="text-sm text-muted-foreground mt-1">
          نظرة عامة على حال القضايا والمواعيد — تحديث تلقائي كل 60 ثانية
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
                <span className="text-[10px] text-muted-foreground">{kpi.sub}</span>
              </div>
              <p className="text-3xl font-bold text-foreground">
                {kpi.value}
                {kpi.suffix && <span className="text-lg ms-1">{kpi.suffix}</span>}
              </p>
              <p className="text-sm text-muted-foreground mt-1">{kpi.label}</p>
            </div>
          );
        })}
      </div>

      {/* Prescription Warning */}
      {stats?.nearest_prescription_date && (
        <div className="clay-card p-4 border-2 border-urgency-critical/20">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-urgency-critical shrink-0" />
            <div>
              <p className="text-sm font-semibold text-urgency-critical">
                ⚠️ أقرب موعد تقادم: {stats.nearest_prescription_date}
              </p>
              <p className="text-xs text-muted-foreground">
                القضية: {stats.nearest_prescription_case} — يجب اتخاذ إجراء قبل انتهاء المدة
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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

        {/* Upcoming hearings */}
        <div className="clay-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold text-foreground">الجلسات القادمة</h3>
            <a href="/app/calendar" className="text-xs text-clay-blue hover:underline">
              عرض الكل
            </a>
          </div>
          <div className="space-y-3">
            {(hearings ?? []).slice(0, 5).map((h) => (
              <div key={h.id} className="clay-card-soft p-3 flex items-start gap-3">
                <div className="p-2 rounded-xl bg-clay-blue/10 shrink-0">
                  <Gavel className="w-4 h-4 text-clay-blue" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">
                    {h.case?.case_code ?? "—"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {h.case?.client?.full_name ?? "—"}
                  </p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <Calendar className="w-3 h-3 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">{h.session_date}</span>
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
      </div>
    </div>
  );
}
