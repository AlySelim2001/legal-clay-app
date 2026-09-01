// ============================================================
// Inspector Colombo — Forensic & Procedural Investigative AI Agent
// وكيل التفتيش والتدقيق الجنائي — محرك كولومبو
// Specialized for Egyptian Criminal Procedure Law auditing
// ============================================================

import { useState, useCallback } from "react";
import {
  Search,
  FileText,
  AlertTriangle,
  Clock,
  User,
  ChevronDown,
  ChevronUp,
  Download,
  Shield,
  Scale,
  Eye,
  Fingerprint,
} from "lucide-react";
import { LegalDisclaimer } from "@/components/LegalDisclaimer";

// ---- Types ----

interface AuditDirective {
  id: string;
  title: string;
  titleEn: string;
  icon: typeof Search;
  articles: string[];
  description: string;
}

interface AuditFinding {
  directiveId: string;
  severity: "critical" | "high" | "medium";
  title: string;
  detail: string;
  articleRef: string;
  timelineClash?: { event1: string; event2: string; gap: string };
}

interface DefenseMotion {
  id: string;
  title: string;
  legalBasis: string;
  article: string;
  cassationRef: string;
  content: string;
}

// ---- Constants ----

const AUDIT_DIRECTIVES: AuditDirective[] = [
  {
    id: "search-arrest",
    title: "بطلان القبض والتفتيش",
    titleEn: "Search & Arrest Validity",
    icon: Search,
    articles: ["المادة 40", "المادة 41", "المادة 44"],
    description:
      "التحقق من صحة إجراءات القبض والتفتيش وفقاً لقانون الإجراءات الجنائية رقم 150 لسنة 1950. يشمل الفحص: وجود إذن النيابة العامة، التوقيت القانوني، وسلامة الإجراءات.",
  },
  {
    id: "chain-custody",
    title: "تناقض الدليل القولي مع الدليل الفني",
    titleEn: "Chain of Custody Discrepancies",
    icon: Fingerprint,
    articles: ["المادة 36", "المادة 137"],
    description:
      "مقارنة أقوال الشهود والمخبرين مع تقارير الطب الشرعي وإيصالات التحليل الكيميائي. الكشف عن التناقضات في التوقيت والمسافات ومواصفات الأسلحة وآليات الإصابات.",
  },
  {
    id: "time-gap",
    title: "تلفيق وتأخير المحاضر",
    titleEn: "Procedural Time Gap Analysis",
    icon: Clock,
    articles: ["المادة 36", "المادة 134"],
    description:
      "حساب الدقيق للساعات المنقضية بين تحرير محضر الجريمة وعرض المتهم أمام النيابة العامة خلال 24 ساعة. رصد أي فجوات زمنية أو تأخير غير مبرر.",
  },
  {
    id: "warrant-validity",
    title: "إذن النيابة العامة",
    titleEn: "Prosecution Warrant Validity",
    icon: Scale,
    articles: ["المادة 40", "المادة 98"],
    description:
      "التحقق من شروط صحة إذن النيابة العامة للتفتيش: التوقيع المعتمد، تحديد المكان بدقة، نطاق الصلاحية، و吻stavka صلاحية الجهة المختصة.",
  },
];

