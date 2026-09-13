import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  AlertTriangle,
  Building2,
  ExternalLink,
  FileCheck2,
  ListOrdered,
  Route,
} from "lucide-react";
import { useState } from "react";
import { CONVEX_URL } from "@/contexts/ConvexProvider";
import { EmptyState, LegalDisclaimerCard, StatusBadge } from "@/components/legal/ui";

/**
 * ماذا أفعل الآن؟ — procedural navigator grounded in published guides.
 * Each guide shows: understanding, verifiable points, next steps, competent
 * authority, likely documents, warnings, and the legal source (P-03).
 */

interface ProcedureGuide {
  _id: string;
  slug: string;
  title: string;
  keywords: string[];
  summary: string;
  steps: string[];
  documentsNeeded: string[];
  warnings: string[];
  authorities: Array<{ _id: string; name: string; website?: string }>;
  status: string;
  verificationStatus: string;
}

export default function NextSteps() {
  const guides = useQuery(
    api.legal.listProcedures,
    CONVEX_URL ? {} : "skip",
  ) as ProcedureGuide[] | undefined;
  const [open, setOpen] = useState<string | null>(null);

  if (!CONVEX_URL) {
    return (
      <div className="mx-auto max-w-3xl">
        <EmptyState
          icon={<Route className="h-8 w-8 text-muted-foreground" />}
          title="منصة المعرفة غير مُهيأة"
          description="لم يتم ضبط اتصال قاعدة المعرفة في هذه البيئة."
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <h1 className="text-2xl font-black text-clay-text">ماذا أفعل الآن؟</h1>
        <p className="text-sm text-clay-text-secondary">
          خطوات عملية مبنية على المصادر: افهم المشكلة، اعرف الجهة المختصة، جهّز مستنداتك.
        </p>
      </div>

      {guides === undefined ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="clay-card h-28 animate-pulse" />
          ))}
        </div>
      ) : guides.length === 0 ? (
        <EmptyState
          icon={<Route className="h-8 w-8 text-muted-foreground" />}
          title="لا توجد أدلة إجرائية منشورة بعد"
          description="الأدلة الإجرائية تُنشر بعد مراجعة المصادر واعتمادها."
        />
      ) : (
        <div className="space-y-3">
          {guides.map((g) => {
            const isOpen = open === g._id;
            return (
              <article key={g._id} className="clay-card overflow-hidden">
                <button
                  onClick={() => setOpen(isOpen ? null : g._id)}
                  className="flex w-full items-center gap-3 p-4 text-start"
                  aria-expanded={isOpen}
                >
                  <div className="rounded-xl bg-emerald-100 p-2 text-emerald-700">
                    <Route className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-clay-text">{g.title}</p>
                    <p className="truncate text-xs text-clay-text-secondary">{g.summary}</p>
                  </div>
                  <StatusBadge status={g.verificationStatus} />
                </button>

                {isOpen && (
                  <div className="space-y-4 border-t border-clay-border/60 p-4 pt-3">
                    {/* Steps */}
                    <section>
                      <h4 className="mb-2 flex items-center gap-1.5 text-xs font-black text-clay-text">
                        <ListOrdered className="h-4 w-4 text-primary" />
                        الخطوات
                      </h4>
                      <ol className="space-y-2">
                        {g.steps.map((s, i) => (
                          <li key={i} className="clay-inset flex items-start gap-2 p-3 text-sm leading-relaxed">
                            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-black text-white">
                              {i + 1}
                            </span>
                            {s}
                          </li>
                        ))}
                      </ol>
                    </section>

                    {/* Documents */}
                    {g.documentsNeeded.length > 0 && (
                      <section>
                        <h4 className="mb-2 flex items-center gap-1.5 text-xs font-black text-clay-text">
                          <FileCheck2 className="h-4 w-4 text-primary" />
                          المستندات المحتملة
                        </h4>
                        <div className="flex flex-wrap gap-1.5">
                          {g.documentsNeeded.map((d, i) => (
                            <span key={i} className="clay-badge text-xs">
                              {d}
                            </span>
                          ))}
                        </div>
                      </section>
                    )}

                    {/* Authorities */}
                    {g.authorities.length > 0 && (
                      <section>
                        <h4 className="mb-2 flex items-center gap-1.5 text-xs font-black text-clay-text">
                          <Building2 className="h-4 w-4 text-primary" />
                          الجهة المختصة
                        </h4>
                        <div className="space-y-1.5">
                          {g.authorities.map((a) => (
                            <div
                              key={a._id}
                              className="flex items-center justify-between clay-card-soft px-3 py-2"
                            >
                              <span className="text-sm text-clay-text">{a.name}</span>
                              {a.website && (
                                <a
                                  href={a.website}
                                  target="_blank"
                                  rel="noreferrer noopener"
                                  className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                                >
                                  <ExternalLink className="h-3 w-3" />
                                  الموقع الرسمي
                                </a>
                              )}
                            </div>
                          ))}
                        </div>
                      </section>
                    )}

                    {/* Warnings */}
                    {g.warnings.length > 0 && (
                      <section className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                        <div className="flex items-center gap-2 text-amber-800">
                          <AlertTriangle className="h-4 w-4" />
                          <span className="text-xs font-bold">تحذيرات مهمة</span>
                        </div>
                        <ul className="mt-1.5 list-inside list-disc space-y-1 text-xs leading-relaxed text-amber-800/90">
                          {g.warnings.map((w, i) => (
                            <li key={i}>{w}</li>
                          ))}
                        </ul>
                      </section>
                    )}
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
