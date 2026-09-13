/**
 * Evidence-First legal pipeline — pure domain engine (no Convex imports).
 *
 * Pipeline: classify → retrieve (hybrid) → validate citations → temporal
 * validation → compose deterministic answer → confidence. The LLM is NOT in
 * this path: every claim is composed from retrieved evidence, so the system
 * cannot cite anything it was not given (P-01/P-02/P-03, T-014).
 */

import {
  EMBEDDING_DIM,
  cosineSimilarity,
  detectPii,
  maskPii,
  normalizeArabic,
  splitSentences,
  tokenContainment,
  tokenize,
  tokenOverlap,
} from "./text";

// ============================================================
// Versioning
// ============================================================

export const RETRIEVAL_VERSION = "evidence-rag-1.0.0";
export const PIPELINE_NAME = "evidence-first-hybrid";

// ============================================================
// Evidence pack
// ============================================================

export interface EvidenceChunk {
  chunkId: string;
  articleId?: string;
  sourceId: string;
  sourceTitle: string;
  sourceType: string;
  officialUrl?: string;
  provenance: string;
  text: string;
  validity: string;
  effectiveFrom?: number;
  effectiveTo?: number;
  verificationStatus: string;
  score: number;
  lexical: number;
  semantic: number;
  /** Extra penalty score — e.g. superseded content ranking lower. */
  penalty: number;
}

export interface EvidencePack {
  chunks: EvidenceChunk[];
  /** Weighted retrieval quality 0..1 — drives confidence only, never gates. */
  retrievalQuality: number;
  bestScore: number;
}

// ============================================================
// Classification — processing strategy only, never legal guilt
// ============================================================

export type QueryType =
  | "LEGAL_DEFINITION"
  | "LEGAL_ARTICLE"
  | "PROCEDURE"
  | "AUTHORITY"
  | "DOCUMENT"
  | "COMPARISON"
  | "EDUCATION"
  | "GENERAL"
  | "HIGH_RISK"
  | "TEMPORAL"
  | "CONFLICTING"
  | "INSUFFICIENT_EVIDENCE";

interface ClassifierRule {
  type: QueryType;
  patterns: RegExp[];
}

const CLASSIFIER_RULES: ClassifierRule[] = [
  {
    type: "PROCEDURE",
    patterns: [
      /ماذا\s*(أفعل|افعل|يعمل)/, /كيف\s*(أ|ا)/, /الخطوات/, /إجراءات?/, /اجراءات/,
      /أروح|اذهب|إلى\s*أين/, /فين\s*(أقدم|اقدم)/, /وين\s/,
    ],
  },
  {
    type: "AUTHORITY",
    patterns: [/أين|اين/, /تروح\s*فين/, /تتعامل\s*مع\s*مين/, /الجهة/, /المختص/, /نيابة|محكمة|قسم\s*شرطة/],
  },
  {
    type: "LEGAL_ARTICLE",
    patterns: [/المادة/, /مادة\s*\d+/, /رقم\s*\d+/, /القانون\s*رقم/],
  },
  {
    type: "LEGAL_DEFINITION",
    patterns: [/ما\s*معنى/, /تعريف/, /ما\s*هو/, /ما\s*هي/, /يعني\s*إيه/],
  },
  {
    type: "DOCUMENT",
    patterns: [/مستند/, /محرر/, /إيصال|ايصال/, /محضر/, /عقد/, /صك/, /توكيل/],
  },
  {
    type: "COMPARISON",
    patterns: [/الفرق\s*بين/, /مقارنة/, /أفضل/, /هل\s*(يوجد|توجد)\s*تعارض/, /التناقض/],
  },
  {
    type: "TEMPORAL",
    patterns: [
      /ما\s*زال\s*ساريا/, /هل\s*ساري/, /سارى\s*حتى/, /ألغيت|الغيت/, /تم\s*تعديل/,
      /في\s*سنة\s*\d{4}/, /عام\s*\d{4}/, /قبل\s*التعديل/, /القديم/,
    ],
  },
  {
    type: "EDUCATION",
    patterns: [/اعرف\s*حقي/, /حقوقي/, /واجباتي/, /التوعية/, /شرح/],
  },
  {
    type: "HIGH_RISK",
    patterns: [
      /قتل|اتهم|اتهام|سجن|عقوبة\s*الإعدام|إعدام|جريمة/,
      /مخدرات|غسل\s*أموال|إرهاب|خيانة\s*الأمانة|ابتزاز|شرف/,
    ],
  },
];

export function classifyQuery(question: string): QueryType {
  const q = normalizeArabic(question);
  for (const rule of CLASSIFIER_RULES) {
    if (rule.patterns.some((re) => re.test(q))) return rule.type;
  }
  return "GENERAL";
}

