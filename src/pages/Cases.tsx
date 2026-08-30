import { useState, useMemo } from "react";
import { Link } from "react-router";
import { Search, SortAsc, SortDesc, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { mockCases, type CaseStatus, type CasePriority } from "@/data/mock";

const statusStyles: Record<CaseStatus, string> = {
  "活跃": "bg-urgency-normal/10 text-urgency-normal",
  "معلق": "bg-urgency-high/10 text-urgency-high",
  "منتهي": "bg-muted text-muted-foreground",
  "طعن": "bg-clay-purple/10 text-clay-purple",
};

const priorityStyles: Record<CasePriority, string> = {
  "حرج": "bg-urgency-critical/10 text-urgency-critical",
  "مرتفع": "bg-urgency-high/10 text-urgency-high",
  "عادي": "bg-urgency-normal/10 text-urgency-normal",
};

const urgencyBorder: Record<CasePriority, string> = {
  "حرج": "urgency-border-critical",
  "مرتفع": "urgency-border-high",
  "عادي": "urgency-border-normal",
};

export default function Cases() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<CaseStatus | "الكل">("الكل");
  const [priorityFilter, setPriorityFilter] = useState<CasePriority | "الكل">("الكل");
  const [sortField] = useState<"filingDate" | "nextHearing" | "priority">("filingDate");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [view, setView] = useState<"table" | "grid">("table");

  const filtered = useMemo(() => {
    const result = mockCases.filter((c) => {
      const matchSearch =
        search === "" ||
        c.caseCode.includes(search) ||
        c.title.includes(search) ||
        c.clientName.includes(search) ||
        c.crimeType.includes(search);
      const matchStatus = statusFilter === "الكل" || c.status === statusFilter;
      const matchPriority = priorityFilter === "الكل" || c.priority === priorityFilter;
      return matchSearch && matchStatus && matchPriority;
    });

    result.sort((a, b) => {
      if (sortField === "priority") {
        const order = { "حرج": 3, "مرتفع": 2, "عادي": 1 };
        return sortDir === "asc"
          ? order[a.priority] - order[b.priority]
          : order[b.priority] - order[a.priority];
      }
      const aVal = a[sortField];
      const bVal = b[sortField];
      if (aVal === "—") return 1;
      if (bVal === "—") return -1;
      return sortDir === "asc"
        ? aVal.localeCompare(bVal)
        : bVal.localeCompare(aVal);
    });

    return result;
  }, [search, statusFilter, priorityFilter, sortField, sortDir]);

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
        <button className="clay-button flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground text-sm font-semibold rounded-xl">
          <Plus className="w-4 h-4" />
          قضية جديدة
        </button>
      </div>

      {/* Filters */}
      <div className="clay-card p-4">
        <div className="flex flex-col md:flex-row gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute end-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="بحث بالكود، الاسم، أو نوع الجريمة..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="clay-input w-full pe-10 ps-4 py-2.5 text-sm bg-background"
            />
          </div>

          {/* Status filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as CaseStatus | "الكل")}
            className="clay-input px-4 py-2.5 text-sm bg-background min-w-[140px]"
          >
            <option value="الكل">جميع الحالات</option>
            <option value="活跃">نشط</option>
            <option value="معلق">معلق</option>
            <option value="منتهي">منتهي</option>
            <option value="طعن">طعن</option>
          </select>

          {/* Priority filter */}
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value as CasePriority | "الكل")}
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
        عرض {filtered.length} من {mockCases.length} قضية
      </p>

      {/* Table View */}
      {view === "table" && (
        <div className="clay-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-start px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">
                    كود القضية
                  </th>
                  <th className="text-start px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">
                    العنوان
                  </th>
                  <th className="text-start px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">
                    العميل
                  </th>
                  <th className="text-start px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">
                    الحالة
                  </th>
                  <th className="text-start px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">
                    الأولوية
                  </th>
                  <th className="text-start px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">
                    الجلسة القادمة
                  </th>
                  <th className="text-start px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">
                    الموعد النهائي
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr
                    key={c.id}
                    className={cn(
                      "border-b border-border/50 hover:bg-muted/30 transition-colors",
                      urgencyBorder[c.priority]
                    )}
                  >
                    <td className="px-4 py-3">
                      <Link
                        to={`/app/cases/${c.caseCode}`}
                        className="font-mono text-xs font-semibold text-clay-blue hover:underline"
                      >
                        {c.caseCode}
                      </Link>
                    </td>
                    <td className="px-4 py-3 max-w-[200px] truncate font-medium text-foreground">
                      {c.title}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{c.clientName}</td>
                    <td className="px-4 py-3">
                      <span className={cn("clay-badge text-[10px] font-bold px-2.5 py-1", statusStyles[c.status])}>
                        {c.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn("clay-badge text-[10px] font-bold px-2.5 py-1", priorityStyles[c.priority])}>
                        {c.priority}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{c.nextHearing}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{c.deadline}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Grid View */}
      {view === "grid" && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((c) => (
            <Link
              key={c.id}
              to={`/app/cases/${c.caseCode}`}
              className={cn(
                "clay-card p-5 hover:scale-[1.01] transition-transform block",
                urgencyBorder[c.priority]
              )}
            >
              <div className="flex items-start justify-between mb-3">
                <span className="font-mono text-xs font-semibold text-clay-blue">
                  {c.caseCode}
                </span>
                <span className={cn("clay-badge text-[10px] font-bold px-2 py-0.5", statusStyles[c.status])}>
                  {c.status}
                </span>
              </div>
              <h3 className="text-sm font-bold text-foreground mb-1 line-clamp-2">{c.title}</h3>
              <p className="text-xs text-muted-foreground mb-3">{c.clientName}</p>
              <div className="flex items-center justify-between">
                <span className={cn("clay-badge text-[10px] font-bold px-2 py-0.5", priorityStyles[c.priority])}>
                  {c.priority}
                </span>
                <span className="text-xs text-muted-foreground">📅 {c.nextHearing}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
