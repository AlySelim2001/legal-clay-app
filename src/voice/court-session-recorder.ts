/**
 * Court Session Voice Recorder — CRIM-SYS 2026
 *
 * Browser-safe version of the court session recorder.
 *
 * The original sketch used Node-only APIs (`vosk` native module,
 * `child_process.spawn`, `Readable` streams) that cannot run in a Vite
 * browser app. This implementation keeps the same public contract while
 * using the app's real browser engines:
 *
 *   1. Recording + transcription → `VoiceRecorder` from `@/lib/voice-to-text`,
 *      which drives vosk-browser (offline WASM Kaldi/Vosk) or the Web
 *      Speech API — actual transcripts, no Node runtime required.
 *   2. Session analysis → the 18-agent legal swarm (`SwarmOrchestrator`)
 *      with hybrid RAG retrieval: key points, legal issues, flagged
 *      statements, and citations.
 *   3. Persistence → the app's offline-first IndexedDB layer
 *      (`@/lib/open-source/offline-sync`, `attachments` store) so saved
 *      session transcripts survive restarts and are available in court
 *      without a connection.
 */

import {
  VoiceRecorder,
  type RecorderCallbacks,
  type RecorderState,
  type SpeechEngine,
  type TranscriptionResult,
  type VoiceRecorderConfig,
} from "@/lib/voice-to-text";
import { getSwarmOrchestrator } from "@/agents/swarm-orchestrator";
import { cacheData, getCachedData } from "@/lib/open-source/offline-sync";

// ============================================================
// Types
// ============================================================

export interface SessionTranscriptSegment {
  start: number;
  end: number;
  text: string;
  confidence: number;
}

export interface SessionTranscript {
  id: string;
  caseCode?: string;
  title: string;
  text: string;
  engine: SpeechEngine;
  language: string;
  duration: number;
  wordCount: number;
  createdAt: string;
  segments: SessionTranscriptSegment[];
  analysis?: SessionAnalysis;
}

export interface SessionAnalysis {
  summary: string;
  keyPoints: string[];
  legalIssues: string[];
  flaggedStatements: string[];
  relevantArticles: string[];
  citations: string[];
  disclaimer: string;
  provider: string;
  latencyMs: number;
  agentsConsulted: string[];
}

interface SavedTranscriptRecord {
  id: string;
  type: "session_transcript";
  case_id: string | null;
  content: string;
  transcript: SessionTranscript;
  created_at: string;
}

// ============================================================
// Deterministic transcript heuristics (work fully offline)
// ============================================================

const LEGAL_ISSUE_PATTERNS: Array<{ issue: string; keywords: string[] }> = [
  {
    issue: "بطلان القبض أو التفتيش (المواد 40، 41 من الإجراءات الجنائية)",
    keywords: ["قبض", "تفتيش", "إذن النيابة", "مأمورية", "ضبط"],
  },
  {
    issue: "مخالفة ميعاد عرض المتهم على النيابة (المادة 36)",
    keywords: ["عرض النيابة", "24 ساعة", "احتجاز", "حجز"],
  },
  {
    issue: "اعتراف منتزع تحت إكراه أو تعذيب",
    keywords: ["إكراه", "تعذيب", "اعتراف قسري", "تهديد بالضرب"],
  },
  {
    issue: "عدم كفاية الأدلة / دفع بانتفاء التهمة",
    keywords: ["لا يوجد دليل", "عدم كفاية", "انتفاء", "إنكار التهمة", "براءة"],
  },
  {
    issue: "مواد مخدرة أو أسلحة (قانون المخدرات 182/1960)",
    keywords: ["مخدرات", "هيروين", "حشيش", "أفيون", "سلاح", "مسدس", "طلقات", "ذخيرة"],
  },
  {
    issue: "تزوير أو أموال عامة (المواد 211 وما بعدها من العقوبات)",
    keywords: ["تزوير", "رشوة", "اختلاس", "مال عام", "مستندات مزورة", "توقيع مزور"],
  },
  {
    issue: "سرقة أو نصب (المواد 311، 336 من العقوبات)",
    keywords: ["سرقة", "نصب", "احتيال", "اختلاس أموال", "سلب"],
  },
  {
    issue: "مسائل أحوال شخصية (نفقة، حضانة، طلاق، ميراث)",
    keywords: ["حضانة", "نفقة", "طلاق", "خلع", "ميراث", "مواريث", "متعة"],
  },
  {
    issue: "تقادم أو مواعيد إجرائية (المادة 15 من العقوبات)",
    keywords: ["تقادم", "ميعاد", "سقط الحق", "مدة قانونية", "فات الميعاد"],
  },
  {
    issue: "شيكات بدون رصيد (المادة 336/1 من العقوبات)",
    keywords: ["شيك", "بدون رصيد", "شيكات", "رصيد"],
  },
];