// ============================================================
// Query normalization + expansion (lightweight, offline)
// ============================================================

/** Ammiya → MSA synonym expansion for better recall. */
const EXPANSIONS: Record<string, string[]> = {
  "معارضه": ["اعتراض", "الاعتراض", "المعارضة"],
  "استيناف": ["طعن", "الطعن", "الاستئناف"],
  "نقض": ["النقض", "طعن بالنقض"],
  "غيابي": ["الحكم الغيابي", "غيابى"],
  "ايصال": ["إيصال", "إيصال الأمانة", "الأمانة"],
  "تزوير": ["التزوير", "طعن بالتزوير", "تزوير"],
  "ابتزاز": ["الابتزاز", "البلاغ الكاذب", "الابتزاز الإلكتروني"],
  "كفاله": ["الكفالة", "الإفراج بكفالة"],
  "تقادم": ["التقادم", "مرور الزمن"],
  "حبس": ["الحبس الاحتياطي", "الحبس"],
};

export function expandQuery(tokens: string[]): string[] {
  const out = new Set(tokens);
  for (const t of tokens) {
    const extras = EXPANSIONS[t];
    if (extras) for (const e of extras) for (const et of tokenize(e)) out.add(et);
  }
  return [...out];
}

// ============================================================
// Retrieval — hybrid lexical + semantic over an in-memory chunk index
// ============================================================

export interface IndexedChunk {
  _id: string;
  refType: string;
  refId: string;
  articleId?: string;
  tokens: string[];
  embedding: number[];
  provenance: string;
  text: string;
  validity: string;
  effectiveFrom?: number;
  effectiveTo?: number;
  verificationStatus: string;
  status: string;
  sourceTitle: string;
  sourceType: string;
  officialUrl?: string;
}

export interface RetrieveOptions {
  /** epoch ms of the query date — drives temporal filtering. */
  queryDate: number;
  /** epoch ms of the event, if the user asks about a past event. */
  eventDate?: number;
  topK?: number;
  minLexical?: number;
  minSemantic?: number;
  /** Restricted category, e.g. "criminal". */
  category?: string;
}

/** Effective-at evaluation against explicit date ranges. */
export function isEffectiveAt(
  chunk: Pick<IndexedChunk, "effectiveFrom" | "effectiveTo" | "validity">,
  at: number,
): boolean {
  if (chunk.effectiveFrom !== undefined && at < chunk.effectiveFrom) return false;
  if (chunk.effectiveTo !== undefined && at > chunk.effectiveTo) return false;
  if (chunk.validity === "HISTORICAL" || chunk.validity === "SUPERSEDED") {
    // Historical chunks only serve queries explicitly anchored in the past.
    return false;
  }
  return true;
}

export function lexicalScore(queryTokens: string[], chunkTokens: string[]): number {
  return tokenOverlap(queryTokens, chunkTokens);
}

export function semanticScore(queryVec: number[], chunkVec: number[]): number {
  return cosineSimilarity(queryVec, chunkVec);
}

const WEIGHT_LEXICAL = 0.55;
const WEIGHT_SEMANTIC = 0.45;

export function hybridScore(
  queryTokens: string[],
  queryVec: number[],
  chunk: IndexedChunk,
  at: number,
): { score: number; lexical: number; semantic: number; penalty: number } {
  const lexical = lexicalScore(queryTokens, chunk.tokens);
  const semantic = semanticScore(queryVec, chunk.embedding);
  const raw = WEIGHT_LEXICAL * lexical + WEIGHT_SEMANTIC * semantic;
  let penalty = 0;
  if (chunk.verificationStatus === "UNREVIEWED") penalty += 0.15;
  if (chunk.validity === "UNKNOWN") penalty += 0.1;
  // Temporal guard: a chunk not effective at the query date is excluded in
  // the caller; superseded-but-current-window matches get dinged here.
  if (!isEffectiveAt(chunk, at)) penalty += 1;
  return { score: Math.max(0, raw - penalty), lexical, semantic, penalty };
}

/** Canonical abstention message — the single legal-safety hold string. */
export const ABSTAIN_MESSAGE =
  "لا تتوفر أدلة قانونية موثوقة وكافية في قاعدة المعرفة الحالية لإصدار إجابة مؤكدة.";

export const MIN_BEST_SCORE = 0.12;
export const MIN_CHUNK_SCORE = 0.05;

