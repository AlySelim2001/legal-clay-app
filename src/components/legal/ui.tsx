import { AlertTriangle, BookOpen, ExternalLink, Info, ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Shared UI atoms for the Evidence-First legal knowledge platform.
 * Claymorphism-styled, Arabic-first, P-03 (source transparency) built in.
 */

export const ABSTAIN_MESSAGE =
  "لا تتوفر أدلة قانونية موثوقة وكافية في قاعدة المعرفة الحالية لإصدار إجابة مؤكدة.";

const STATUS_STYLES: Record<string, string> = {
  // Citation / claim statuses
  SUPPORTED: "bg-emerald-100 text-emerald-800 border-emerald-200",
  PARTIALLY_SUPPORTED: "bg-amber-100 text-amber-800 border-amber-200",
  UNSUPPORTED: "bg-red-100 text-red-700 border-red-200",
  CONFLICTING: "bg-orange-100 text-orange-800 border-orange-200",
  OUTDATED: "bg-stone-200 text-stone-700 border-stone-300",
  UNVERIFIED: "bg-sky-100 text-sky-800 border-sky-200",
  INSUFFICIENT_EVIDENCE: "bg-amber-100 text-amber-800 border-amber-200",
  // Temporal validity
  CURRENT: "bg-emerald-100 text-emerald-800 border-emerald-200",
  HISTORICAL: "bg-stone-200 text-stone-700 border-stone-300",
  FUTURE: "bg-sky-100 text-sky-800 border-sky-200",
  SUPERSEDED: "bg-stone-200 text-stone-700 border-stone-300",
  UNKNOWN: "bg-muted text-muted-foreground border-border",
  // Workflow statuses
  PUBLISHED: "bg-emerald-100 text-emerald-800 border-emerald-200",
  REVIEW_PENDING: "bg-amber-100 text-amber-800 border-amber-200",
  APPROVED: "bg-sky-100 text-sky-800 border-sky-200",
  REJECTED: "bg-red-100 text-red-700 border-red-200",
  VERIFIED: "bg-emerald-100 text-emerald-800 border-emerald-200",
  UNREVIEWED: "bg-sky-100 text-sky-800 border-sky-200",
  DISPUTED: "bg-orange-100 text-orange-800 border-orange-200",
};

const STATUS_LABELS: Record<string, string> = {
  SUPPORTED: "مدعوم بمصدر",
  PARTIALLY_SUPPORTED: "مدعوم جزئياً",
  UNSUPPORTED: "غير مدعوم",
  CONFLICTING: "مصادر متعارضة",
  OUTDATED: "نص ملغي أو قديم",
  UNVERIFIED: "غير مُتحقق",
  INSUFFICIENT_EVIDENCE: "أدلة غير كافية",
  CURRENT: "ساري حالياً",
  HISTORICAL: "نص تاريخي",
  FUTURE: "ينفذ مستقبلاً",
  SUPERSEDED: "استُبدل بنص أحدث",
  UNKNOWN: "حالة غير معروفة",
  PUBLISHED: "منشور",
  REVIEW_PENDING: "بانتظار المراجعة",
  APPROVED: "معتمد",
  REJECTED: "مرفوض",
  VERIFIED: "مُتحقق منه",
  UNREVIEWED: "لم يُراجع بعد",
  DISPUTED: "متنازع عليه",
};

export function StatusBadge({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-bold",
        STATUS_STYLES[status] ?? "bg-muted text-muted-foreground border-border",
        className,
      )}
    >
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

/** The mandatory global disclaimer (P-05 human review, P-08 fail safely). */
export function LegalDisclaimerCard({ compact = false }: { compact?: boolean }) {
  return (
    <div className="clay-card-soft flex items-start gap-3 p-4">
      <Info className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
      <p className="text-xs leading-relaxed text-clay-text-secondary">
        {compact ? (
          <>هذه المنصة للتوعية القانونية فقط ولا تُعد استشارة قانونية. القرارات القضائية تحتاج محامياً مختصاً.</>
        ) : (
          <>
            هذه المنصة للتوعية القانونية العامة فقط، ولا تُعد استشارة قانونية أو رأياً قضائياً. كل
            الإجابات مبنية حصراً على المصادر المنشورة داخل المنصة — راجع النص الأصلي دائماً عبر «عرض
            المصدر»، وعند وجود أي التباس استشر محامياً مختصاً.
          </>
        )}
      </p>
    </div>
  );
}

/** One citation with full provenance — the "لماذا ظهرت هذه النتيجة؟" view. */
export function CitationCard({
  sourceTitle,
  sourceType,
  officialUrl,
  provenance,
  excerpt,
  version,
  status,
}: {
  sourceTitle: string;
  sourceType?: string;
  officialUrl?: string;
  provenance?: string;
  excerpt: string;
  version?: string;
  status?: string;
}) {
  return (
    <div className="clay-card-soft p-4">
      <div className="flex flex-wrap items-center gap-2">
        <BookOpen className="h-4 w-4 text-primary" />
        <span className="text-sm font-bold text-clay-text">{sourceTitle}</span>
        {provenance && (
          <span className="text-xs text-clay-text-secondary">— {provenance}</span>
        )}
        {version && (
          <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] text-clay-text-secondary">
            نسخة {version}
          </span>
        )}
        {status && <StatusBadge status={status} className="ms-auto" />}
      </div>
      <blockquote className="clay-inset mt-3 border-e-4 border-primary/40 p-3 text-sm leading-relaxed text-clay-text">
        {excerpt}
      </blockquote>
      {officialUrl && (
        <a
          href={officialUrl}
          target="_blank"
          rel="noreferrer noopener"
          className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          عرض المصدر الرسمي
        </a>
      )}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
}: {
  icon: ReactNode;
  title: string;
  description?: string;
}) {
  return (
    <div className="clay-card-soft flex flex-col items-center justify-center gap-3 p-10 text-center">
      <div className="rounded-2xl bg-clay-surface p-4">{icon}</div>
      <p className="font-bold text-clay-text">{title}</p>
      {description && (
        <p className="max-w-sm text-xs leading-relaxed text-clay-text-secondary">{description}</p>
      )}
    </div>
  );
}

