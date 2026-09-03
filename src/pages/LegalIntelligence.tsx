import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  BookOpen,
  Database,
  FileCheck,
  FileSearch,
  Link2,
  Lock,
  CheckCircle2,
  XCircle,
  ShieldAlert,
  Clock,
  Copy,
  Download,
  Mic,
  Square,
  BrainCircuit,
  Save,
  ListChecks,
  Scale,
} from "lucide-react";
import {
  getESignatureService,
  EGYPTIAN_ESIGN_LAW,
  buildSignatureCertificate,
  type SignatureResult,
} from "@/lib/e-signature";
import {
  getMikeLegalIntegration,
  type ContractAnalysis,
  type ResearchResults,
} from "@/integrations/mike-legal";
import {
  getBlockchainDocumentVerifier,
  hashDocument,
  type IntegrityResult,
  type VerificationProof,
} from "@/blockchain/document-verification";
import {
  VOSK_DEMO_MODELS,
  VoiceRecorder,
  type RecorderState,
  type SpeechEngine,
} from "@/lib/voice-to-text";
import {
  CourtSessionVoiceRecorder,
  analyzeSessionTranscript,
  saveSessionTranscript,
  type SessionAnalysis,
} from "@/voice/court-session-recorder";
import type { LegalCategory } from "@/legal-db/egyptian-codes";
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
// Legal Research Tab (hybrid RAG + contract analysis)
// ============================================================

const RESEARCH_CATEGORIES: Array<{ value: LegalCategory | "all"; label: string }> = [
  { value: "all", label: "جميع التصنيفات" },
  { value: "criminal", label: "جنائي" },
  { value: "civil", label: "مدني" },
  { value: "commercial", label: "تجاري" },
  { value: "family", label: "أحوال شخصية" },
  { value: "administrative", label: "إداري" },
  { value: "labor", label: "عمل" },
  { value: "intellectual-property", label: "ملكية فكرية" },
  { value: "arbitration", label: "تحكيم" },
  { value: "bankruptcy", label: "إفلاس" },
  { value: "execution", label: "تنفيذ" },
  { value: "forensic", label: "تفتيش جنائي" },
];

const SEVERITY_STYLES: Record<
  ContractAnalysis["findings"][number]["severity"],
  string
> = {
  high: "border-urgency-critical/30 bg-urgency-critical/10 text-urgency-critical",
  medium: "border-urgency-high/30 bg-urgency-high/10 text-urgency-high",
  low: "border-clay-green/30 bg-clay-green/10 text-clay-green",
  info: "border-clay-blue/30 bg-clay-blue/10 text-clay-blue",
};

const FINDING_TYPE_LABELS: Record<
  ContractAnalysis["findings"][number]["type"],
  string
> = {
  risk: "خطر",
  compliance: "امتثال",
  clause: "بند",
  observation: "ملاحظة",
};