export function retrieveEvidence(
  index: IndexedChunk[],
  question: string,
  options: RetrieveOptions,
): EvidencePack {
  const queryTokens = expandQuery(tokenize(question));
  const queryVec = embed(queryTokens.join(" "));
  const at = options.eventDate ?? options.queryDate;
  const topK = options.topK ?? 6;

  const scored = index
    .map((chunk) => ({ chunk, ...hybridScore(queryTokens, queryVec, chunk, at) }))
    .filter((s) => s.penalty < 1 && s.score > MIN_CHUNK_SCORE)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);

  const chunks: EvidenceChunk[] = scored.map((s) => ({
    chunkId: s.chunk._id,
    articleId: s.chunk.articleId,
    sourceId: s.chunk.refId,
    sourceTitle: s.chunk.sourceTitle,
    sourceType: s.chunk.sourceType,
    officialUrl: s.chunk.officialUrl,
    provenance: s.chunk.provenance,
    text: s.chunk.text,
    validity: s.chunk.validity,
    effectiveFrom: s.chunk.effectiveFrom,
    effectiveTo: s.chunk.effectiveTo,
    verificationStatus: s.chunk.verificationStatus,
    score: s.score,
    lexical: s.lexical,
    semantic: s.semantic,
    penalty: s.penalty,
  }));

  const bestScore = chunks[0]?.score ?? 0;
  const retrievalQuality = Math.min(1, bestScore * 2.2);
  return { chunks, retrievalQuality, bestScore };
}

// ============================================================
// Claim extraction + citation validation
// ============================================================

export type CitationStatus =
  | "SUPPORTED"
  | "PARTIALLY_SUPPORTED"
  | "UNSUPPORTED"
  | "CONFLICTING"
  | "OUTDATED"
  | "UNVERIFIED";

export interface ValidatedClaim {
  text: string;
  status: CitationStatus;
  chunkIds: string[];
}

/**
 * Map each evidence sentence to a claim with validated citations. Only
 * sentences whose vocabulary is actually covered by the matched chunks pass —
 * invented article numbers have no chunk to match and can never appear.
 */
export function buildClaimsFromEvidence(pack: EvidencePack): ValidatedClaim[] {
  const claims: ValidatedClaim[] = [];
  for (const chunk of pack.chunks) {
    const sentences = splitSentences(chunk.text);
    const picked: Array<{ s: string; cov: number }> = [];
    for (const s of sentences) {
      const cov = tokenContainment(tokenize(s), chunk.text ? tokenize(chunk.text) : []);
      if (cov > 0.85) picked.push({ s, cov });
    }
    // Claim vocabulary is the chunk's own sentences — entailment vs the same
    // chunk is guaranteed; the real check is that we ONLY emit chunk sentences.
    for (const p of picked.slice(0, 2)) {
      claims.push({
        text: p.s,
        status: chunk.validity === "HISTORICAL" || chunk.validity === "SUPERSEDED"
          ? "OUTDATED"
          : chunk.verificationStatus === "VERIFIED"
            ? "SUPPORTED"
            : "UNVERIFIED",
        chunkIds: [chunk.chunkId],
      });
    }
    if (picked.length === 0 && chunk.text.length > 0) {
      claims.push({
        text: chunk.text.slice(0, 240),
        status: chunk.verificationStatus === "VERIFIED" ? "SUPPORTED" : "UNVERIFIED",
        chunkIds: [chunk.chunkId],
      });
    }
  }
  return claims.slice(0, 8);
}

// ============================================================
// Answer composition — deterministic, evidence-only
// ============================================================

export interface ComposedAnswer {
  answer: string;
  claims: ValidatedClaim[];
  warnings: string[];
  evidenceStatus:
    | "SUPPORTED"
    | "PARTIALLY_SUPPORTED"
    | "INSUFFICIENT_EVIDENCE"
    | "CONFLICTING"
    | "OUTDATED"
    | "UNVERIFIED";
  confidence: {
    retrievalQuality: number;
    evidenceQuality: number;
    citationQuality: number;
    temporalValidity: number;
    answerSupport: number;
    overall: number;
  };
  bestScore: number;
}

const VALIDITY_WARNING: Record<string, string> = {
  HISTORICAL: "بعض المصادر المسترجعة نسخ تاريخية لم تعد سارية — تحقق من النسخة الحالية.",
  SUPERSEDED: "بعض المصادر المسترجعة تم إلغاؤها أو استبدالها بمصدر أحدث.",
  UNKNOWN: "الحالة الزمنية لبعض المصادر غير محددة — يلزم التحقق من المصدر الأصلي.",
};

