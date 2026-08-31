import { useState, useMemo } from "react";
import { Link } from "react-router";
import { Search, SortAsc, SortDesc, Plus, Loader2, FileSpreadsheet } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCases, useAllClients } from "@/hooks/useSupabaseData";
import { exportCases } from "@/lib/open-source/excel-bridge";
import type { ProceduralStatus } from "@/types/database";

function getPriorityForStatus(status: ProceduralStatus | null): "حرج" | "مرتفع" | "عادي" {
  if (status === "تأجلت الجلسة" || status === "جاري تنفيذ الحكم") return "حرج";
  if (status === "محدد لها جلسة معارضة") return "مرتفع";
  return "عادي";
}

function getStatusLabel(status: ProceduralStatus | null): string {
  return status ?? "أخرى";
}

const priorityStyles: Record<string, string> = {
  "حرج": "bg-urgency-critical/10 text-urgency-critical",
  "مرتفع": "bg-urgency-high/10 text-urgency-high",
  "عادي": "bg-urgency-normal/10 text-urgency-normal",
};

const urgencyBorder: Record<string, string> = {
  "حرج": "urgency-border-critical",
  "مرتفع": "urgency-border-high",
  "عادي": "urgency-border-normal",
};

export default function Cases() {
  const { data: cases, loading, error } = useCases();
  const { data: allClients } = useAllClients();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ProceduralStatus | "الكل">("الكل");
  const [priorityFilter, setPriorityFilter] = useState<"حرج" | "مرتفع" | "عادي" | "الكل">("الكل");
  const [sortField] = useState<"filing_date" | "procedural_status">("filing_date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [view, setView] = useState<"table" | "grid">("table");

  const filtered = useMemo(() => {
    if (!cases) return [];
    const result = cases.filter((c) => {
      const clientName = c.client?.full_name ?? "";
      const matchSearch =
        search === "" ||
        c.case_code.includes(search) ||
        c.case_no.includes(search) ||
        clientName.includes(search) ||
        (c.tactical_classification ?? "").includes(search);
      const matchStatus = statusFilter === "الكل" || c.procedural_status === statusFilter;
      const priority = getPriorityForStatus(c.procedural_status);
      const matchPriority = priorityFilter === "الكل" || priority === priorityFilter;
      return matchSearch && matchStatus && matchPriority;
    });

    result.sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];
      return sortDir === "asc"
        ? String(aVal ?? "").localeCompare(String(bVal ?? ""))
        : String(bVal ?? "").localeCompare(String(aVal ?? ""));
    });

    return result;
  }, [cases, search, statusFilter, priorityFilter, sortField, sortDir]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-sm text-red-500">خطأ في تحميل البيانات: {error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">القضايا</h1>
          <p className="text-sm text-muted-foreground mt-1">
            إدارة ومتابعة جميع القضايا الجنائية
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => {
              if (cases && cases.length > 0) {
                exportCases(cases, allClients ?? []);
              }
            }}
            className="clay-button flex items-center gap-2 px-4 py-2.5 bg-clay-teal/10 text-clay-teal text-sm font-semibold rounded-xl hover:bg-clay-teal/20"
          >
            <FileSpreadsheet className="w-4 h-4" />
            تصدير Excel
          </button>
          <button className="clay-button flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground text-sm font-semibold rounded-xl">
            <Plus className="w-4 h-4" />
            قضية جديدة
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="clay-card p-4">
        <div className="flex flex-col md:flex-row gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute end-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="بحث بالكود، الاسم، أو التصنيف..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="clay-input w-full pe-10 ps-4 py-2.5 text-sm bg-background"
            />
          </div>

          {/* Status filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as ProceduralStatus | "الكل")}
            className="clay-input px-4 py-2.5 text-sm bg-background min-w-[140px]"
          >
            <option value="الكل">جميع الحالات</option>
            <option value="محدد لها جلسة معارضة">محدد لها جلسة معارضة</option>
            <option value="تم قبول المعارضة">تم قبول المعارضة</option>
            <option value="تم رفض المعارضة">تم رفض المعارضة</option>
            <option value="صدر الحكم بالبراءة">صدر الحكم بالبراءة</option>
            <option value="صدر الحكم بالإدانة">صدر الحكم بالإدانة</option>
            <option value="تأجلت الجلسة">تأجلت الجلسة</option>
            <option value="جاري تنفيذ الحكم">جاري تنفيذ الحكم</option>
            <option value="أخرى">أخرى</option>
          </select>

          {/* Priority filter */}
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value as "حرج" | "مرتفع" | "عادي" | "الكل")}
            className="clay-input px-4 py-2.5 text-sm bg-background min-w-[140px]"
          >
            <option value="الكل">جميع الأولويات</option>
            <option value="حرج">حرج</option>
            <option value="مرتفع">مرتفع</option>
            <option value="عادي">عادي</option>
          </select>

          {/* Sort */}
          <button
            onClick={() => setSortDir(sortDir === "asc" ? "desc" : "asc")}
            className="clay-button flex items-center gap-2 px-3 py-2.5 bg-card text-sm rounded-xl"
          >
            {sortDir === "asc" ? <SortAsc className="w-4 h-4" /> : <SortDesc className="w-4 h-4" />}
            ترتيب
          </button>

          {/* View toggle */}
          <div className="flex clay-inset rounded-xl p-1">
            <button
              onClick={() => setView("table")}
              className={cn(
                "px-3 py-1.5 text-xs font-medium rounded-lg transition-all",
                view === "table" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"
              )}
            >
              جدول
            </button>
            <button
              onClick={() => setView("grid")}
              className={cn(
                "px-3 py-1.5 text-xs font-medium rounded-lg transition-all",
                view === "grid" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"
              )}
            >
              بطاقات
            </button>
          </div>
        </div>
      </div>

      {/* Results count */}
      <p className="text-sm text-muted-foreground">
        عرض {filtered.length} من {cases?.length ?? 0} قضية
      </p>

      {/* Table View */}
      {view === "table" && (
        <div className="clay-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-start px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">كود القضية</th>
                  <th className="text-start px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">رقم القضية</th>
                  <th className="text-start px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">العميل</th>
                  <th className="text-start px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">الحالة</th>
                  <th className="text-start px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">الأولوية</th>
                  <th className="text-start px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">تاريخ التقديم</th>
                  <th className="text-start px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">المحكمة</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => {
                  const priority = getPriorityForStatus(c.procedural_status);
                  return (
                    <tr
                      key={c.id}
                      className={cn(
                        "border-b border-border/50 hover:bg-muted/30 transition-colors",
                        urgencyBorder[priority]
                      )}
                    >
                      <td className="px-4 py-3">
                        <Link
                          to={`/app/cases/${c.case_code}`}
                          className="font-mono text-xs font-semibold text-clay-blue hover:underline"
                        >
                          {c.case_code}
                        </Link>
                      </td>
                      <td className="px-4 py-3 font-medium text-foreground">{c.case_no}</td>
                      <td className="px-4 py-3 text-muted-foreground">{c.client?.full_name ?? "—"}</td>
                      <td className="px-4 py-3">
                        <span className={cn("clay-badge text-[10px] font-bold px-2.5 py-1", "bg-clay-blue/10 text-clay-blue")}>
                          {getStatusLabel(c.procedural_status)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn("clay-badge text-[10px] font-bold px-2.5 py-1", priorityStyles[priority])}>
                          {priority}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{c.filing_date}</td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{c.court_name}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Grid View */}
      {view === "grid" && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((c) => {
            const priority = getPriorityForStatus(c.procedural_status);
            const clientName = c.client?.full_name ?? "—";
            return (
              <Link
                key={c.id}
                to={`/app/cases/${c.case_code}`}
                className={cn(
                  "clay-card p-5 hover:scale-[1.01] transition-transform block",
                  urgencyBorder[priority]
                )}
              >
                <div className="flex items-start justify-between mb-3">
                  <span className="font-mono text-xs font-semibold text-clay-blue">
                    {c.case_code}
                  </span>
                  <span className={cn("clay-badge text-[10px] font-bold px-2 py-0.5", "bg-clay-blue/10 text-clay-blue")}>
                    {getStatusLabel(c.procedural_status)}
                  </span>
                </div>
                <h3 className="text-sm font-bold text-foreground mb-1 line-clamp-2">{c.case_no}</h3>
                <p className="text-xs text-muted-foreground mb-3">{clientName}</p>
                <div className="flex items-center justify-between">
                  <span className={cn("clay-badge text-[10px] font-bold px-2 py-0.5", priorityStyles[priority])}>
                    {priority}
                  </span>
                  <span className="text-xs text-muted-foreground">📅 {c.filing_date}</span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