/** Warning strip for conflicting/outdated/partial evidence. */
export function WarningStrip({ warnings }: { warnings: string[] }) {
  if (warnings.length === 0) return null;
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
      <div className="flex items-center gap-2 text-amber-800">
        <AlertTriangle className="h-4 w-4" />
        <span className="text-xs font-bold">تحذيرات</span>
      </div>
      <ul className="mt-1.5 list-inside list-disc space-y-1 text-xs leading-relaxed text-amber-800/90">
        {warnings.map((w, i) => (
          <li key={i}>{w}</li>
        ))}
      </ul>
    </div>
  );
}

/** Confidence meter — retrieval/evidence/citation quality, never legal truth. */
export function ConfidenceMeter({
  confidence,
}: {
  confidence: {
    retrievalQuality: number;
    evidenceQuality: number;
    citationQuality: number;
    temporalValidity: number;
    answerSupport: number;
    overall: number;
  };
}) {
  const rows: Array<[string, number]> = [
    ["جودة الاسترجاع", confidence.retrievalQuality],
    ["جودة الأدلة", confidence.evidenceQuality],
    ["جودة الإسناد", confidence.citationQuality],
    ["الصلاحية الزمنية", confidence.temporalValidity],
    ["دعم الإجابة", confidence.answerSupport],
  ];
  return (
    <div className="clay-card-soft p-4">
      <div className="mb-2 flex items-center gap-2">
        <ShieldCheck className="h-4 w-4 text-primary" />
        <span className="text-sm font-bold">قياس الثقة</span>
        <span className="ms-auto text-xs text-clay-text-secondary">
          مؤشرات جودة تقنية — ليست حكماً قانونياً
        </span>
      </div>
      <div className="space-y-2">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-center gap-2">
            <span className="w-24 shrink-0 text-[11px] text-clay-text-secondary">{label}</span>
            <div className="clay-inset h-2 flex-1 overflow-hidden">
              <div
                className="h-full rounded-full bg-primary/70"
                style={{ width: `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%` }}
              />
            </div>
            <span className="w-9 text-end text-[11px] font-bold text-clay-text-secondary">
              {Math.round(Math.max(0, Math.min(1, value)) * 100)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