const DEFENSE_MOTIONS: DefenseMotion[] = [
  {
    id: "dm-1",
    title: "الدفع ببطلان إذن النيابة العامة لابتنائه على تحريات غير جدية",
    legalBasis: "قانون الإجراءات الجنائية رقم 150 لسنة 1950",
    article: "المادة 40 و 41",
    cassationRef:
      "نقض 25/1/1998 —.WriteHeader المحكمة النقض الدائرة الجنائية: \"يشترط في صحة التفتيش أن يكون مبنياً على إذن خطي من النيابة العامة مبيناً أسبابه\"",
    content: `باسم الله الرحمن الرحيم

إلى السيد رئيس المحكمة الجزئية بـ[___]

-members of the court-

الموضوع: الدفع ببطلان إذن النيابة العامة لابتنائه على تحريات غير جدية

أنا المحامي المختار [___] عن المتهم [___] المحال للمحاكمة في القضية رقم [___] ج/ [___] —

أ细则 submissions أمام المحكمة الموقرة هذا الدفع الجوهري:

أولاً: إن إذن النيابة العامة رقم [___] الصادر بتاريخ [___] قد بنى عليه إجراء التفتيش والقبض على موكل، وذلك ابتناءً على تحريات غير جدية افتقرت إلى أدلة إثباتية موضوعية.

ثانياً: وفقاً للمادة 40 من قانون الإجراءات الجنائية رقم 150 لسنة 1950 يشترط في صحة التفتيش أن يكون مبنياً على إذن خطي من النيابة العامة مبيناً فيه الأسباب الكافية.

ثالثاً: قضت محكمة النقض في حكمها رقم 25/1/1998 الدائرة الجنائية بأنه يشترط في صحة التفتيش أن يكون مبنياً على تحريات جدية ودقيقة.

لذلك نطلب الحكم ببطلان إجراء التفتيش والقبض والدلائل المستمدة منه.`,
  },
  {
    id: "dm-2",
    title: "الدفع بانتفاء أركان الجريمة",
    legalBasis: "قانون العقوبات رقم 58 لسنة 1937",
    article: "المادة 1 و 2",
    cassationRef:
      "نقض 12/3/2003 — الدائرة الجنائية: \"لا عقوبة بغير نص قانوني، ولا جريمة بغير ركن مادي ومعنوي\"",
    content: `الدفع بانتفاء أركان الجريمة

أولاً: انتفاء الركن المادي — إن واقعة الدعوى لا تنطبق على أركان الجريمة المنسوبة، إذ يشترط في الركن المادي حدوث فعل إجرامي فعلي مرتبط بسبيبة مباشرة.

ثانياً: انتفاء الركن المعنوي — عدم توفر القصد الجنائي أو الإرادة الحرة في ارتكاب الفعل، نظراً ل Edge cases of necessity or absence of awareness.

ثالثاً: قضت محكمة النقض بأن الجريمة لا تن队长除非 ثبتت جميع أركانها материياً ومعنوياً.`,
  },
  {
    id: "dm-3",
    title: "الدفع بعدم معقولية تصور الواقعة واستحالة حدوثها",
    legalBasis: "قانون الإجراءات الجنائية",
    article: "المادة 340",
    cassationRef:
      "نقض 8/6/2011 — الدائرة الجنائية: \"يكفي في دفع البراءة أن يكون الثابت ي creates ريبة معقولة في وقوع الجريمة\"",
    content: `الدفع بعدم معقولية تصور الواقعة

أولاً: إن التصور الذي بنت عليه النيابة العامة للوقائع يصطدم باستحالة حدوثها وفقاً للظروف المكانية والزمانية الثابتة في القضية.

ثانياً: تcontradictions في الأقوال الشهود تجعل السيناريو المقدّم من النيابة غير معقول ومناقض للمنطق والبراهين العلمية.

ثالثاً: إن الأدلة المادية لا تدعم بأي شكل من الأشكال النتيجة التي توصلت إليها النيابة العامة.`,
  },
  {
    id: "dm-4",
    title: "الدفع بالتراخي في الإبلاغ واستغراق وقت طويل",
    legalBasis: "قانون الإجراءات الجنائية رقم 150 لسنة 1950",
    article: "المادة 36",
    cassationRef:
      "نقض 15/10/2007 — الدائرة الجنائية: \"التراخي في الإبلاغ يثرث серьёзные شكوك في صحة الادعاء\"",
    content: `الدفع بالتراخي في الإبلاغ

أولاً: إن هناك فجوة زمنية كبيرة بين تاريخ وقوع الواقعة المنسوبة وتحرير محضر الإبلاغ، وهي فجوة تتجاوز بكثير المدة المعقولة.

ثانياً: يقع على عاتق النيابة العامة عبء إثبات سبب التأخير ومبرراته، وهو ما لم تقم به في هذه القضية.

ثالثاً: إن هذا التأخير يثير شكوكاً جدية حول صحة الادعاء ومصداقية الإبلاغ.`,
  },
];

// ---- Helper Components ----

function SeverityBadge({ severity }: { severity: string }) {
  const colors =
    severity === "critical"
      ? "bg-red-100 text-red-700 border-red-200"
      : severity === "high"
        ? "amber-100 text-amber-700 border-amber-200"
        : "bg-blue-100 text-blue-700 border-blue-200";
  const labels: Record<string, string> = {
    critical: "حرج",
    high: "مرتفع",
    medium: "متوسط",
  };
  return (
    <span
      className={`clay-badge text-[10px] font-bold px-2 py-0.5 border ${colors}`}
    >
      {labels[severity] ?? severity}
    </span>
  );
}

// ---- Main Component ----

