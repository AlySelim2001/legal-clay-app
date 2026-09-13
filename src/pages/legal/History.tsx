import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { History as HistoryIcon, MessageCircleQuestion } from "lucide-react";
import { Link } from "react-router";
import { CONVEX_URL } from "@/contexts/ConvexProvider";
import { EmptyState, StatusBadge } from "@/components/legal/ui";

/**
 * سجل البحث — the user's past questions. Answers link back to the full
 * citation view. Private to the signed-in identity.
 */

interface AnswerRow {
  _id: string;
  question: string;
  evidenceStatus: string;
  queryType: string;
  createdAt: number;
}

const QUERY_TYPE_LABELS: Record<string, string> = {
  LEGAL_DEFINITION: "تعريف قانوني",
  LEGAL_ARTICLE: "مادة قانونية",
  PROCEDURE: "إجراء",
  AUTHORITY: "جهة مختصة",
  DOCUMENT: "مستند",
  COMPARISON: "مقارنة",
  EDUCATION: "توعية",
  GENERAL: "عام",
  HIGH_RISK: "حساس",
  TEMPORAL: "زمني",
  CONFLICTING: "متعارض",
  INSUFFICIENT_EVIDENCE: "أدلة غير كافية",
};

export default function History() {
  const answers = useQuery(
    api.legal.answerHistory,
    CONVEX_URL ? { limit: 50 } : "skip",
  ) as AnswerRow[] | undefined;

  if (!CONVEX_URL) {
    return (
      <div className="mx-auto max-w-3xl">
        <EmptyState
          icon={<HistoryIcon className="h-8 w-8 text-muted-foreground" />}
          title="منصة المعرفة غير مُهيأة"
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <h1 className="text-2xl font-black text-clay-text">سجل أسئلتك</h1>
        <p className="text-sm text-clay-text-secondary">
          كل سؤال سابق مع حالة أدلته — اضغط لأي سؤال لعرض الإجابة الكاملة ومصادرها.
        </p>
      </div>

      {answers === undefined ? (
        <div className="space-y-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="clay-card h-16 animate-pulse" />
          ))}
        </div>
      ) : answers.length === 0 ? (
        <EmptyState
          icon={<MessageCircleQuestion className="h-8 w-8 text-muted-foreground" />}
          title="لا يوجد سجل بعد"
          description="ابدأ بطرح سؤالك الأول من صفحة «اسأل القانون»."
        />
      ) : (
        <div className="space-y-2">
          {answers.map((a) => (
            <Link
              key={a._id}
              to={`/app/legal/ask?answerId=${a._id}`}
              className="clay-card flex items-center gap-3 p-4 transition-transform hover:-translate-y-0.5"
            >
              <div className="rounded-xl bg-sky-100 p-2 text-sky-700">
                <MessageCircleQuestion className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-clay-text">{a.question}</p>
                <p className="text-xs text-clay-text-secondary">
                  {QUERY_TYPE_LABELS[a.queryType] ?? a.queryType} ·{" "}
                  {new Date(a.createdAt).toLocaleString("ar-EG")}
                </p>
              </div>
              <StatusBadge status={a.evidenceStatus} />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
