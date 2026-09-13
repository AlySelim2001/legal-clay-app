import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { BookOpen, ChevronDown, GraduationCap } from "lucide-react";
import { useState } from "react";
import { CONVEX_URL } from "@/contexts/ConvexProvider";
import { EmptyState, LegalDisclaimerCard, StatusBadge } from "@/components/legal/ui";

/**
 * اعرف حقك وواجباتك — educational, source-grounded awareness topics.
 */

interface RightsTopic {
  _id: string;
  slug: string;
  title: string;
  category: string;
  summary: string;
  points: Array<{ text: string; chunkIds: string[] }>;
  keywords: string[];
  status: string;
  verificationStatus: string;
}

export default function Rights() {
  const topics = useQuery(
    api.legal.listRights,
    CONVEX_URL ? {} : "skip",
  ) as RightsTopic[] | undefined;
  const [open, setOpen] = useState<string | null>(null);

  if (!CONVEX_URL) {
    return (
      <div className="mx-auto max-w-3xl">
        <EmptyState
          icon={<GraduationCap className="h-8 w-8 text-muted-foreground" />}
          title="منصة المعرفة غير مُهيأة"
          description="لم يتم ضبط اتصال قاعدة المعرفة في هذه البيئة."
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <h1 className="text-2xl font-black text-clay-text">اعرف حقك وواجباتك</h1>
        <p className="text-sm text-clay-text-secondary">
          شرح مبسط لحقوقك وواجباتك — كل نقطة مرتبطة بمصدرها القانوني.
        </p>
      </div>

      {topics === undefined ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="clay-card h-24 animate-pulse" />
          ))}
        </div>
      ) : topics.length === 0 ? (
        <EmptyState
          icon={<GraduationCap className="h-8 w-8 text-muted-foreground" />}
          title="لا توجد مواضيع منشورة بعد"
          description="المواضيع التوعوية تُنشر بعد مراجعة المصادر واعتمادها."
        />
      ) : (
        <div className="space-y-3">
          {topics.map((t) => {
            const isOpen = open === t._id;
            return (
              <article key={t._id} className="clay-card overflow-hidden">
                <button
                  onClick={() => setOpen(isOpen ? null : t._id)}
                  className="flex w-full items-center gap-3 p-4 text-start"
                  aria-expanded={isOpen}
                >
                  <div className="rounded-xl bg-teal-100 p-2 text-teal-700">
                    <BookOpen className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-clay-text">{t.title}</p>
                    <p className="truncate text-xs text-clay-text-secondary">{t.summary}</p>
                  </div>
                  <ChevronDown
                    className={`h-4 w-4 shrink-0 text-clay-text-secondary transition-transform ${isOpen ? "rotate-180" : ""}`}
                  />
                </button>
                {isOpen && (
                  <div className="border-t border-clay-border/60 p-4 pt-3">
                    <div className="mb-3 flex items-center gap-2">
                      <StatusBadge status={t.verificationStatus} />
                      <span className="text-[10px] text-clay-text-secondary">
                        الفئة: {t.category}
                      </span>
                    </div>
                    <ul className="space-y-2">
                      {t.points.map((p, i) => (
                        <li
                          key={i}
                          className="clay-inset flex items-start gap-2 p-3 text-sm leading-relaxed text-clay-text"
                        >
                          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[10px] font-black text-primary">
                            {i + 1}
                          </span>
                          {p.text}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      <LegalDisclaimerCard />
    </div>
  );
}