const FLAGGED_PHRASES: string[] = [
  "اعترف",
  "أقرّ",
  "أقر ",
  "أدلى",
  "صرّح",
  "صرح",
  "شهد",
  "أكد",
  "ذكر المتهم",
  "المتهم قال",
  "ضبط معه",
  "بحيازته",
  "بإرشاده",
  "مبلغ",
  "جنيه",
  "سلاح",
  "مخدرات",
  "مسدس",
  "قتل",
  "ضرب",
  "سرق",
  "هدد",
  "اتصل",
  "شاهد عيان",
  "كشف",
];

const BULLET_PREFIX = /^[\s]*([•*\-–—]|\d+[.)])\s+/;

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!؟?])\s+/u)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function detectLegalIssues(transcript: string): string[] {
  const issues: string[] = [];
  for (const pattern of LEGAL_ISSUE_PATTERNS) {
    if (pattern.keywords.some((kw) => transcript.includes(kw))) {
      issues.push(pattern.issue);
    }
    if (issues.length >= 6) break;
  }
  return issues;
}

function flagImportantStatements(transcript: string): string[] {
  const sentences = splitSentences(transcript);
  const flagged: string[] = [];
  for (const sentence of sentences) {
    if (FLAGGED_PHRASES.some((phrase) => sentence.includes(phrase))) {
      flagged.push(sentence);
    }
    if (flagged.length >= 8) break;
  }
  return flagged;
}

function extractKeyPoints(analysis: string): string[] {
  const lines = analysis
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && BULLET_PREFIX.test(l))
    .map((l) => l.replace(BULLET_PREFIX, "").trim())
    .filter((l) => l.length > 8);

  const unique: string[] = [];
  for (const line of lines) {
    if (!unique.some((u) => u.includes(line) || line.includes(u))) {
      unique.push(line);
    }
    if (unique.length >= 8) break;
  }
  return unique;
}

// ============================================================
// Analysis (swarm + heuristics, works offline)
// ============================================================

/**
 * Analyze a court session transcript with the legal agents swarm.
 * Falls back to deterministic heuristics if the LLM provider is
 * unavailable, so the button always returns a useful result.
 */
export async function analyzeSessionTranscript(
  transcript: string,
): Promise<SessionAnalysis> {
  const startedAt = Date.now();
  const trimmed = transcript.trim();

  // Heuristics always run — instant, offline, deterministic.
  const legalIssues = detectLegalIssues(trimmed);
  const flaggedStatements = flagImportantStatements(trimmed);

  let summary = "";
  let relevantArticles: string[] = [];
  let citations: string[] = [];
  let disclaimer = "⚠️ نتيجة تقديرية استرشادية — يجب التحقق منها مع المحامي المختص قبل اتخاذ أي إجراء.";
  let provider = "knowledge-base";
  let agentsConsulted: string[] = [];

  try {
    const orchestrator = getSwarmOrchestrator();
    const prompt = [
      "أنت محلل جلسات محكمة. حلل نص الجلسة المستخرج صوتياً التالي واستخرج:",
      "1) النقاط الرئيسية للجلسة",
      "2) المسائل القانونية المحتملة التي تستدعي اهتمام الدفاع",
      "3) العبارات المهمة التي تستحق التوقف عندها",
      "",
      "نص الجلسة:",
      '"""',
      trimmed.slice(0, 6000),
      '"""',
    ].join("\n");

    const result = await orchestrator.processQuery(prompt, []);
    summary = result.synthesizedAnalysis;
    relevantArticles = result.relevantArticles;
    disclaimer = result.disclaimer;
    agentsConsulted = result.agentResponses.map((r) => r.agentId);
    provider = result.agentResponses[0]?.provider ?? "knowledge-base";
    citations = result.citations.map((c) =>
      [c.source, c.articleRef, c.caseNumber, c.court, c.year ? `سنة ${c.year}` : ""]
        .filter(Boolean)
        .join(" — "),
    );
  } catch {
    // Swarm failed (offline / no provider) — keep heuristic-only result.
    summary =
      legalIssues.length > 0
        ? `تم رصد ${legalIssues.length} مسألة قانونية محتملة و${flaggedStatements.length} عبارة مهمة في نص الجلسة. راجع النتائج أدناه واعرضها على المحامي المختص.`
        : "لم تُرصد مسائل قانونية محددة في النص — النص تقديري وقد يحتاج إلى مراجعة يدوية.";
  }

  const keyPoints =
    extractKeyPoints(summary).length > 0
      ? extractKeyPoints(summary)
      : splitSentences(trimmed).slice(0, 5);

  return {
    summary,
    keyPoints,
    legalIssues,
    flaggedStatements,
    relevantArticles,
    citations,
    disclaimer,
    provider,
    latencyMs: Date.now() - startedAt,
    agentsConsulted,
  };
}

// ============================================================
// Persistence (offline-first IndexedDB, `attachments` store)
// ============================================================

/**
 * Save a session transcript into the app's offline database.
 * Records are stored in the `attachments` store under the app's
 * IndexedDB (`crim-sys-2026`) and participate in backups.
 */