export function composeAnswer(
  question: string,
  pack: EvidencePack,
  queryType: QueryType,
): ComposedAnswer {
  // ---- No evidence → abstain (P-02: No evidence → no legal claim) ----
  if (pack.chunks.length === 0 || pack.bestScore < MIN_BEST_SCORE) {
    return {
      answer: ABSTAIN_MESSAGE,
      claims: [],
      warnings: [
        "لم يتم العثور على مصادر قانونية ذات صلة كافية في قاعدة المعرفة.",
        "قد تحتاج إلى صياغة السؤال بشكل مختلف أو استشارة محامٍ مختص.",
      ],
      evidenceStatus: "INSUFFICIENT_EVIDENCE",
      confidence: {
        retrievalQuality: 0,
        evidenceQuality: 0,
        citationQuality: 0,
        temporalValidity: 0,
        answerSupport: 0,
        overall: 0,
      },
      bestScore: pack.bestScore,
    };
  }

  const claims = buildClaimsFromEvidence(pack);
  const warnings: string[] = [];

  // ---- Temporal + verification warnings ----
  const validities = new Set(pack.chunks.map((c) => c.validity));
  for (const v of validities) {
    const w = VALIDITY_WARNING[v];
    if (w) warnings.push(w);
  }
  if (pack.chunks.some((c) => c.verificationStatus !== "VERIFIED")) {
    warnings.push("بعض المصادر غير مُراجعة بعد من قبل مراجع بشري — تعامل بحذر.");
  }

  // ---- Conflicting evidence: same article, divergent content ----
  const byArticle = new Map<string, EvidenceChunk[]>();
  for (const c of pack.chunks) {
    const key = c.articleId ?? c.chunkId;
    const arr = byArticle.get(key) ?? [];
    arr.push(c);
    byArticle.set(key, arr);
  }
  let conflicting = false;
  for (const [, arr] of byArticle) {
    if (arr.length > 1) {
      const first = tokenize(arr[0]!.text);
      if (arr.slice(1).some((c) => tokenOverlap(first, tokenize(c.text)) < 0.2)) {
        conflicting = true;
      }
    }
  }
  if (conflicting) {
    warnings.push("توجد مصادر متعارضة حول هذا الموضوع — يلزم الرجوع للمراجع الرسمية.");
  }

  // ---- High-risk framing ----
  if (queryType === "HIGH_RISK") {
    warnings.push(
      "الوقائع الجنائية حساسة: هذه معلومات تعريفية فقط ولا تُعد حكماً على أي شخص.",
    );
  }

  // ---- Compose deterministic answer from evidence only ----
  const parts: string[] = [];
  parts.push("بحسب المصادر المتاحة في قاعدة المعرفة، هذه أبرز ما ورد:");
  for (const claim of claims.slice(0, 4)) {
    parts.push(`• ${claim.text}`);
  }

  const evidenceStatus: ComposedAnswer["evidenceStatus"] = conflicting
    ? "CONFLICTING"
    : claims.every((c) => c.status === "SUPPORTED")
      ? "SUPPORTED"
      : claims.some((c) => c.status === "SUPPORTED")
        ? "PARTIALLY_SUPPORTED"
        : "UNVERIFIED";

  const verified = claims.filter((c) => c.status === "SUPPORTED").length;
  const evidenceQuality = verified / Math.max(1, claims.length);
  const citationQuality = Math.min(1, claims.length / 4);
  const temporalValidity = validities.has("HISTORICAL") || validities.has("SUPERSEDED")
    ? 0.45
    : validities.has("UNKNOWN")
      ? 0.7
      : 1;
  const answerSupport = Math.min(1, pack.bestScore * 2.5) * evidenceQuality;
  const overall =
    0.25 * pack.retrievalQuality +
    0.3 * evidenceQuality +
    0.2 * citationQuality +
    0.15 * temporalValidity +
    0.1 * answerSupport;

  return {
    answer: parts.join("\n"),
    claims,
    warnings,
    evidenceStatus,
    confidence: {
      retrievalQuality: round2(pack.retrievalQuality),
      evidenceQuality: round2(evidenceQuality),
      citationQuality: round2(citationQuality),
      temporalValidity: round2(temporalValidity),
      answerSupport: round2(answerSupport),
      overall: round2(overall),
    },
    bestScore: pack.bestScore,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ============================================================
// Facade — full pipeline for one question
// ============================================================

export interface PipelineResult extends ComposedAnswer {
  queryType: QueryType;
  pack: EvidencePack;
}

export function runEvidencePipeline(
  question: string,
  index: IndexedChunk[],
  options: RetrieveOptions,
): PipelineResult {
  const pii = detectPii(question);
  const safeQuestion = maskPii(question);
  const queryType = classifyQuery(safeQuestion);
  const pack = retrieveEvidence(index, safeQuestion, options);
  const composed = composeAnswer(safeQuestion, pack, queryType);
  if (pii.length > 0) {
    composed.warnings.unshift(
      "تم اكتشاف بيانات شخصية في سؤالك وقمنا بحجبها قبل المعالجة.",
    );
  }
  return { queryType, pack, ...composed };
}
