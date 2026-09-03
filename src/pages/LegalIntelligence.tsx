import { useCallback, useRef, useState } from "react";
import {
  PenLine,
  Trash2,
  ShieldCheck,
  Fingerprint,
  LineChart,
  TrendingUp,
  Share2,
  Network,
  Search,
  Loader2,
  AlertTriangle,
  FileSignature,
  GitBranch,
} from "lucide-react";
import {
  getESignatureService,
  EGYPTIAN_ESIGN_LAW,
  buildSignatureCertificate,
  type SignatureResult,
} from "@/lib/e-signature";
import {
  getPredictiveAnalyticsEngine,
  type CaseProfile,
  type PredictionResult,
} from "@/lib/predictive-analytics";
import {
  getEgyptianKnowledgeGraph,
  type KnowledgeNode,
  type GraphTraversal,
} from "@/lib/knowledge-graph";

// ============================================================
// Shared disclaimer
// ============================================================

const LEGAL_DISCLAIMER =
  "جميع البيانات والإجراءات مقترحة تحتاج إلى مراجعة واعتماد محامٍ مختص";

// ============================================================
// E-Signature Tab
// ============================================================

function SignaturePad({
  onDataUrl,
}: {
  onDataUrl: (dataUrl: string) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);

  const getCanvas = () => canvasRef.current;

  const getPosition = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = getCanvas();
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    drawingRef.current = true;
    const canvas = getCanvas();
    const pos = getPosition(e);
    if (!canvas || !pos) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#1e293b";
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    const canvas = getCanvas();
    const pos = getPosition(e);
    if (!canvas || !pos) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    onDataUrl(canvas.toDataURL("image/png"));
  };

  const stopDrawing = () => {
    drawingRef.current = false;
  };

  const clear = () => {
    const canvas = getCanvas();
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    onDataUrl("");
  };

  return (
    <div className="space-y-2">
      <canvas
        ref={canvasRef}
        width={560}
        height={160}
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={stopDrawing}
        onMouseLeave={stopDrawing}
        className="w-full rounded-xl border-2 border-dashed border-clay-border bg-white dark:bg-background touch-none"
      />
      <button
        onClick={clear}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-destructive transition-colors"
      >
        <Trash2 className="w-3.5 h-3.5" />
        مسح التوقيع
      </button>
    </div>
  );
}

