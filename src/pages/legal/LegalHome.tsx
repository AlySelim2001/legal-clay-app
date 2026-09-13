import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  ArrowLeft,
  BookOpen,
  Building2,
  FileSearch,
  GraduationCap,
  Landmark,
  MessageCircleQuestion,
  Route,
  ShieldQuestion,
} from "lucide-react";
import { useEffect } from "react";
import { Link } from "react-router";
import { CONVEX_URL } from "@/contexts/ConvexProvider";
import { LegalDisclaimerCard } from "@/components/legal/ui";

/**
 * Home of the knowledge platform: knowledge status, primary actions,
 * recent activity, and the mandatory disclaimer. Arabic-first RTL.
 */

const actions = [
  {
    to: "/app/legal/ask",
    icon: MessageCircleQuestion,
    title: "اسأل سؤالاً قانونياً",
    desc: "إجابة مبنية على مصادر مع عرض الأدلة",
    tone: "bg-sky-100 text-sky-700",
  },
  {
    to: "/app/legal/search",
    icon: FileSearch,
    title: "ابحث في القانون",
    desc: "بحث هجين في المواد والمصادر",
    tone: "bg-violet-100 text-violet-700",
  },
  {
    to: "/app/legal/next-steps",
    icon: Route,
    title: "ماذا أفعل الآن؟",
    desc: "خطوات إجرائية مبنية على المصادر",
    tone: "bg-emerald-100 text-emerald-700",
  },
  {
    to: "/app/legal/authorities",
    icon: Building2,
    title: "تروح فين؟ وتتعامل مع مين؟",
    desc: "دليل الجهات الرسمية وخدماتها",
    tone: "bg-amber-100 text-amber-700",
  },
  {
    to: "/app/legal/documents",
    icon: BookOpen,
    title: "حلل مستنداً",
    desc: "استخراج الحقائق والتواريخ والمراجع",
    tone: "bg-rose-100 text-rose-700",
  },
  {
    to: "/app/legal/rights",
    icon: GraduationCap,
    title: "اعرف حقك",
    desc: "حقوقك وواجباتك بلغة مبسطة",
    tone: "bg-teal-100 text-teal-700",
  },
];

export default function LegalHome() {
  const seed = useMutation(api.knowledge.seedKnowledge);
  const welcome = useMutation(api.workspace.ensureWelcome);
  const sources = useQuery(api.legal.listSources, { limit: 100 });
  const history = useQuery(api.legal.answerHistory, { limit: 5 });

  useEffect(() => {
    void seed();
    void welcome();
  }, [seed, welcome]);

  const published = (sources ?? []).filter((s) => s.status === "PUBLISHED").length;
  const articles = published;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Hero */}
      <section className="clay-card p-6 md:p-8">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-primary/10 p-3">
            <Landmark className="h-8 w-8 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-clay-text">منصة القانون المصري</h1>
            <p className="text-sm text-clay-text-secondary">
              دليلك الموثوق لفهم حقوقك وإجراءاتك — كل معلومة بمصدرها
            </p>
          </div>
        </div>

        {/* Knowledge status */}
        <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="clay-inset p-3 text-center">
            <p className="text-xl font-black text-primary">{CONVEX_URL ? published : "—"}</p>
            <p className="text-[11px] text-clay-text-secondary">مصدر منشور</p>
          </div>
          <div className="clay-inset p-3 text-center">
            <p className="text-xl font-black text-primary">{CONVEX_URL ? articles : "—"}</p>
            <p className="text-[11px] text-clay-text-secondary">مواد ومراجع</p>
          </div>
          <div className="clay-inset p-3 text-center">
            <p className="text-xl font-black text-primary">مُراجَع بشرياً</p>
            <p className="text-[11px] text-clay-text-secondary">حالة المعرفة</p>
          </div>
          <div className="clay-inset p-3 text-center">
            <p className="text-xl font-black text-primary">ديسمبر ٢٠٢٥</p>
            <p className="text-[11px] text-clay-text-secondary">آخر تحديث</p>
          </div>
        </div>
      </section>

      {/* Primary actions */}
      <section>
        <h2 className="mb-3 text-lg font-black text-clay-text">ماذا تريد أن تفعل؟</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {actions.map((a) => (
            <Link
              key={a.to}
              to={a.to}
              className="clay-card group flex items-start gap-3 p-4 transition-transform hover:-translate-y-0.5"
            >
              <div className={`rounded-xl p-2.5 ${a.tone}`}>
                <a.icon className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1 text-sm font-bold text-clay-text">
                  {a.title}
                  <ArrowLeft className="h-3.5 w-3.5 opacity-0 transition-opacity group-hover:opacity-100" />
                </p>
                <p className="mt-0.5 text-xs text-clay-text-secondary">{a.desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Recent activity */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-black text-clay-text">نشاطك الأخير</h2>
          <Link to="/app/legal/history" className="text-xs font-bold text-primary hover:underline">
            عرض الكل
          </Link>
        </div>
        {!CONVEX_URL ? (
          <div className="clay-card-soft p-4 text-sm text-clay-text-secondary">
            منصة المعرفة غير مُهيأة في هذه البيئة (VITE_CONVEX_URL مفقود).
          </div>
        ) : history === undefined ? (
          <div className="clay-card-soft h-20 animate-pulse" />
        ) : history.length === 0 ? (
          <div className="clay-card-soft p-4 text-sm text-clay-text-secondary">
            لا يوجد نشاط بعد — ابدأ بسؤال قانوني أو بحث في المصادر.
          </div>
        ) : (
          <div className="space-y-2">
            {history.map((h) => (
              <Link
                key={h._id}
                to={`/app/legal/ask?answerId=${h._id}`}
                className="clay-card-soft flex items-center gap-3 p-3 transition-colors hover:bg-clay-surface"
              >
                <ShieldQuestion className="h-4 w-4 shrink-0 text-primary" />
                <span className="truncate text-sm text-clay-text">{h.question}</span>
                <span className="ms-auto shrink-0 text-[10px] text-clay-text-secondary">
                  {new Date(h.createdAt).toLocaleDateString("ar-EG")}
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>

      <LegalDisclaimerCard />
    </div>
  );
}
