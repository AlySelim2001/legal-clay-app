import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { FileSearch, Loader2, Search } from "lucide-react";
import { useState } from "react";
import { CONVEX_URL } from "@/contexts/ConvexProvider";
import { EmptyState, LegalDisclaimerCard, StatusBadge } from "@/components/legal/ui";

/**
 * البحث القانوني — hybrid search over published chunks with validity flags.
 */

interface SearchResults {
  results: Array<{
    chunkId: string;
    sourceTitle: string;
    sourceType: string;
    officialUrl?: string;
    provenance: string;
    text: string;
    validity: string;
    verificationStatus: string;
    score: number;
  }>;
  bestScore: number;
  sufficient: boolean;
}

export default function LegalSearch() {
  const [q, setQ] = useState("");
  const [pending, setPending] = useState(false);
  const [data, setData] = useState<SearchResults | null>(null);
  const [error, setError] = useState<string | null>(null);

  const search = useAction(api.legal.searchLegal);

  async function submit(text: string) {
    const query = text.trim();
    if (query.length < 2 || !CONVEX_URL) return;
    setPending(true);
    setError(null);
    try {
      setData((await search({ q: query })) as unknown as SearchResults);
    } catch {
      setError("تعذّر تنفيذ البحث — أعد المحاولة بعد قليل.");
    } finally {
      setPending(false);
    }
  }

  if (!CONVEX_URL) {
    return (
      <div className="mx-auto max-w-3xl">
        <EmptyState
          icon={<Search className="h-8 w-8 text-muted-foreground" />}
          title="منصة المعرفة غير مُهيأة"
          description="لم يتم ضبط اتصال قاعدة المعرفة في هذه البيئة."
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <h1 className="text-2xl font-black text-clay-text">البحث القانوني</h1>
        <p className="text-sm text-clay-text-secondary">
          ابحث في المواد والمصادر المنشورة — النتائج تعرض حالة كل نص الزمنية والتحقق.
        </p>
      </div>

      <form
        className="clay-card flex items-center gap-2 p-3"
        onSubmit={(e) => {
          e.preventDefault();
          void submit(q);
        }}
      >
        <Search className="ms-1 h-5 w-5 shrink-0 text-clay-text-secondary" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          maxLength={300}
          placeholder="ابحث مثلاً: المعارضة، إيصال أمانة، حماية البيانات…"
          className="clay-input h-11 flex-1 text-sm"
          dir="rtl"
        />
        <button
          type="submit"
          disabled={pending || q.trim().length < 2}
          className="clay-button flex h-11 items-center gap-2 bg-primary px-4 text-sm font-bold text-white disabled:opacity-50"
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSearch className="h-4 w-4" />}
          ابحث
        </button>
      </form>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {data && !data.sufficient && data.results.length === 0 && (
        <div className="clay-card-soft p-4 text-sm leading-relaxed text-clay-text-secondary">
          لا توجد نتائج مطابقة في قاعدة المعرفة المنشورة. جرّب صياغة أخرى أو مصطلحاً قانونياً أدق.
        </div>
      )}

      {data && data.results.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs text-clay-text-secondary">
            {data.results.length} نتيجة — مرتبة حسب الصلة
          </p>
          {data.results.map((r) => (
            <article key={r.chunkId} className="clay-card p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-bold text-clay-text">{r.sourceTitle}</span>
                <span className="text-xs text-clay-text-secondary">— {r.provenance}</span>
                <div className="ms-auto flex items-center gap-1.5">
                  <StatusBadge status={r.validity} />
                  <StatusBadge status={r.verificationStatus} />
                </div>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-clay-text">{r.text}</p>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-[10px] text-clay-text-secondary">
                  درجة الصلة: {r.score}
                </span>
                {r.officialUrl && (
                  <a
                    href={r.officialUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="text-xs font-semibold text-primary hover:underline"
                  >
                    عرض المصدر الرسمي
                  </a>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      <LegalDisclaimerCard compact />
    </div>
  );
}
