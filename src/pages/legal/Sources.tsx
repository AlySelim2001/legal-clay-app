import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { ChevronDown, ExternalLink, Landmark, Scale } from "lucide-react";
import { useState } from "react";
import { CONVEX_URL } from "@/contexts/ConvexProvider";
import { EmptyState, LegalDisclaimerCard, StatusBadge } from "@/components/legal/ui";

/**
 * المصادر القانونية — the public source registry. Full transparency:
 * version, effective dates, verification status, and official link.
 */

interface SourceListItem {
  _id: string;
  title: string;
  sourceType: string;
  publisher?: string;
  officialUrl?: string;
  version: string;
  status: string;
  verificationStatus: string;
  effectiveFrom?: number;
  effectiveTo?: number;
  retrievedAt: number;
}

interface Article {
  _id: string;
  number: string;
  title: string;
  body: string;
  category: string;
  validity: string;
}

const TYPE_LABELS: Record<string, string> = {
  statute: "قانون",
  constitution: "دستور",
  regulation: "لائحة",
  decree: "مرسوم",
  portal: "بوابة رسمية",
};

export default function Sources() {
  const sources = useQuery(
    api.legal.listSources,
    CONVEX_URL ? { limit: 100 } : "skip",
  ) as SourceListItem[] | undefined;
  const [openId, setOpenId] = useState<string | null>(null);

  const detail = useQuery(
    api.legal.sourceDetail,
    openId && CONVEX_URL ? { id: openId as never } : "skip",
  ) as { source: SourceListItem; articles: Article[] } | undefined | null;

  if (!CONVEX_URL) {
    return (
      <div className="mx-auto max-w-3xl">
        <EmptyState
          icon={<Scale className="h-8 w-8 text-muted-foreground" />}
          title="منصة المعرفة غير مُهيأة"
          description="لم يتم ضبط اتصال قاعدة المعرفة في هذه البيئة."
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <h1 className="text-2xl font-black text-clay-text">المصادر القانونية</h1>
        <p className="text-sm text-clay-text-secondary">
          سجل المصادر الرسمية التي تُبنى عليها كل إجابات المنصة — مع حالة كل مصدر ونطاق سريانه.
        </p>
      </div>

      {sources === undefined ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="clay-card h-24 animate-pulse" />
          ))}
        </div>
      ) : sources.length === 0 ? (
        <EmptyState
          icon={<Scale className="h-8 w-8 text-muted-foreground" />}
          title="لا توجد مصادر بعد"
        />
      ) : (
        <div className="space-y-3">
          {sources.map((s) => {
            const isOpen = openId === s._id;
            return (
              <article key={s._id} className="clay-card p-4">
                <button
                  onClick={() => setOpenId(isOpen ? null : s._id)}
                  className="flex w-full items-start gap-3 text-start"
                  aria-expanded={isOpen}
                >
                  <div className="rounded-xl bg-primary/10 p-2 text-primary">
                    {s.sourceType === "portal" ? (
                      <Landmark className="h-5 w-5" />
                    ) : (
                      <Scale className="h-5 w-5" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-clay-text">{s.title}</p>
                    <p className="mt-0.5 text-xs text-clay-text-secondary">
                      {TYPE_LABELS[s.sourceType] ?? s.sourceType}
                      {s.publisher && ` · ${s.publisher}`}
                      {` · نسخة ${s.version}`}
                      {s.effectiveFrom &&
                        ` · سارٍ من ${new Date(s.effectiveFrom).toLocaleDateString("ar-EG")}`}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <StatusBadge status={s.status} />
                    <ChevronDown
                      className={`h-4 w-4 text-clay-text-secondary transition-transform ${isOpen ? "rotate-180" : ""}`}
                    />
                  </div>
                </button>

                {isOpen && (
                  <div className="mt-3 border-t border-clay-border/60 pt-3">
                    {detail === undefined && (
                      <div className="h-16 animate-pulse rounded-xl bg-muted" />
                    )}
                    {detail?.articles.map((a) => (
                      <details key={a._id} className="clay-card-soft mb-2 p-3">
                        <summary className="cursor-pointer text-sm font-bold text-clay-text">
                          المادة {a.number} — {a.title}
                        </summary>
                        <div className="mt-2 flex items-center gap-2">
                          <StatusBadge status={a.validity} />
                          <span className="text-[10px] text-clay-text-secondary">{a.category}</span>
                        </div>
                        <p className="mt-2 text-sm leading-relaxed text-clay-text">{a.body}</p>
                      </details>
                    ))}
                    {s.officialUrl && (
                      <a
                        href={s.officialUrl}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        البوابة الرسمية للمصدر
                      </a>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      <LegalDisclaimerCard compact />
    </div>
  );
}