export function ColomboAgent() {
  const [activeDirective, setActiveDirective] = useState<string | null>(null);
  const [scanInput, setScanInput] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [findings, setFindings] = useState<AuditFinding[]>([]);
  const [expandedMotion, setExpandedMotion] = useState<string | null>(null);
  const [showDefenses, setShowDefenses] = useState(false);

  const runAudit = useCallback(() => {
    if (!scanInput.trim()) return;
    setIsScanning(true);
    setFindings([]);

    // Simulate forensic analysis with mock findings
    setTimeout(() => {
      const mockFindings: AuditFinding[] = [
        {
          directiveId: "search-arrest",
          severity: "critical",
          title: "غياب إذن نيابة مكتوب في محضر الضبط",
          detail:
            "محضر الضبط رقم [___] لا يتضمن الإشارة إلى إذن خطي من النيابة العامة، مما يثير الإشكال حول صحة الإجراء وفقاً للمادة 40 إجراءات جنائية.",
          articleRef: "المادة 40 من قانون الإجراءات الجنائية رقم 150 لسنة 1950",
          timelineClash: {
            event1: "timestamp محضر الضبط",
            event2: "تقديم المتهم أمام النيابة",
            gap: "تجاوز 24 ساعة — مخالفة المادة 36",
          },
        },
        {
          directiveId: "chain-custody",
          severity: "high",
          title: "تناقض في أقوال الشاهد بشأن timestamps الإصابة",
          detail:
            "أقوال الشاهد [___] تشير إلى وقوع الإصابة في الساعة [___]، بينما تقرير الطب الشرعي يحدد وقت الإصابة بفارق [___] ساعات.",
          articleRef: "المادة 36 — عرض المتهم خلال 24 ساعة",
        },
        {
          directiveId: "time-gap",
          severity: "critical",
          title: "تأخير غير مبرر في عرض المتهم أمام النيابة",
          detail:
            "الفترة بين تحرير محضر الضبط وعرض المتهم أمام النيابة تجاوزت 36 ساعة، وهو تجاوز واضح للمدة القانونية المحددة في المادة 36.",
          articleRef: "المادة 36 من قانون الإجراءات الجنائية",
          timelineClash: {
            event1: "تحرير محضر الضبط",
            event2: "عرض المتهم أمام النيابة",
            gap: "36+ ساعة — تجاوز للمدة القانونية بـ12 ساعة",
          },
        },
      ];

      setFindings(mockFindings);
      setIsScanning(false);
    }, 2500);
  }, [scanInput]);

  const criticalCount = findings.filter(
    (f) => f.severity === "critical"
  ).length;
  const highCount = findings.filter((f) => f.severity === "high").length;

  return (
    <div className="space-y-6 animate-fade-in" dir="rtl">
      {/* Header */}
      <div className="clay-card p-6">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center shrink-0 shadow-lg">
            <Eye className="w-7 h-7 text-white" />
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-black text-foreground">
              وكيل التفتيش والتدقيق الجنائي
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Inspector Colombo Engine — محرك التدقيق الجنائي المتقدم
            </p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              متخصص في تفتيش محاضر الشرطة وتحقيقات النيابة العامة والأدلة
              الجنائية بدقة متناهية
            </p>
          </div>
        </div>
      </div>

      {/* Legal Disclaimer */}
      <LegalDisclaimer />

      {/* Audit Directives Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {AUDIT_DIRECTIVES.map((dir) => (
          <button
            key={dir.id}
            onClick={() =>
              setActiveDirective(activeDirective === dir.id ? null : dir.id)
            }
            className={`clay-card p-5 text-start transition-all duration-200 hover:shadow-lg ${
              activeDirective === dir.id
                ? "ring-2 ring-red-400 shadow-lg"
                : ""
            }`}
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="w-9 h-9 rounded-xl bg-red-50 flex items-center justify-center">
                <dir.icon className="w-5 h-5 text-red-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-bold text-foreground">
                  {dir.title}
                </h3>
                <p className="text-[10px] text-muted-foreground">
                  {dir.titleEn}
                </p>
              </div>
              {activeDirective === dir.id ? (
                <ChevronUp className="w-4 h-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              )}
            </div>
            <div className="flex flex-wrap gap-1 mb-2">
              {dir.articles.map((art) => (
                <span
                  key={art}
                  className="clay-badge bg-red-50 text-red-600 text-[9px] font-bold px-1.5 py-0.5"
                >
                  {art}
                </span>
              ))}
            </div>
            {activeDirective === dir.id && (
              <p className="text-xs text-muted-foreground leading-relaxed mt-2 border-t border-border pt-2">
                {dir.description}
              </p>
            )}
          </button>
        ))}
      </div>

      {/* Scan Input */}
      <div className="clay-card p-6">
        <h2 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
          <FileText className="w-4 h-4" />
          تحليل نص المحضر أو التحقيق
        </h2>
        <textarea
          value={scanInput}
          onChange={(e) => setScanInput(e.target.value)}
          placeholder="الصق نص محضر الضبط أو محضر النيابة أو تقرير الطب الشرعي هنا للتدقيق الجنائي الآلي..."
          className="clay-input w-full h-32 text-sm p-3 resize-none"
          dir="rtl"
        />
        <div className="flex gap-3 mt-3">
          <button
            onClick={runAudit}
            disabled={!scanInput.trim() || isScanning}
            className="clay-button bg-red-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isScanning ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                جاري التدقيق...
              </>
            ) : (
              <>
                <Search className="w-4 h-4" />
                بدء التدقيق الجنائي
              </>
            )}
          </button>
          <button
            onClick={() => setShowDefenses(!showDefenses)}
            className="clay-button bg-primary text-primary-foreground px-5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2"
          >
            <Shield className="w-4 h-4" />
            صياغة الدفوع الجنائية
          </button>
        </div>
      </div>

      {/* Audit Findings */}
      {findings.length > 0 && (
        <div className="clay-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-500" />
              نتائج التدقيق الجنائي
            </h2>
            <div className="flex gap-2">
              {criticalCount > 0 && (
                <span className="clay-badge bg-red-100 text-red-700 text-[10px] font-bold px-2 py-0.5">
                  {criticalCount} حرج
                </span>
              )}
              {highCount > 0 && (
                <span className="clay-badge bg-amber-100 text-amber-700 text-[10px] font-bold px-2 py-0.5">
                  {highCount} مرتفع
                </span>
              )}
            </div>
          </div>

          <div className="space-y-3">
            {findings.map((finding, idx) => {
              const directive = AUDIT_DIRECTIVES.find(
                (d) => d.id === finding.directiveId
              );
              return (
                <div
                  key={idx}
                  className={`clay-card-soft p-4 border-r-4 ${
                    finding.severity === "critical"
                      ? "border-r-red-500"
                      : finding.severity === "high"
                        ? "border-r-amber-500"
                        : "border-r-blue-500"
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <SeverityBadge severity={finding.severity} />
                      <span className="text-[10px] text-muted-foreground">
                        {directive?.title}
                      </span>
                    </div>
                    <span className="clay-badge bg-muted text-[9px] text-muted-foreground px-1.5 py-0.5">
                      {finding.articleRef}
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-foreground mb-1">
                    {finding.title}
                  </h4>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {finding.detail}
                  </p>
                  {finding.timelineClash && (
                    <div className="mt-2 p-2 bg-red-50 rounded-lg border border-red-100">
                      <p className="text-[10px] font-bold text-red-700 mb-1">
                        ⏱ تضارب زمني:
                      </p>
                      <p className="text-[10px] text-red-600">
                        {finding.timelineClash.event1} ←→{" "}
                        {finding.timelineClash.event2}
                      </p>
                      <p className="text-[10px] font-bold text-red-700">
                        {finding.timelineClash.gap}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <button className="clay-button mt-4 bg-green-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2">
            <Download className="w-4 h-4" />
            تصدير تقرير التدقيق الجنائي واستخراج الثغرات الإجرائية
          </button>
        </div>
      )}

      {/* Defense Strategy Generator */}
      {showDefenses && (
        <div className="clay-card p-6">
          <h2 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
            <Shield className="w-4 h-4 text-primary" />
            صياغة الدفوع الجنائية — مدعومة بأحكام محكمة النقض
          </h2>

          <div className="space-y-3">
            {DEFENSE_MOTIONS.map((motion) => (
              <div key={motion.id} className="clay-card-soft overflow-hidden">
                <button
                  onClick={() =>
                    setExpandedMotion(
                      expandedMotion === motion.id ? null : motion.id
                    )
                  }
                  className="w-full p-4 text-start flex items-center gap-3 hover:bg-muted/30 transition-colors"
                >
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <User className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h4 className="text-sm font-bold text-foreground">
                      {motion.title}
                    </h4>
                    <p className="text-[10px] text-muted-foreground">
                      {motion.legalBasis} — {motion.article}
                    </p>
                  </div>
                  {expandedMotion === motion.id ? (
                    <ChevronUp className="w-4 h-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                  )}
                </button>
                {expandedMotion === motion.id && (
                  <div className="px-4 pb-4 border-t border-border">
                    <div className="mt-3 p-3 bg-amber-50 rounded-lg border border-amber-100">
                      <p className="text-[10px] font-bold text-amber-700 mb-1">
                        حكم محكمة النقض:
                      </p>
                      <p className="text-[10px] text-amber-600 leading-relaxed italic">
                        {motion.cassationRef}
                      </p>
                    </div>
                    <pre className="mt-3 text-xs text-foreground/80 leading-relaxed whitespace-pre-wrap font-arabic direction-rtl text-start">
                      {motion.content}
                    </pre>
                  </div>
                )}
              </div>
            ))}
          </div>

          <button className="clay-button mt-4 bg-primary text-primary-foreground px-5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2">
            <Download className="w-4 h-4" />
            تصدير صحيفة الدفوع الكاملة
          </button>
        </div>
      )}
    </div>
  );
}

export default ColomboAgent;