function ESignatureTab() {
  const [docContent, setDocContent] = useState("");
  const [signerName, setSignerName] = useState("");
  const [signerId, setSignerId] = useState("");
  const [signatureImage, setSignatureImage] = useState("");
  const [result, setResult] = useState<SignatureResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const handleSign = useCallback(async () => {
    setError("");
    setBusy(true);
    try {
      const service = getESignatureService();
      const res = await service.sign({
        documentContent: docContent,
        signatureImage,
        signerName,
        signerIdNumber: signerId || undefined,
        role: "محامٍ",
      });
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "حدث خطأ أثناء التوقيع");
    } finally {
      setBusy(false);
    }
  }, [docContent, signatureImage, signerName, signerId]);

  const handleVerify = useCallback(async () => {
    if (!result) return;
    setError("");
    setBusy(true);
    try {
      const service = getESignatureService();
      const verification = await service.verify(
        {
          documentContent: docContent,
          signatureImage,
          signerName,
          signerIdNumber: signerId || undefined,
          role: "محامٍ",
        },
        result.fingerprint,
      );
      setError(verification.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : "حدث خطأ أثناء التحقق");
    } finally {
      setBusy(false);
    }
  }, [docContent, signatureImage, signerName, signerId, result]);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="clay-card p-4 space-y-3">
        <div className="flex items-center gap-2">
          <FileSignature className="w-5 h-5 text-clay-purple" />
          <h3 className="text-sm font-bold font-arabic">التوقيع الإلكتروني للمستندات</h3>
        </div>

        <textarea
          value={docContent}
          onChange={(e) => setDocContent(e.target.value)}
          rows={4}
          placeholder="محتوى المستند المراد توقيعه..."
          className="clay-input w-full rounded-xl border bg-white px-3 py-2 text-sm dark:bg-background font-arabic"
        />

        <input
          value={signerName}
          onChange={(e) => setSignerName(e.target.value)}
          placeholder="اسم الموقّع (كما في بطاقة الهوية)"
          className="clay-input w-full rounded-xl border bg-white px-3 py-2 text-sm dark:bg-background font-arabic"
        />
        <input
          value={signerId}
          onChange={(e) => setSignerId(e.target.value)}
          placeholder="رقم الهوية / نقابة المحامين (اختياري)"
          className="clay-input w-full rounded-xl border bg-white px-3 py-2 text-sm dark:bg-background font-arabic"
        />

        <SignaturePad onDataUrl={setSignatureImage} />

        <button
          onClick={handleSign}
          disabled={busy || !docContent.trim() || !signerName.trim() || !signatureImage}
          className="clay-button w-full rounded-xl bg-clay-purple/10 text-clay-purple px-4 py-2.5 flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Fingerprint className="w-4 h-4" />}
          توقيع المستند إلكترونياً
        </button>

        {result && (
          <button
            onClick={handleVerify}
            disabled={busy}
            className="clay-button w-full rounded-xl bg-clay-green/10 text-clay-green px-4 py-2.5 flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <ShieldCheck className="w-4 h-4" />
            التحقق من سلامة التوقيع
          </button>
        )}

        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-urgency-high/30 bg-urgency-high/10 p-2 text-xs text-foreground font-arabic">
            <AlertTriangle className="w-4 h-4 shrink-0 text-urgency-high" />
            {error}
          </div>
        )}
      </div>

      <div className="space-y-3">
        {result ? (
          <div className="clay-card p-4 space-y-2">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-clay-green" />
              <h4 className="text-sm font-bold font-arabic text-clay-green">تم التوقيع بنجاح</h4>
            </div>
            <p className="text-xs text-muted-foreground font-arabic">{result.summary}</p>
            <div className="rounded-lg bg-muted/40 p-2">
              <p className="text-[10px] text-muted-foreground mb-1">بصمة التوقيع (SHA-256):</p>
              <code className="text-[10px] break-all text-clay-blue" dir="ltr">
                {result.fingerprint}
              </code>
            </div>
            <pre className="text-[10px] leading-4 text-muted-foreground bg-muted/30 rounded-lg p-2 overflow-auto max-h-44 font-arabic" dir="rtl">
              {buildSignatureCertificate(result)}
            </pre>
          </div>
        ) : (
          <div className="clay-card p-4">
            <h4 className="text-sm font-bold font-arabic mb-2">⚖️ الأساس القانوني</h4>
            <p className="text-xs font-semibold text-clay-purple font-arabic mb-2">
              {EGYPTIAN_ESIGN_LAW.law}
            </p>
            <p className="text-[11px] text-muted-foreground font-arabic mb-2">
              {EGYPTIAN_ESIGN_LAW.authority}
            </p>
            <ul className="space-y-1.5">
              {EGYPTIAN_ESIGN_LAW.notes.map((note, i) => (
                <li key={i} className="text-[11px] text-muted-foreground flex gap-1.5 font-arabic">
                  <span className="text-clay-purple">•</span>
                  {note}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="clay-card p-3 flex items-center gap-2">
          <PenLine className="w-4 h-4 text-clay-purple" />
          <p className="text-[10px] text-muted-foreground font-arabic">
            التوقيع الإلكتروني مرتبط تشفيرياً بالمستند والموقّع والوقت — أي تعديل يبطل التوقيع.
          </p>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Predictive Analytics Tab
// ============================================================

const CATEGORY_OPTIONS: Array<{ value: CaseProfile["category"]; label: string }> = [
  { value: "criminal", label: "جنائي" },
  { value: "civil", label: "مدني" },
  { value: "commercial", label: "تجاري" },
  { value: "family", label: "أحوال شخصية" },
  { value: "administrative", label: "إداري" },
  { value: "labor", label: "عمل" },
];

function PredictiveAnalyticsTab() {
  const [category, setCategory] = useState<CaseProfile["category"]>("criminal");
  const [keywords, setKeywords] = useState("");
  const [facts, setFacts] = useState("");
  const [result, setResult] = useState<PredictionResult | null>(null);
  const [busy, setBusy] = useState(false);

  const handlePredict = useCallback(() => {
    setBusy(true);
    // Simulate a short analysis pass for UX clarity
    setTimeout(() => {
      const engine = getPredictiveAnalyticsEngine();
      const prediction = engine.predict({
        category,
        keywords: keywords.split(/[،,]/).map((k) => k.trim()).filter(Boolean),
        facts,
      });
      setResult(prediction);
      setBusy(false);
    }, 400);
  }, [category, keywords, facts]);

  const rateColor =
    (result?.successRate ?? 0) >= 60
      ? "text-clay-green"
      : (result?.successRate ?? 0) >= 40
        ? "text-urgency-high"
        : "text-urgency-critical";

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="clay-card p-4 space-y-3">
        <div className="flex items-center gap-2">
          <LineChart className="w-5 h-5 text-clay-teal" />
          <h3 className="text-sm font-bold font-arabic">التحليل التنبؤي لنتائج القضايا</h3>
        </div>

        <div>
          <label className="text-xs text-muted-foreground font-arabic mb-1 block">التصنيف القانوني</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as CaseProfile["category"])}
            className="clay-input w-full rounded-xl border bg-white px-3 py-2 text-sm dark:bg-background font-arabic"
          >
            {CATEGORY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        <input
          value={keywords}
          onChange={(e) => setKeywords(e.target.value)}
          placeholder="كلمات مفتاحية مفصولة بفواصل (مثال: قتل، دفاع شرعي، ترخيص)"
          className="clay-input w-full rounded-xl border bg-white px-3 py-2 text-sm dark:bg-background font-arabic"
        />

        <textarea
          value={facts}
          onChange={(e) => setFacts(e.target.value)}
          rows={4}
          placeholder="ملخص وقائع القضية..."
          className="clay-input w-full rounded-xl border bg-white px-3 py-2 text-sm dark:bg-background font-arabic"
        />

        <button
          onClick={handlePredict}
          disabled={busy || (!keywords.trim() && !facts.trim())}
          className="clay-button w-full rounded-xl bg-clay-teal/10 text-clay-teal px-4 py-2.5 flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <TrendingUp className="w-4 h-4" />}
          حساب احتمال النجاح
        </button>
      </div>

      <div className="space-y-3">
        {result ? (
          <>
            <div className="clay-card p-4 text-center">
              <p className="text-xs text-muted-foreground font-arabic mb-1">احتمال النتيجة المواتية</p>
              <p className={`text-4xl font-black ${rateColor}`}>{result.successRate}%</p>
              <p className="mt-1 text-[10px] text-muted-foreground font-arabic">
                مستوى الثقة: {result.confidence}
              </p>
              <div className="mt-3 h-2 w-full rounded-full bg-muted overflow-hidden" dir="ltr">
                <div
                  className={`h-full rounded-full ${
                    result.successRate >= 60
                      ? "bg-clay-green"
                      : result.successRate >= 40
                        ? "bg-urgency-high"
                        : "bg-urgency-critical"
                  }`}
                  style={{ width: `${result.successRate}%` }}
                />
              </div>
            </div>

            <div className="clay-card p-4">
              <h4 className="text-sm font-bold font-arabic mb-2">السوابق المتشابهة</h4>
              {result.matchedPrecedents.length === 0 ? (
                <p className="text-xs text-muted-foreground font-arabic">
                  لا توجد سوابق مطابقة في قاعدة البيانات
                </p>
              ) : (
                <div className="space-y-2">
                  {result.matchedPrecedents.map((p) => (
                    <div key={p.precedentId} className="rounded-lg bg-muted/40 p-2">
                      <p className="text-[11px] font-semibold text-foreground font-arabic">
                        {p.precedent}
                      </p>
                      <p className="text-[10px] text-muted-foreground font-arabic mt-0.5">
                        {p.court} — {p.caseNumber} • تشابه {p.score}% • اتجاه: {p.direction}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="clay-card p-3 flex items-start gap-2">
              <Share2 className="w-4 h-4 shrink-0 text-clay-teal mt-0.5" />
              <p className="text-[11px] text-muted-foreground font-arabic leading-relaxed">
                {result.recommendation}
              </p>
            </div>
            <p className="text-[10px] text-muted-foreground font-arabic">{result.disclaimer}</p>
          </>
        ) : (
          <div className="clay-card p-4 flex items-center justify-center min-h-[200px] text-center">
            <div>
              <LineChart className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-xs text-muted-foreground font-arabic">
                أدخل بيانات القضية للحصول على تقدير مبني على تحليل السوابق القضائية
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// Knowledge Graph Tab
// ============================================================

const NODE_TYPE_COLORS: Record<string, string> = {
  law: "bg-clay-purple/15 text-clay-purple border-clay-purple/30",
  article: "bg-clay-blue/15 text-clay-blue border-clay-blue/30",
  precedent: "bg-clay-green/15 text-clay-green border-clay-green/30",
  concept: "bg-clay-rose/15 text-clay-rose border-clay-rose/30",
  deadline: "bg-urgency-high/15 text-urgency-high border-urgency-high/30",
};

function KnowledgeGraphTab() {
  const graph = getEgyptianKnowledgeGraph();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<KnowledgeNode[]>([]);
  const [selected, setSelected] = useState<KnowledgeNode | null>(null);
  const [traversal, setTraversal] = useState<GraphTraversal | null>(null);

  const handleSearch = useCallback(() => {
    if (!query.trim()) return;
    setResults(graph.search(query.trim()));
    setSelected(null);
    setTraversal(null);
  }, [graph, query]);

  const handleSelect = useCallback(
    (node: KnowledgeNode) => {
      setSelected(node);
      setTraversal(graph.traverse({ nodeId: node.id, maxDepth: 2 }));
    },
    [graph],
  );

  const relatedEdges = traversal
    ? traversal.edges.filter((e) => e.source === selected?.id)
    : [];
  const relatedNodeIds = new Set(relatedEdges.map((e) => e.target));
  const relatedNodes = traversal?.nodes.filter((n) => relatedNodeIds.has(n.id)) ?? [];

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="clay-card p-4 space-y-3 lg:col-span-1">
        <div className="flex items-center gap-2">
          <Network className="w-5 h-5 text-clay-rose" />
          <h3 className="text-sm font-bold font-arabic">الرسم البياني المعرفي للقانون المصري</h3>
        </div>

        <div className="flex gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="ابحث عن قانون، مادة، حكم، أو مفهوم..."
            className="clay-input flex-1 rounded-xl border bg-white px-3 py-2 text-sm dark:bg-background font-arabic"
          />
          <button
            onClick={handleSearch}
            className="clay-button rounded-xl bg-clay-rose/10 text-clay-rose px-3"
          >
            <Search className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <GitBranch className="w-3.5 h-3.5" />
          <span className="font-arabic">{graph.getAllNodes().length} عقدة في الرسم البياني</span>
        </div>

        <div className="space-y-1.5 max-h-72 overflow-y-auto">
          {results.length === 0 && query && (
            <p className="text-xs text-muted-foreground font-arabic py-4 text-center">
              لا توجد نتائج مطابقة
            </p>
          )}
          {results.map((node) => (
            <button
              key={node.id}
              onClick={() => handleSelect(node)}
              className={`w-full text-start rounded-xl border px-3 py-2 transition-all ${
                selected?.id === node.id
                  ? "bg-clay-rose/10 border-clay-rose/40"
                  : "border-border hover:bg-muted/50"
              }`}
            >
              <p className="text-[11px] font-semibold text-foreground font-arabic truncate">
                {node.label}
              </p>
              <p className="text-[9px] text-muted-foreground mt-0.5">{node.id}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="clay-card p-4 lg:col-span-2 min-h-[320px]">
        {!selected ? (
          <div className="flex flex-col items-center justify-center h-full py-10 text-center">
            <Network className="w-12 h-12 text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground font-arabic">
              ابحث واختر عقدة لعرض العلاقات القانونية المرتبطة
            </p>
            <p className="text-xs text-muted-foreground/70 mt-1 font-arabic">
              القوانين ← المواد ← الأحكام ← المفاهيم الإجرائية
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className={`rounded-xl border px-3 py-2 ${NODE_TYPE_COLORS[selected.type] ?? "bg-muted"}`}>
              <p className="text-xs font-bold font-arabic">{selected.label}</p>
              <p className="text-[10px] opacity-80 mt-0.5" dir="ltr">{selected.id}</p>
              {selected.properties.court && (
                <p className="text-[10px] opacity-80 mt-0.5 font-arabic">
                  المحكمة: {selected.properties.court} — {selected.properties.caseNumber}
                </p>
              )}
            </div>

            <h4 className="text-xs font-bold text-muted-foreground font-arabic">
              العلاقات المرتبطة ({relatedEdges.length})
            </h4>

            <div className="grid gap-2 sm:grid-cols-2">
              {relatedEdges.length === 0 && (
                <p className="text-xs text-muted-foreground font-arabic col-span-2">
                  لا توجد علاقات مسجلة لهذه العقدة
                </p>
              )}
              {relatedEdges.map((edge, i) => {
                const target = graph.getNode(edge.target);
                if (!target) return null;
                return (
                  <button
                    key={`${edge.source}-${edge.target}-${i}`}
                    onClick={() => handleSelect(target)}
                    className="text-start rounded-xl border border-border p-2 hover:bg-muted/50 transition-all"
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className={`rounded-full border px-1.5 py-0.5 text-[9px] ${NODE_TYPE_COLORS[target.type] ?? "bg-muted"}`}>
                        {target.type}
                      </span>
                      <span className="text-[9px] text-muted-foreground">{edge.label ?? edge.type}</span>
                    </div>
                    <p className="text-[11px] text-foreground font-arabic truncate">{target.label}</p>
                  </button>
                );
              })}
            </div>

            {relatedNodes.length > 0 && (
              <div className="rounded-lg bg-muted/30 p-2">
                <p className="text-[10px] text-muted-foreground mb-1 font-arabic">
                  عقد ضمن عمق علاقتين من العقدة المحددة: {relatedNodes.length}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// Main Page
// ============================================================

type TabId = "signature" | "analytics" | "graph";

const TABS: Array<{ id: TabId; label: string; icon: React.ElementType }> = [
  { id: "signature", label: "التوقيع الإلكتروني", icon: FileSignature },
  { id: "analytics", label: "التحليلات التنبؤية", icon: LineChart },
  { id: "graph", label: "الرسم المعرفي", icon: Network },
];

export default function LegalIntelligence() {
  const [tab, setTab] = useState<TabId>("signature");

  return (
    <div className="space-y-4" dir="rtl">
      {/* Header */}
      <div className="clay-card p-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-clay-purple/15 flex items-center justify-center">
            <BrainIcon />
          </div>
          <div>
            <h2 className="text-lg font-black font-arabic text-foreground">
              منصة الاستخبارات القانونية
            </h2>
            <p className="text-xs text-muted-foreground font-arabic mt-0.5">
              أدوات مجانية متقدمة: التوقيع الإلكتروني، التحليلات التنبؤية، والرسم البياني المعرفي للقانون المصري
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold font-arabic whitespace-nowrap transition-all ${
                active
                  ? "bg-clay-purple text-white shadow-md"
                  : "bg-muted/50 text-muted-foreground hover:bg-muted"
              }`}
            >
              <Icon className="w-4 h-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === "signature" && <ESignatureTab />}
      {tab === "analytics" && <PredictiveAnalyticsTab />}
      {tab === "graph" && <KnowledgeGraphTab />}

      {/* Disclaimer */}
      <div className="flex items-center gap-2 border-t border-clay-border pt-3">
        <AlertTriangle className="w-3.5 h-3.5 text-urgency-high shrink-0" />
        <p className="text-[10px] text-muted-foreground font-arabic">{LEGAL_DISCLAIMER}</p>
      </div>
    </div>
  );
}

function BrainIcon() {
  return (
    <svg
      className="w-6 h-6 text-clay-purple"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z" />
      <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z" />
    </svg>
  );
}