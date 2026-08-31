import { useState, useMemo } from "react";
import { Search, Shield, TrendingUp, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { useDefenses } from "@/hooks/useSupabaseData";

export default function Defenses() {
  const { data: defenses, loading, error } = useDefenses();
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (!defenses) return [];
    let result = defenses;
    if (search) {
      result = result.filter(
        (d) =>
          d.name.includes(search) ||
          (d.description ?? "").includes(search) ||
          d.code.includes(search)
      );
    }
    return result;
  }, [defenses, search]);

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
      <div>
        <h1 className="text-2xl font-bold text-foreground">الدفوعات الجنائية</h1>
        <p className="text-sm text-muted-foreground mt-1">
          كتالوج الدفوعات القانونية المتاحة
        </p>
      </div>

      {/* Search */}
      <div className="clay-card p-4">
        <div className="relative">
          <Search className="absolute end-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="بحث في الدفوعات..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="clay-input w-full pe-10 ps-4 py-2.5 text-sm bg-background"
          />
        </div>
      </div>

      {/* Results */}
      <p className="text-sm text-muted-foreground">
        عرض {filtered.length} من {defenses?.length ?? 0} دفاع
      </p>

      {/* Defense Cards */}
      <div className="space-y-4">
        {filtered.map((defense) => {
          const isExpanded = expandedId === defense.id;
          return (
            <div key={defense.id} className="clay-card overflow-hidden transition-all">
              {/* Header */}
              <button
                onClick={() => setExpandedId(isExpanded ? null : defense.id)}
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
                  </div>
                  <h3 className="text-sm font-bold text-foreground mb-1">
                    {defense.name}
                  </h3>
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {defense.description ?? "—"}
                  </p>
                </div>

                <div className="shrink-0 flex flex-col items-end gap-1">
                  <div className="flex items-center gap-1.5">
                    <TrendingUp className="w-4 h-4 text-muted-foreground" />
                  </div>
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
                    {defense.description ?? "لا توجد تفاصيل إضافية"}
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
