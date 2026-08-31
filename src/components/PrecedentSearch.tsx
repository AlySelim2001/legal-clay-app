import { useState, useEffect } from "react";
import { Search, Scale, Loader2, Calendar, BookOpen } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useDefenses } from "@/hooks/useSupabaseData";

interface Precedent {
  id: string;
  title: string;
  court: string;
  ruling_date: string;
  principle_summary: string;
  defense_name: string | null;
  crime_type: string | null;
}

export function PrecedentSearch() {
  const { data: defenses } = useDefenses();
  const [query, setQuery] = useState("");
  const [defenseFilter, setDefenseFilter] = useState<string>("");
  const [results, setResults] = useState<Precedent[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const search = async () => {
    setLoading(true);
    setSearched(true);

    const { data, error } = await supabase.rpc("search_precedents", {
      p_defense_category_id: defenseFilter || null,
      p_crime_type: query || null,
      p_query: query || null,
    });

    if (!error && data) {
      setResults(data as Precedent[]);
    }
    setLoading(false);
  };

  // Initial load of all precedents
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    let cancelled = false;
    setLoading(true);
    void (async () => {
      const { data, error } = await supabase.rpc("search_precedents", {});
      if (cancelled) return;
      if (!error && data) setResults(data as Precedent[]);
      setLoading(false);
    })();
    return () => { cancelled = true; };
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="clay-card p-4">
        <div className="flex items-center gap-2 mb-3">
          <Scale className="w-5 h-5 text-clay-purple" />
          <h3 className="text-sm font-bold text-foreground">محرك الأحكام القضائية</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="relative md:col-span-2">
            <Search className="absolute end-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="بحث في أحكاممحكمة النقض..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && search()}
              className="clay-input w-full pe-10 ps-4 py-2.5 text-sm bg-background"
            />
          </div>
          <select
            value={defenseFilter}
            onChange={(e) => setDefenseFilter(e.target.value)}
            className="clay-input px-3 py-2.5 text-sm bg-background"
          >
            <option value="">جميع الدفوع</option>
            {(defenses ?? []).map((d) => (
              <option key={d.id} value={d.id}>{d.code} — {d.name}</option>
            ))}
          </select>
        </div>

        <button
          onClick={search}
          disabled={loading}
          className="clay-button mt-3 w-full py-2.5 bg-clay-purple/10 text-clay-purple text-sm font-semibold rounded-xl flex items-center justify-center gap-2"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          بحث
        </button>
      </div>

      {/* Results */}
      {loading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      )}

      {!loading && results.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">عرض {results.length} حكم قضائي</p>

          {results.map((p) => (
            <div key={p.id} className="clay-card p-4">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-2xl bg-clay-purple/10 shrink-0">
                  <Scale className="w-5 h-5 text-clay-purple" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-bold text-foreground mb-1">{p.title}</h4>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="clay-badge text-[9px] font-bold bg-clay-blue/10 text-clay-blue px-1.5 py-0.5">
                      {p.court}
                    </span>
                    <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                      <Calendar className="w-3 h-3" />
                      {p.ruling_date}
                    </span>
                    {p.defense_name && (
                      <span className="clay-badge text-[9px] font-bold bg-clay-purple/10 text-clay-purple px-1.5 py-0.5">
                        {p.defense_name}
                      </span>
                    )}
                    {p.crime_type && (
                      <span className="clay-badge text-[9px] font-bold bg-card text-muted-foreground px-1.5 py-0.5 border border-border">
                        {p.crime_type}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-foreground/80 leading-relaxed">
                    {p.principle_summary}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && searched && results.length === 0 && (
        <div className="text-center py-8">
          <BookOpen className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">لا توجد أحكام تطابق بحثك</p>
        </div>
      )}
    </div>
  );
}
