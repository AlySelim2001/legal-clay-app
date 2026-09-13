import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Building2, ExternalLink, Landmark, Phone } from "lucide-react";
import { CONVEX_URL } from "@/contexts/ConvexProvider";
import { EmptyState, LegalDisclaimerCard, StatusBadge } from "@/components/legal/ui";

/**
 * تروح فين؟ وتتعامل مع مين؟ — authority directory. Never invents local info:
 * each authority carries verification status and an official website only
 * when one exists in the registry.
 */

interface Authority {
  _id: string;
  name: string;
  authorityType: string;
  jurisdiction: string;
  website?: string;
  phone?: string;
  verificationStatus: string;
  lastVerifiedAt?: number;
  services: Array<{
    _id: string;
    name: string;
    description?: string;
    officialUrl?: string;
    steps?: string[];
  }>;
}

export default function Authorities() {
  const authorities = useQuery(
    api.legal.listAuthorities,
    CONVEX_URL ? {} : "skip",
  ) as Authority[] | undefined;

  if (!CONVEX_URL) {
    return (
      <div className="mx-auto max-w-3xl">
        <EmptyState
          icon={<Landmark className="h-8 w-8 text-muted-foreground" />}
          title="منصة المعرفة غير مُهيأة"
          description="لم يتم ضبط اتصال قاعدة المعرفة في هذه البيئة."
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <h1 className="text-2xl font-black text-clay-text">دليل الجهات الرسمية</h1>
        <p className="text-sm text-clay-text-secondary">
          الجهات المختصة وخدماتها الرسمية — البيانات تُعرض بحالة تحققها ولا تُخترع أبداً.
        </p>
      </div>

      {authorities === undefined ? (
        <div className="space-y-3">
          {[0, 1].map((i) => (
            <div key={i} className="clay-card h-32 animate-pulse" />
          ))}
        </div>
      ) : authorities.length === 0 ? (
        <EmptyState
          icon={<Landmark className="h-8 w-8 text-muted-foreground" />}
          title="لا توجد جهات مسجلة بعد"
          description="تُضاف الجهات بعد التحقق من مصادرها الرسمية ومراجعتها."
        />
      ) : (
        <div className="space-y-3">
          {authorities.map((a) => (
            <article key={a._id} className="clay-card p-5">
              <div className="flex items-start gap-3">
                <div className="rounded-xl bg-sky-100 p-2.5 text-sky-700">
                  <Building2 className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-sm font-black text-clay-text">{a.name}</h2>
                    <StatusBadge status={a.verificationStatus} />
                  </div>
                  <p className="mt-0.5 text-xs text-clay-text-secondary">
                    {a.authorityType} · {a.jurisdiction}
                    {a.lastVerifiedAt &&
                      ` · آخر تحقق: ${new Date(a.lastVerifiedAt).toLocaleDateString("ar-EG")}`}
                  </p>
                  {a.phone && (
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-clay-text-secondary">
                      <Phone className="h-3 w-3" />
                      {a.phone}
                    </p>
                  )}
                </div>
                {a.website && (
                  <a
                    href={a.website}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="clay-button flex items-center gap-1.5 bg-primary px-3 py-2 text-xs font-bold text-white"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    الموقع
                  </a>
                )}
              </div>

              {a.services.length > 0 && (
                <div className="mt-4 space-y-2 border-t border-clay-border/60 pt-3">
                  <h3 className="text-xs font-black text-clay-text">الخدمات</h3>
                  {a.services.map((s) => (
                    <div key={s._id} className="clay-card-soft p-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-bold text-clay-text">{s.name}</span>
                        {s.officialUrl && (
                          <a
                            href={s.officialUrl}
                            target="_blank"
                            rel="noreferrer noopener"
                            className="shrink-0 text-xs font-semibold text-primary hover:underline"
                          >
                            الخدمة الرسمية
                          </a>
                        )}
                      </div>
                      {s.description && (
                        <p className="mt-1 text-xs leading-relaxed text-clay-text-secondary">
                          {s.description}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </article>
          ))}
        </div>
      )}

      <LegalDisclaimerCard compact />
    </div>
  );
}