function LegalResearchTab() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<LegalCategory | "all">("all");
  const [results, setResults] = useState<ResearchResults | null>(null);
  const [busy, setBusy] = useState(false);
  const [contractText, setContractText] = useState("");
  const [analysis, setAnalysis] = useState<ContractAnalysis | null>(null);
  const [analysisBusy, setAnalysisBusy] = useState(false);

  const stats = useMemo(
    () => getMikeLegalIntegration().getDatabaseStats(),
    [],
  );

  const handleSearch = useCallback(async () => {
    if (!query.trim()) return;
    setBusy(true);
    try {
      const mike = getMikeLegalIntegration();
      const res = await mike.legalResearch(query.trim(), {
        category: category === "all" ? undefined : category,
        maxResults: 8,
      });
      setResults(res);
    } finally {
      setBusy(false);
    }
  }, [query, category]);

  const handleAnalyze = useCallback(async () => {
    if (!contractText.trim()) return;
    setAnalysisBusy(true);
    try {
      const mike = getMikeLegalIntegration();
      const res = await mike.analyzeContract(contractText);
      setAnalysis(res);
    } finally {
      setAnalysisBusy(false);
    }
  }, [contractText]);

  return (
    <div className="space-y-4">
      {/* Research search */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="clay-card p-4 space-y-3 lg:col-span-1">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-clay-teal" />
            <h3 className="text-sm font-bold font-arabic">البحث القانوني والاسترجاع الذكي</h3>
          </div>

          <div className="flex gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="مثال: ميعاد الطعن بالنقض في الجنايات..."
              className="clay-input flex-1 rounded-xl border bg-white px-3 py-2 text-sm dark:bg-background font-arabic"
            />
            <button
              onClick={handleSearch}
              disabled={busy || !query.trim()}
              className="clay-button rounded-xl bg-clay-teal/10 text-clay-teal px-3 disabled:opacity-50"
            >
              {busy ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <FileSearch className="w-4 h-4" />
              )}
            </button>
          </div>

          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as LegalCategory | "all")}
            className="clay-input w-full rounded-xl border bg-white px-3 py-2 text-sm dark:bg-background font-arabic"
          >
            {RESEARCH_CATEGORIES.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl bg-clay-teal/10 p-2">
              <p className="text-lg font-black text-clay-teal">{stats.laws}</p>
              <p className="text-[10px] text-muted-foreground font-arabic">قانون</p>
            </div>
            <div className="rounded-xl bg-clay-teal/10 p-2">
              <p className="text-lg font-black text-clay-teal">{stats.articles}</p>
              <p className="text-[10px] text-muted-foreground font-arabic">مادة</p>
            </div>
            <div className="rounded-xl bg-clay-teal/10 p-2">
              <p className="text-lg font-black text-clay-teal">{stats.precedents}</p>
              <p className="text-[10px] text-muted-foreground font-arabic">حكم</p>
            </div>
          </div>

          <p className="text-[10px] text-muted-foreground font-arabic flex items-start gap-1.5">
            <Database className="w-3.5 h-3.5 shrink-0 text-clay-teal mt-0.5" />
            استرجاع هجين (BM25 + تشابه دلالي) عبر قاعدة القانون المصري المحلية — يعمل دون اتصال.
          </p>
        </div>

        {/* Results */}
        <div className="clay-card p-4 lg:col-span-2 min-h-[280px]">
          <h4 className="text-xs font-bold text-muted-foreground font-arabic mb-2">
            النتائج المسترجعة مع التوثيق المرجعي
          </h4>
          {!results ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <BookOpen className="w-10 h-10 text-muted-foreground/30 mb-2" />
              <p className="text-xs text-muted-foreground font-arabic">
                اكتب استعلامك لاسترجاع المواد والأحكام وقواعد المواعيد مع الاستشهادات
              </p>
            </div>
          ) : results.results.length === 0 ? (
            <p className="text-xs text-muted-foreground font-arabic py-6 text-center">
              لا توجد نتائج مطابقة — حاول تغيير الصياغة أو التصنيف
            </p>
          ) : (
            <div className="space-y-2 max-h-[420px] overflow-y-auto ps-1">
              {results.results.map((r, i) => {
                const c = r.citation;
                return (
                  <div key={r.id} className="rounded-xl border border-border bg-muted/20 p-3">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10px] font-bold text-clay-teal bg-clay-teal/10 rounded-lg px-2 py-0.5">
                          {i + 1} — {c.source}
                        </span>
                        {c.articleRef && (
                          <span className="text-[10px] font-semibold text-clay-blue bg-clay-blue/10 rounded-lg px-2 py-0.5">
                            {c.articleRef}
                          </span>
                        )}
                        {c.caseNumber && (
                          <span className="text-[10px] text-clay-purple bg-clay-purple/10 rounded-lg px-2 py-0.5">
                            قضية {c.caseNumber}
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] font-bold text-clay-green shrink-0">
                        {Math.round(r.relevanceScore * 100)}%
                      </span>
                    </div>
                    <p className="text-[11px] text-foreground font-arabic leading-relaxed">{r.text}</p>
                    <div className="flex items-center gap-2 mt-1.5 text-[9px] text-muted-foreground">
                      {c.court && <span>المحكمة: {c.court}</span>}
                      {c.year && <span>• سنة {c.year}</span>}
                      {c.pageNumber && <span>• صفحة {c.pageNumber}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Contract analysis */}
      <div className="clay-card p-4">
        <div className="flex items-center gap-2 mb-2">
          <FileSearch className="w-5 h-5 text-clay-rose" />
          <h3 className="text-sm font-bold font-arabic">تحليل العقود الذكي</h3>
        </div>
        <div className="grid gap-3 lg:grid-cols-2">
          <div className="space-y-2">
            <textarea
              value={contractText}
              onChange={(e) => setContractText(e.target.value)}
              rows={6}
              placeholder="الصق نص العقد لتحليل البنود والمخاطر والامتثال وفق المرجعية المصرية..."
              className="clay-input w-full rounded-xl border bg-white px-3 py-2 text-sm dark:bg-background font-arabic"
            />
            <button
              onClick={handleAnalyze}
              disabled={analysisBusy || !contractText.trim()}
              className="clay-button rounded-xl bg-clay-rose/10 text-clay-rose px-4 py-2.5 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {analysisBusy ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <ShieldAlert className="w-4 h-4" />
              )}
              تحليل العقد
            </button>
          </div>

          <div className="space-y-2 max-h-72 overflow-y-auto ps-1">
            {!analysis ? (
              <p className="text-xs text-muted-foreground font-arabic py-6 text-center">
                النتائج تظهر هنا: البنود المكتشفة، المخاطر، وملاحظات الامتثال مع الإسناد القانوني
              </p>
            ) : (
              <>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[11px] font-bold font-arabic">مستوى الخطر التقديري:</span>
                  <span
                    className={`text-[11px] font-black rounded-lg px-2 py-0.5 ${
                      analysis.estimatedRiskLevel === "high"
                        ? "bg-urgency-critical/10 text-urgency-critical"
                        : analysis.estimatedRiskLevel === "medium"
                          ? "bg-urgency-high/10 text-urgency-high"
                          : "bg-clay-green/10 text-clay-green"
                    }`}
                  >
                    {analysis.estimatedRiskLevel === "high"
                      ? "مرتفع"
                      : analysis.estimatedRiskLevel === "medium"
                        ? "متوسط"
                        : "منخفض"}
                  </span>
                  <span className="text-[10px] text-muted-foreground font-arabic">
                    {analysis.clauseCount} بند • {analysis.wordCount} كلمة
                    {analysis.llmEnriched ? " • مُثرى بالذكاء المحلي" : ""}
                  </span>
                </div>
                {analysis.findings.map((f, i) => (
                  <div key={i} className={`rounded-xl border p-2.5 ${SEVERITY_STYLES[f.severity]}`}>
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[11px] font-bold font-arabic">{f.title}</p>
                      <span className="text-[9px] opacity-80">{FINDING_TYPE_LABELS[f.type]}</span>
                    </div>
                    <p className="text-[10px] font-arabic mt-1 opacity-90">{f.detail}</p>
                    {f.legalReference && (
                      <p className="text-[9px] font-arabic mt-1 opacity-70">المرجع: {f.legalReference}</p>
                    )}
                    {f.excerpt && (
                      <p className="text-[9px] font-arabic mt-1 border-t border-current/10 pt-1 opacity-70">
                        «{f.excerpt}»
                      </p>
                    )}
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Document Verification Tab (tamper-proof blockchain proof)
// ============================================================

const METHOD_LABELS: Record<VerificationProof["method"], string> = {
  "ipfs+onchain": "IPFS + سلسلة الكتل (Sepolia)",
  "ipfs+local": "IPFS + إثبات محلي",
  onchain: "سلسلة الكتل (Sepolia)",
  local: "إثبات محلي (بصمة SHA-256)",
};

function DocumentVerificationTab() {
  const [content, setContent] = useState("");
  const [proof, setProof] = useState<VerificationProof | null>(null);
  const [integrity, setIntegrity] = useState<IntegrityResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [chainOk, setChainOk] = useState<boolean | null>(null);
  const [ipfsOk, setIpfsOk] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const verifier = await getBlockchainDocumentVerifier();
        const [chain, ipfs] = await Promise.all([
          verifier.checkChain(),
          verifier.checkIpfs(),
        ]);
        if (!cancelled) {
          setChainOk(chain);
          setIpfsOk(ipfs);
        }
      } catch {
        if (!cancelled) {
          setChainOk(false);
          setIpfsOk(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleVerify = useCallback(async () => {
    if (!content.trim()) return;
    setBusy(true);
    try {
      const verifier = await getBlockchainDocumentVerifier();
      const digest = await hashDocument(content);
      const proofRes = await verifier.verifyDocument(digest, new Date());
      const integrityRes = await verifier.checkDocumentIntegrity(digest);
      setProof(proofRes);
      setIntegrity(integrityRes);
      setChainOk(await verifier.checkChain());
      setIpfsOk(await verifier.checkIpfs());
    } finally {
      setBusy(false);
    }
  }, [content]);

  const handleIntegrityCheck = useCallback(async () => {
    if (!content.trim()) return;
    setBusy(true);
    try {
      const verifier = await getBlockchainDocumentVerifier();
      const digest = await hashDocument(content);
      const integrityRes = await verifier.checkDocumentIntegrity(digest);
      setIntegrity(integrityRes);
    } finally {
      setBusy(false);
    }
  }, [content]);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="clay-card p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Link2 className="w-5 h-5 text-clay-blue" />
          <h3 className="text-sm font-bold font-arabic">توثيق المستندات ضد التزوير</h3>
        </div>

        {/* Availability status */}
        <div className="flex items-center gap-2 flex-wrap text-[10px] font-arabic">
          <span
            className={`flex items-center gap-1 rounded-lg px-2 py-1 border ${
              chainOk === null
                ? "border-border text-muted-foreground"
                : chainOk
                  ? "border-clay-green/30 bg-clay-green/10 text-clay-green"
                  : "border-urgency-high/30 bg-urgency-high/10 text-urgency-high"
            }`}
          >
            {chainOk === null ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : chainOk ? (
              <CheckCircle2 className="w-3 h-3" />
            ) : (
              <XCircle className="w-3 h-3" />
            )}
            سلسلة Sepolia {chainOk === null ? "..." : chainOk ? "متاحة" : "غير متاحة"}
          </span>
          <span
            className={`flex items-center gap-1 rounded-lg px-2 py-1 border ${
              ipfsOk === null
                ? "border-border text-muted-foreground"
                : ipfsOk
                  ? "border-clay-green/30 bg-clay-green/10 text-clay-green"
                  : "border-urgency-high/30 bg-urgency-high/10 text-urgency-high"
            }`}
          >
            {ipfsOk === null ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : ipfsOk ? (
              <CheckCircle2 className="w-3 h-3" />
            ) : (
              <XCircle className="w-3 h-3" />
            )}
            IPFS {ipfsOk === null ? "..." : ipfsOk ? "متاح" : "غير متاح"}
          </span>
        </div>

        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={6}
          placeholder="محتوى المستند (مذكرة، عقد، محضر جلسة، حكم...) لتوثيقه زمنياً ضد التلاعب..."
          className="clay-input w-full rounded-xl border bg-white px-3 py-2 text-sm dark:bg-background font-arabic"
        />

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={handleVerify}
            disabled={busy || !content.trim()}
            className="clay-button rounded-xl bg-clay-blue/10 text-clay-blue px-4 py-2.5 flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
            توثيق المستند
          </button>
          <button
            onClick={handleIntegrityCheck}
            disabled={busy || !content.trim()}
            className="clay-button rounded-xl bg-clay-green/10 text-clay-green px-4 py-2.5 flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileCheck className="w-4 h-4" />}
            فحص السلامة
          </button>
        </div>

        <p className="text-[10px] text-muted-foreground font-arabic flex items-start gap-1.5">
          <ShieldAlert className="w-3.5 h-3.5 shrink-0 text-urgency-high mt-0.5" />
          للتوقيع الزمني الفعلي على السلسلة ضع VITE_SEPOLIA_RPC_URL و VITE_PRIVATE_KEY (اختياري) في مفاتيح المشروع — وبدونهما يُنشأ إثبات محلي صالح لفحص السلامة.
        </p>
      </div>

      <div className="space-y-3">
        {proof && (
          <div className="clay-card p-4 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-clay-green" />
                <h4 className="text-sm font-bold font-arabic text-clay-green">تم توثيق المستند</h4>
              </div>
              <span className="text-[10px] font-bold rounded-lg px-2 py-0.5 bg-clay-blue/10 text-clay-blue">
                {METHOD_LABELS[proof.method]}
              </span>
            </div>
            <div className="rounded-lg bg-muted/40 p-2">
              <p className="text-[10px] text-muted-foreground mb-1 font-arabic">بصمة المستند (SHA-256):</p>
              <code className="text-[10px] break-all text-clay-blue" dir="ltr">
                {proof.documentHash}
              </code>
            </div>
            <dl className="grid grid-cols-3 gap-1.5 text-[11px] font-arabic">
              <div className="rounded-lg bg-muted/30 p-2">
                <dt className="text-[9px] text-muted-foreground">التوقيت</dt>
                <dd className="font-bold text-foreground">{proof.timestamp.toLocaleString("ar-EG")}</dd>
              </div>
              <div className="rounded-lg bg-muted/30 p-2">
                <dt className="text-[9px] text-muted-foreground">الشبكة</dt>
                <dd className="font-bold text-foreground">{proof.network}</dd>
              </div>
              <div className="rounded-lg bg-muted/30 p-2">
                <dt className="text-[9px] text-muted-foreground">رقم الكتلة</dt>
                <dd className="font-bold text-foreground">{proof.blockNumber ?? "محلي"}</dd>
              </div>
            </dl>
            {proof.ipfsHash && (
              <div className="rounded-lg bg-muted/30 p-2">
                <p className="text-[9px] text-muted-foreground font-arabic">CID على IPFS</p>
                <p className="text-[10px] font-bold text-foreground break-all" dir="ltr">
                  {proof.ipfsHash}
                </p>
              </div>
            )}
            {proof.txHash && (
              <div className="rounded-lg bg-muted/30 p-2">
                <p className="text-[9px] text-muted-foreground font-arabic">توقيع الإثبات</p>
                <p className="text-[10px] font-bold text-foreground break-all" dir="ltr">
                  {proof.txHash}
                </p>
              </div>
            )}
          </div>
        )}

        {integrity && (
          <div className="clay-card p-3 flex items-start gap-2">
            {integrity.verified ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-clay-green mt-0.5" />
            ) : (
              <XCircle className="w-4 h-4 shrink-0 text-urgency-critical mt-0.5" />
            )}
            <div>
              <p
                className={`text-[11px] font-bold font-arabic ${
                  integrity.verified ? "text-clay-green" : "text-urgency-critical"
                }`}
              >
                {integrity.verified ? "التحقق ناجح" : "تحذير"}
              </p>
              <p className="text-[10px] text-muted-foreground font-arabic mt-0.5">{integrity.message}</p>
              {integrity.originalTimestamp && (
                <p className="text-[10px] text-muted-foreground font-arabic mt-1">
                  تاريخ التوثيق الأصلي: {integrity.originalTimestamp.toLocaleString("ar-EG")}
                </p>
              )}
            </div>
          </div>
        )}

        {!proof && !integrity && (
          <div className="clay-card p-4 flex items-center justify-center min-h-[200px] text-center">
            <div>
              <Lock className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-xs text-muted-foreground font-arabic">
                أي تعديل على المستند بعد التوثيق يُبطل فحص السلامة — حماية كاملة من التلاعب
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// Session Recorder Tab (voice-to-text for court hearings)
// ============================================================

interface TranscriptSegment {
  id: string;
  text: string;
  confidence: number;
  at: string;
}

const RECORDER_STATE_META: Record<RecorderState, { label: string; className: string }> = {
  idle: { label: "جاهز للتسجيل", className: "border-clay-blue/30 bg-clay-blue/10 text-clay-blue" },
  recording: { label: "جارٍ التسجيل...", className: "border-urgency-critical/30 bg-urgency-critical/10 text-urgency-critical" },
  processing: { label: "جارٍ المعالجة...", className: "border-urgency-high/30 bg-urgency-high/10 text-urgency-high" },
  completed: { label: "اكتمل التسجيل", className: "border-clay-green/30 bg-clay-green/10 text-clay-green" },
  error: { label: "خطأ", className: "border-urgency-critical/30 bg-urgency-critical/10 text-urgency-critical" },
};

function SessionRecorderTab() {
  const [engine, setEngine] = useState<SpeechEngine>("webspeech");
  const [voskModel, setVoskModel] = useState(VOSK_DEMO_MODELS[0]?.id ?? "fa");
  const [state, setState] = useState<RecorderState>("idle");
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [copied, setCopied] = useState(false);
  const [caseCode, setCaseCode] = useState("");
  const [analysis, setAnalysis] = useState<SessionAnalysis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const recorderRef = useRef<CourtSessionVoiceRecorder | null>(null);
  const timerRef = useRef<number | null>(null);
  const startedAtRef = useRef(0);

  const availableEngines = useMemo(() => VoiceRecorder.getAvailableEngines(), []);
  const supportsWebSpeech = availableEngines.includes("webspeech");
  const hasCustomVoskModel = Boolean(
    (import.meta.env.VITE_VOSK_MODEL_URL as string | undefined),
  );
  const isRecording = state === "recording";

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current !== null) window.clearInterval(timerRef.current);
      recorderRef.current?.abort();
    };
  }, []);

  const formatElapsed = (totalSeconds: number) => {
    const m = Math.floor(totalSeconds / 60)
      .toString()
      .padStart(2, "0");
    const s = (totalSeconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  const fullText = useMemo(() => segments.map((s) => s.text).join("\n"), [segments]);
  const wordCount = useMemo(
    () => fullText.split(/\s+/).filter(Boolean).length,
    [fullText],
  );

  const handleStart = useCallback(async () => {
    if (engine === "webspeech" && !supportsWebSpeech) {
      setError("متصفحك لا يدعم التعرف الصوتي — استخدم Chrome أو Edge أو Safari");
      return;
    }
    setError("");
    setInterim("");
    setSegments([]);
    setStatus("");
    setElapsed(0);

    setAnalysis(null);
    setSaved(false);

    const recorder = new CourtSessionVoiceRecorder({
      onStatus: (s) => setStatus(s),
      onStateChange: (s) => {
        setState(s);
        if (s === "recording" && timerRef.current === null) {
          startedAtRef.current = Date.now();
          timerRef.current = window.setInterval(() => {
            setElapsed(Math.floor((Date.now() - startedAtRef.current) / 1000));
          }, 1000);
        }
        if (s === "completed" || s === "error" || s === "idle") {
          if (timerRef.current !== null) {
            window.clearInterval(timerRef.current);
            timerRef.current = null;
          }
        }
      },
      onTranscript: (result) => {
        const text = result.text.trim();
        if (!text) return;
        setSegments((prev) => [
          ...prev,
          {
            id: `seg-${Date.now()}-${prev.length}`,
            text,
            confidence: result.confidence,
            at: new Date().toLocaleTimeString("ar-EG", {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            }),
          },
        ]);
      },
      onInterim: (text) => setInterim(text),
      onError: (msg) => setError(msg),
    });
    recorderRef.current = recorder;
    await recorder.startRecording({
      engine,
      language: "ar-EG",
      continuous: true,
      interimResults: true,
      model: voskModel,
    });
  }, [engine, supportsWebSpeech, voskModel]);

  const handleStop = useCallback(async () => {
    await recorderRef.current?.stopRecording();
  }, []);

  const handleAbort = useCallback(() => {
    recorderRef.current?.abort();
  }, []);

  const handleAnalyze = useCallback(async () => {
    if (!fullText.trim() || analyzing) return;
    setAnalyzing(true);
    setError("");
    try {
      const result = await analyzeSessionTranscript(fullText);
      setAnalysis(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "فشل تحليل الجلسة — حاول مرة أخرى");
    } finally {
      setAnalyzing(false);
    }
  }, [fullText, analyzing]);

  const handleSave = useCallback(async () => {
    if (!fullText.trim() || saving) return;
    setSaving(true);
    setError("");
    try {
      const sessionId = `session-${Date.now()}`;
      await saveSessionTranscript(sessionId, {
        id: sessionId,
        caseCode: caseCode.trim() || undefined,
        title: `جلسة ${new Date().toLocaleString("ar-EG")}`,
        text: fullText,
        engine: engine,
        language: "ar-EG",
        duration: elapsed,
        wordCount: wordCount,
        createdAt: new Date().toISOString(),
        segments: segments.map((s, i) => ({
          start: 0,
          end: 0,
          text: s.text,
          confidence: s.confidence,
        })),
        analysis: analysis ?? undefined,
      });
      setSaved(true);
      window.setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "فشل حفظ الجلسة — جرب مرة أخرى");
    } finally {
      setSaving(false);
    }
  }, [fullText, saving, caseCode, engine, elapsed, wordCount, segments, analysis]);

  const handleCopy = useCallback(async () => {
    if (!fullText) return;
    try {
      await navigator.clipboard.writeText(fullText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setError("تعذر النسخ إلى الحافظة — انسخ النص يدوياً");
    }
  }, [fullText]);

  const handleDownload = useCallback(() => {
    if (!fullText) return;
    const blob = new Blob([fullText], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `محضر-جلسة-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }, [fullText]);

  const stateMeta = RECORDER_STATE_META[state];

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {/* Controls */}
      <div className="clay-card p-4 space-y-3 lg:col-span-1">
        <div className="flex items-center gap-2">
          <Mic className="w-5 h-5 text-clay-coral" />
          <h3 className="text-sm font-bold font-arabic">تسجيل صوتي للجلسات</h3>
        </div>

        <div>
          <label className="text-xs text-muted-foreground font-arabic mb-1 block">محرك التعرف</label>
          <select
            value={engine}
            onChange={(e) => setEngine(e.target.value as SpeechEngine)}
            disabled={isRecording}
            className="clay-input w-full rounded-xl border bg-white px-3 py-2 text-sm dark:bg-background font-arabic disabled:opacity-50"
          >
            <option value="webspeech">Web Speech (المتصفح — عربي فوري)</option>
            <option value="vosk">Vosk (دون اتصال — WASM حقيقي)</option>
          </select>
        </div>

        {engine === "vosk" && (
          <div>
            <label className="text-xs text-muted-foreground font-arabic mb-1 block">
              نموذج التعرف (يُحمَّل مرة ثم يُخزَّن في المتصفح)
            </label>
            <select
              value={voskModel}
              onChange={(e) => setVoskModel(e.target.value)}
              disabled={isRecording}
              className="clay-input w-full rounded-xl border bg-white px-3 py-2 text-sm dark:bg-background font-arabic disabled:opacity-50"
            >
              {VOSK_DEMO_MODELS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
        )}

        {!supportsWebSpeech && engine === "webspeech" && (
          <div className="flex items-start gap-2 rounded-lg border border-urgency-high/30 bg-urgency-high/10 p-2 text-xs text-foreground font-arabic">
            <AlertTriangle className="w-4 h-4 shrink-0 text-urgency-high" />
            متصفحك لا يدعم التعرف الصوتي — استخدم Chrome أو Edge أو Safari
          </div>
        )}
        {engine === "vosk" && (
          <div className="flex items-start gap-2 rounded-lg border border-urgency-high/30 bg-urgency-high/10 p-2 text-xs text-foreground font-arabic">
            <AlertTriangle className="w-4 h-4 shrink-0 text-urgency-high" />
            {hasCustomVoskModel
              ? "نموذج مخصص مفعّل عبر VITE_VOSK_MODEL_URL — سيُستخدم تلقائياً للتعرف العربي."
              : "لا يوجد نموذج عربي صغير مستضاف متاح للتحميل المباشر — ضع رابط نموذج عربي (ملف tar.gz بصيغة vosk-browser) في VITE_VOSK_MODEL_URL بمفاتيح المشروع، أو جرّب نموذجاً تجريبياً أدناه."}
          </div>
        )}

        {/* Record controls */}
        <div className="flex items-center gap-2">
          {!isRecording ? (
            <button
              onClick={handleStart}
              disabled={state === "processing" || (engine === "webspeech" && !supportsWebSpeech)}
              className="clay-button flex-1 rounded-xl bg-urgency-critical/10 text-urgency-critical px-4 py-3 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Mic className="w-4 h-4" />
              ابدأ التسجيل
            </button>
          ) : (
            <>
              <button
                onClick={handleStop}
                className="clay-button flex-1 rounded-xl bg-urgency-critical/10 text-urgency-critical px-4 py-3 flex items-center justify-center gap-2"
              >
                <Square className="w-4 h-4 fill-current" />
                إيقاف التسجيل
              </button>
              <button
                onClick={handleAbort}
                title="إلغاء التسجيل"
                className="clay-button rounded-xl bg-muted/50 text-muted-foreground px-3 py-3"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </>
          )}
        </div>

        {/* State + timer */}
        <div className="flex items-center justify-between gap-2">
          <span className={`flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[10px] font-bold font-arabic ${stateMeta.className}`}>
            {state === "recording" && <span className="w-2 h-2 rounded-full bg-urgency-critical animate-pulse" />}
            {state === "processing" && <Loader2 className="w-3 h-3 animate-spin" />}
            {stateMeta.label}
          </span>
          <span className="flex items-center gap-1 text-xs font-black text-muted-foreground tabular-nums" dir="ltr">
            <Clock className="w-3.5 h-3.5" />
            {formatElapsed(elapsed)}
          </span>
        </div>

        {status && (
          <p className="text-[10px] text-clay-blue font-arabic flex items-center gap-1.5">
            <Loader2 className="w-3 h-3 animate-spin" />
            {status}
          </p>
        )}

        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-urgency-critical/30 bg-urgency-critical/10 p-2 text-xs text-foreground font-arabic">
            <AlertTriangle className="w-4 h-4 shrink-0 text-urgency-critical" />
            {error}
          </div>
        )}

        {/* Session stats */}
        <div className="grid grid-cols-2 gap-2 text-center">
          <div className="rounded-xl bg-clay-coral/10 p-2">
            <p className="text-lg font-black text-clay-coral">{segments.length}</p>
            <p className="text-[10px] text-muted-foreground font-arabic">مقطع نصي</p>
          </div>
          <div className="rounded-xl bg-clay-coral/10 p-2">
            <p className="text-lg font-black text-clay-coral">{wordCount}</p>
            <p className="text-[10px] text-muted-foreground font-arabic">كلمة</p>
          </div>
        </div>
      </div>

      {/* Transcript */}
      <div className="clay-card p-4 lg:col-span-2 min-h-[320px] flex flex-col">
        <div className="flex items-center justify-between gap-2 mb-2">
          <h4 className="text-xs font-bold text-muted-foreground font-arabic">نص الجلسة المكتوب</h4>
          <div className="flex items-center gap-1.5">
            <button
              onClick={handleCopy}
              disabled={segments.length === 0}
              className="clay-button rounded-lg bg-clay-blue/10 text-clay-blue px-2.5 py-1.5 flex items-center gap-1 text-[10px] font-bold font-arabic disabled:opacity-50"
            >
              {copied ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? "تم النسخ" : "نسخ"}
            </button>
            <button
              onClick={handleDownload}
              disabled={segments.length === 0}
              className="clay-button rounded-lg bg-clay-green/10 text-clay-green px-2.5 py-1.5 flex items-center gap-1 text-[10px] font-bold font-arabic disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" />
              تنزيل
            </button>
            <button
              onClick={() => {
                setSegments([]);
                setInterim("");
                setError("");
              }}
              disabled={segments.length === 0}
              className="clay-button rounded-lg bg-muted/50 text-muted-foreground px-2.5 py-1.5 flex items-center gap-1 text-[10px] font-bold font-arabic disabled:opacity-50"
            >
              <Trash2 className="w-3.5 h-3.5" />
              مسح
            </button>
          </div>
        </div>

        {/* Case linkage + AI analysis + save */}
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <input
            value={caseCode}
            onChange={(e) => setCaseCode(e.target.value)}
            placeholder="رقم القضية (اختياري) — مثال: 2026/1234"
            className="clay-input flex-1 min-w-[160px] rounded-xl border bg-white px-3 py-2 text-sm dark:bg-background font-arabic"
          />
          <button
            onClick={handleAnalyze}
            disabled={analyzing || !fullText.trim()}
            className="clay-button rounded-lg bg-clay-purple/10 text-clay-purple px-3 py-2 flex items-center gap-1.5 text-[10px] font-bold font-arabic disabled:opacity-50"
          >
            {analyzing ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <BrainCircuit className="w-3.5 h-3.5" />
            )}
            {analyzing ? "جارٍ التحليل..." : "تحليل الجلسة بالذكاء القانوني"}
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !fullText.trim()}
            className="clay-button rounded-lg bg-clay-green/10 text-clay-green px-3 py-2 flex items-center gap-1.5 text-[10px] font-bold font-arabic disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : saved ? (
              <CheckCircle2 className="w-3.5 h-3.5" />
            ) : (
              <Save className="w-3.5 h-3.5" />
            )}
            {saving ? "جارٍ الحفظ..." : saved ? "تم الحفظ" : "حفظ الجلسة"}
          </button>
        </div>

        {segments.length === 0 && !interim ? (
          <div className="flex flex-col items-center justify-center flex-1 py-10 text-center">
            <Mic className="w-10 h-10 text-muted-foreground/30 mb-2" />
            <p className="text-xs text-muted-foreground font-arabic">
              اضغط «ابدأ التسجيل» وابدأ التحدث — سيظهر النص هنا مقطعاً بمقطع
            </p>
            <p className="text-[10px] text-muted-foreground/70 mt-1 font-arabic">
              مثالي لتوثيق جلسات المحكمة والمقابلات والإفادات بالعربية
            </p>
          </div>
        ) : (
          <div className="space-y-2 overflow-y-auto max-h-[420px] ps-1 flex-1">
            {segments.map((seg, i) => (
              <div key={seg.id} className="rounded-xl border border-border bg-muted/20 p-3">
                <div className="flex items-center gap-2 mb-1 text-[9px] text-muted-foreground">
                  <span className="font-black text-clay-coral">{i + 1}</span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {seg.at}
                  </span>
                  <span className="ms-auto font-bold text-clay-green" dir="ltr">
                    {Math.round(seg.confidence * 100)}%
                  </span>
                </div>
                <p className="text-sm text-foreground font-arabic leading-relaxed">{seg.text}</p>
              </div>
            ))}
            {interim && isRecording && (
              <div className="rounded-xl border border-dashed border-urgency-high/40 bg-urgency-high/5 p-3">
                <p className="text-sm text-muted-foreground font-arabic leading-relaxed">
                  {interim}
                  <span className="text-urgency-high"> ▍</span>
                </p>
              </div>
            )}
          </div>
        )}

        {/* AI analysis of the session */}
        {analysis && (
          <div className="rounded-xl border border-clay-purple/30 bg-clay-purple/5 p-3 space-y-2.5 mt-2">
            <div className="flex items-center gap-2 flex-wrap">
              <BrainCircuit className="w-4 h-4 text-clay-purple" />
              <h5 className="text-xs font-bold font-arabic text-clay-purple">
                تحليل الجلسة بالذكاء القانوني
              </h5>
              <span className="ms-auto text-[9px] font-bold rounded-lg px-2 py-0.5 bg-clay-purple/10 text-clay-purple" dir="ltr">
                {analysis.provider} • {analysis.latencyMs}ms
              </span>
            </div>

            {analysis.summary && (
              <p className="text-[11px] text-foreground font-arabic leading-relaxed">
                {analysis.summary}
              </p>
            )}

            {analysis.keyPoints.length > 0 && (
              <div>
                <p className="text-[10px] font-bold text-muted-foreground font-arabic mb-1 flex items-center gap-1">
                  <ListChecks className="w-3 h-3 text-clay-purple" />
                  النقاط الرئيسية
                </p>
                <ul className="space-y-1">
                  {analysis.keyPoints.map((p, i) => (
                    <li key={i} className="text-[11px] text-foreground font-arabic flex gap-1.5">
                      <span className="text-clay-purple shrink-0">•</span>
                      {p}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {analysis.legalIssues.length > 0 && (
              <div>
                <p className="text-[10px] font-bold text-muted-foreground font-arabic mb-1 flex items-center gap-1">
                  <Scale className="w-3 h-3 text-urgency-high" />
                  المسائل القانونية المحددة
                </p>
                <ul className="space-y-1">
                  {analysis.legalIssues.map((p, i) => (
                    <li key={i} className="text-[11px] text-foreground font-arabic flex gap-1.5">
                      <span className="text-urgency-high shrink-0">•</span>
                      {p}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {analysis.flaggedStatements.length > 0 && (
              <div>
                <p className="text-[10px] font-bold text-muted-foreground font-arabic mb-1 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3 text-urgency-critical" />
                  إفادات مهمة تحتاج متابعة
                </p>
                <ul className="space-y-1">
                  {analysis.flaggedStatements.map((p, i) => (
                    <li key={i} className="text-[11px] text-foreground font-arabic flex gap-1.5">
                      <span className="text-urgency-critical shrink-0">•</span>
                      {p}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {analysis.relevantArticles.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] font-bold text-muted-foreground font-arabic">
                  مواد مرجعية:
                </span>
                {analysis.relevantArticles.map((a, i) => (
                  <span key={i} className="text-[9px] font-bold rounded-lg px-2 py-0.5 bg-clay-blue/10 text-clay-blue">
                    {a}
                  </span>
                ))}
              </div>
            )}

            {analysis.citations.length > 0 && (
              <div>
                <p className="text-[10px] font-bold text-muted-foreground font-arabic mb-1">
                  الاستشهادات
                </p>
                <ul className="space-y-0.5">
                  {analysis.citations.map((c, i) => (
                    <li key={i} className="text-[10px] text-muted-foreground font-arabic flex gap-1.5" dir="rtl">
                      <span className="text-clay-blue shrink-0">◈</span>
                      {c}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {analysis.agentsConsulted.length > 0 && (
              <p className="text-[9px] text-muted-foreground/80 font-arabic">
                وكلاء القانون المستشارون: {analysis.agentsConsulted.join("، ")}
              </p>
            )}

            <p className="text-[9px] text-urgency-high/80 font-arabic leading-relaxed">
              {analysis.disclaimer}
            </p>
          </div>
        )}
      </div>

      {/* Privacy note */}
      <div className="lg:col-span-3 clay-card p-3 flex items-start gap-2">
        <ShieldCheck className="w-4 h-4 shrink-0 text-clay-green mt-0.5" />
        <p className="text-[10px] text-muted-foreground font-arabic leading-relaxed">
          التسجيل يُعالج محلياً في متصفحك: محرك Web Speech يحوّل الصوت إلى نص عبر مزوّد المتصفح، ومحرك Vosk يعمل دون اتصال بالكامل. راجع النص قبل اعتماده كمحضر رسمي — النص تقديري وقد يحتاج تصحيحاً يدوياً.
        </p>
      </div>
    </div>
  );
}

// ============================================================
// Main Page
// ============================================================

type TabId = "research" | "verification" | "recorder" | "signature" | "analytics" | "graph";

const TABS: Array<{ id: TabId; label: string; icon: React.ElementType }> = [
  { id: "research", label: "البحث القانوني", icon: BookOpen },
  { id: "verification", label: "توثيق المستندات", icon: Link2 },
  { id: "recorder", label: "تسجيل الجلسات", icon: Mic },
  { id: "signature", label: "التوقيع الإلكتروني", icon: FileSignature },
  { id: "analytics", label: "التحليلات التنبؤية", icon: LineChart },
  { id: "graph", label: "الرسم المعرفي", icon: Network },
];

export default function LegalIntelligence() {
  const [tab, setTab] = useState<TabId>("research");

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
              منصة الاستخبارات القانونية 2026: بحث قانوني بالاسترجاع الذكي، توثيق مستندات ضد التزوير، تسجيل صوتي للجلسات، توقيع إلكتروني، تحليلات تنبؤية، ورسم معرفي للقانون المصري
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

      {tab === "research" && <LegalResearchTab />}
      {tab === "verification" && <DocumentVerificationTab />}
      {tab === "recorder" && <SessionRecorderTab />}
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