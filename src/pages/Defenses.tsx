import { useState, useMemo } from "react";
import { Search, Shield, BookOpen, TrendingUp, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { mockDefenses } from "@/data/mock";

export default function Defenses() {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("الكل");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const categories = useMemo(() => {
    const cats = [...new Set(mockDefenses.map((d) => d.category))];
    return ["الكل", ...cats];
  }, []);

  const filtered = useMemo(() => {
    let result = mockDefenses;
    if (search) {
      result = result.filter(
        (d) =>
          d.name.includes(search) ||
          d.description.includes(search) ||
          d.code.includes(search)
      );
    }
    if (categoryFilter !== "الكل") {
      result = result.filter((d) => d.category === categoryFilter);
    }
    return result;
  }, [search, categoryFilter]);

  const successColor = (rate: number) => {
    if (rate >= 60) return "text-urgency-normal";
    if (rate >= 35) return "text-urgency-high";
    return "text-urgency-critical";
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">الدفوعات الجنائية</h1>
        <p className="text-sm text-muted-foreground mt-1">
          كتالوج الدفوعات القانونية المتاحة ونسب نجاحها
        </p>
      </div>

      {/* Search + Filter */}
      <div className="clay-card p-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute end-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="بحث في الدفوعات..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="clay-input w-full pe-10 ps-4 py-2.5 text-sm bg-background"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={cn(
                "clay-badge text-xs font-semibold px-3 py-2 transition-all cursor-pointer",
                categoryFilter === cat
                  ? "bg-primary text-primary-foreground"
                  : "bg-card text-muted-foreground hover:bg-muted"
              )}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Results */}
      <p className="text-sm text-muted-foreground">
        عرض {filtered.length} من {mockDefenses.length} دفاع
      </p>

      {/* Defense Cards */}
      <div className="space-y-4">
        {filtered.map((defense) => {
          const isExpanded = expandedId === defense.id;
          return (
            <div
              key={defense.id}
              className="clay-card overflow-hidden transition-all"
            >
              {/* Header */}
              <button
                onClick={() =>
                  setExpandedId(isExpanded ? null : defense.id)
                }
                className="w-full p-5 flex items-start gap-4 text-start"
              >
                <div className="p-2.5 rounded-2xl bg-clay-purple/10 shrink-0">
                  <Shield className="w-5 h-5 text-clay-purple" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-xs font-semibold text-clay-purple">
                      {defense.code}
                    </span>
                    <span className="clay-badge text-[10px] font-bold bg-clay-purple/10 text-clay-purple px-2 py-0.5">
                      {defense.category}
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-foreground mb-1">
                    {defense.name}
                  </h3>
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {defense.description}
                  </p>
                </div>

                <div className="shrink-0 flex flex-col items-end gap-1">
                  <div className="flex items-center gap-1.5">
                    <TrendingUp className={cn("w-4 h-4", successColor(defense.successRate))} />
                    <span className={cn("text-lg font-bold", successColor(defense.successRate))}>
                      {defense.successRate}%
                    </span>
                  </div>
                  <span className="text-[10px] text-muted-foreground">نسبة النجاح</span>
                  {isExpanded ? (
                    <ChevronUp className="w-4 h-4 text-muted-foreground mt-1" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-muted-foreground mt-1" />
                  )}
                </div>
              </button>

              {/* Expanded Content */}
              {isExpanded && (
                <div className="px-5 pb-5 border-t border-border/50 pt-4 animate-fade-in">
                  <p className="text-sm text-foreground/80 leading-relaxed mb-4">
                    {defense.description}
                  </p>

                  {/* Success Rate Bar */}
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-semibold text-muted-foreground">
                        نسبة النجاح المقدرة
                      </span>
                      <span className={cn("text-sm font-bold", successColor(defense.successRate))}>
                        {defense.successRate}%
                      </span>
                    </div>
                    <div className="clay-inset rounded-full h-3 overflow-hidden">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all",
                          defense.successRate >= 60
                            ? "bg-urgency-normal"
                            : defense.successRate >= 35
                            ? "bg-urgency-high"
                            : "bg-urgency-critical"
                        )}
                        style={{ width: `${defense.successRate}%` }}
                      />
                    </div>
                  </div>

                  {/* Applicable Articles */}
                  <div className="mb-4">
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-2 flex items-center gap-1.5">
                      <BookOpen className="w-3 h-3" />
                      المواد القانونية المعمول بها
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {defense.applicableArticles.map((article, i) => (
                        <span
                          key={i}
                          className="clay-badge text-xs font-medium bg-clay-blue/10 text-clay-blue px-3 py-1.5"
                        >
                          {article}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Precedent Cases */}
                  <div>
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-2">
                      القضايا السابقة المرجعية
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {defense.precedentCases.map((pc, i) => (
                        <span
                          key={i}
                          className="clay-badge text-xs font-mono font-medium bg-card text-foreground px-3 py-1.5 border border-border"
                        >
                          {pc}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