export async function saveSessionTranscript(
  sessionId: string,
  transcript: SessionTranscript,
): Promise<void> {
  const record: SavedTranscriptRecord = {
    id: `transcript-${sessionId}`,
    type: "session_transcript",
    case_id: transcript.caseCode ?? null,
    content: transcript.text,
    transcript,
    created_at: transcript.createdAt,
  };
  await cacheData("attachments", record);
}

/**
 * List saved session transcripts, most recent first.
 */
export async function listSavedTranscripts(): Promise<SessionTranscript[]> {
  const records = (await getCachedData("attachments")) as SavedTranscriptRecord[];
  return records
    .filter((r) => r.type === "session_transcript" && r.transcript)
    .map((r) => r.transcript)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

// ============================================================
// Recorder (browser-safe, real vosk-browser engine)
// ============================================================

/**
 * Browser-safe court session voice recorder.
 *
 * Wraps the existing `VoiceRecorder` (vosk-browser offline WASM or Web
 * Speech API) and adds swarm-based transcript analysis plus offline
 * persistence, mirroring the original sketch's contract:
 *
 *   const recorder = new CourtSessionVoiceRecorder(callbacks);
 *   await recorder.startRecording({ engine: 'vosk', language: 'ar-EG' });
 *   ... speak ...
 *   const transcript = await recorder.stopRecording();
 *   const analysis = await recorder.analyzeSessionTranscript(transcript);
 *   await recorder.saveTranscription(transcript.id, transcript, caseCode);
 */
export class CourtSessionVoiceRecorder {
  private recorder: VoiceRecorder;
  private callbacks: RecorderCallbacks;
  private collected: Array<{ result: TranscriptionResult; at: number }> = [];
  private startedAt = 0;

  constructor(callbacks: RecorderCallbacks = {}) {
    this.callbacks = callbacks;

    // Forward every event, and additionally collect final results so
    // `stopRecording()` can compose a full transcript object.
    this.recorder = new VoiceRecorder({
      ...callbacks,
      onTranscript: (result) => {
        this.collected.push({ result, at: Date.now() });
        callbacks.onTranscript?.(result);
      },
    });
  }

  async startRecording(config?: Partial<VoiceRecorderConfig>): Promise<void> {
    this.collected = [];
    this.startedAt = Date.now();
    await this.recorder.startRecording(config);
  }

  async stopRecording(): Promise<SessionTranscript> {
    await this.recorder.stopRecording();
    return this.buildTranscript();
  }

  abort(): void {
    this.recorder.abort();
    this.collected = [];
  }

  getState(): RecorderState {
    return this.recorder.getState();
  }

  static getAvailableEngines(): SpeechEngine[] {
    return VoiceRecorder.getAvailableEngines();
  }

  /**
   * One-shot flow: record until stopped, then return the transcript.
   * For live UIs prefer startRecording/stopRecording with callbacks.
   */
  async recordAndTranscribe(
    sessionId: string,
    config?: Partial<VoiceRecorderConfig>,
  ): Promise<SessionTranscript> {
    await this.startRecording(config);
    const transcript = await this.stopRecording();
    transcript.id = sessionId;
    return transcript;
  }

  /**
   * Analyze a session transcript with the legal agents swarm.
   */
  analyzeSessionTranscript(transcript: SessionTranscript | string): Promise<SessionAnalysis> {
    const text = typeof transcript === "string" ? transcript : transcript.text;
    return analyzeSessionTranscript(text);
  }

  /**
   * Save a transcription to the app's offline database.
   */
  async saveTranscription(
    sessionId: string,
    transcript: SessionTranscript | string,
    caseCode?: string,
  ): Promise<void> {
    const t =
      typeof transcript === "string"
        ? this.buildTranscript(caseCode, transcript)
        : { ...transcript, caseCode: caseCode ?? transcript.caseCode };
    await saveSessionTranscript(sessionId, t);
  }

  private buildTranscript(caseCode?: string, overrideText?: string): SessionTranscript {
    const text =
      overrideText ?? this.collected.map((c) => c.result.text.trim()).filter(Boolean).join("\n");
    const lastEnd = this.collected[this.collected.length - 1]?.result.duration ?? 0;
    const segments = this.collected.map((c) => ({
      start: 0,
      end: c.result.duration,
      text: c.result.text.trim(),
      confidence: c.result.confidence,
    }));
    const engine = this.collected[0]?.result.engine ?? "webspeech";
    const language = this.collected[0]?.result.language ?? "ar-EG";

    return {
      id: `session-${this.startedAt || Date.now()}`,
      caseCode,
      title: `جلسة ${new Date(this.startedAt || Date.now()).toLocaleString("ar-EG")}`,
      text,
      engine,
      language,
      duration: lastEnd,
      wordCount: text.split(/\s+/).filter(Boolean).length,
      createdAt: new Date(this.startedAt || Date.now()).toISOString(),
      segments,
    };
  }
}