/**
 * Predictive Analytics — Case Outcome Predictor (CRIM-SYS 2026)
 *
 * Browser-safe adaptation of the sketch. The original imported
 * `@tensorflow/tfjs` and loaded a model from
 * `./models/case-predictor/model.json` — TensorFlow is not installed
 * and no model artifact ships with this app. Instead the same public
 * contract is implemented with what actually exists here:
 *
 *   1. predictOutcome()        → delegates to the app's precedent engine
 *                                (`PredictiveAnalyticsEngine`): TF-IDF-style
 *                                similarity scoring against the Egyptian
 *                                court-precedents database — transparent and
 *                                explainable, no trained weights required.
 *   2. analyzeSuccessRate()    → computes win rates from the firm's own
 *                                outcome history (logged per case and kept
 *                                in the offline IndexedDB registry).
 *
 * Disclaimer: outputs are directional estimates for case strategy, never
 * legal advice. Judges, facts, and evidence ultimately decide.
 */

import {
  getPredictiveAnalyticsEngine,
  type PredictionResult as EnginePrediction,
} from "@/lib/predictive-analytics";
import {
  cacheData,
  deleteCachedData,
  getCachedData,
} from "@/lib/open-source/offline-sync";
import type { LegalCategory } from "@/legal-db/egyptian-codes";

// ============================================================
// Types
// ============================================================

/** Inputs describing the case to predict (mirrors the sketch). */
export interface CaseFeatures {
  category: LegalCategory;
  /** Key legal keywords, e.g. ["قتل", "دفاع شرعي", "ترخيص"]. */
  keywords: string[];
  /** Free-text procedural facts used for precedent similarity. */
  facts: string;
  /** Optional calibration with this lawyer's own win/loss history. */
  pastOutcomes?: Array<{ won: boolean }>;
}

export interface SimilarCase {
  precedentId: string;
  precedent: string;
  court: string;
  caseNumber: string;
  /** 0–1 similarity. */
  score: number;
  direction: "موافق" | "ضد";
}

export interface PredictionResult {
  /** 0–1 estimate of a favorable outcome. */
  successProbability: number;
  confidence: "مرتفع" | "متوسط" | "منخفض";
  similarCases: SimilarCase[];
  keyFactors: string[];
  recommendations: string[];
  disclaimer: string;
}

export type OutcomeVerdict = "won" | "lost" | "pending";

/** One decided/recorded case outcome for success-rate analysis. */
export interface CaseOutcomeRecord {
  id: string;
  type: "case_outcome";
  /** Case code / number, e.g. "ج-2026-0847". */
  caseRef: string;
  /** Arabic type label, e.g. "جنائي — مخدرات". */
  caseType: string;
  /** Optional lawyer attribution (id or name). */
  lawyerId?: string;
  verdict: OutcomeVerdict;
  /** Approximate duration of the case in days (optional). */
  durationDays?: number;
  createdAt: string;
}

export interface SuccessRateAnalysis {
  /** Records matching the current lawyer + case-type filters. */
  totalCases: number;
  /** Records with a conclusive verdict (won/lost). */
  decidedCases: number;
  /** won / decided × 100 (0 when no decided cases). */
  successRate: number;
  /** Mean duration of decided cases in days (null when unknown). */
  averageDurationDays: number | null;
  /** Strongest case types: at least 2 decided, ranked by win rate. */
  strongestCaseTypes: Array<{ caseType: string; successRate: number; decided: number }>;
  /** Weakest case types: at least 2 decided, ranked by win rate asc. */
  improvementAreas: Array<{ caseType: string; successRate: number; decided: number }>;
  disclaimer: string;
}

export const OUTCOME_VERDICT_LABELS: Record<OutcomeVerdict, string> = {
  won: "نجاح (براءة / قبول)",
  lost: "خسارة (إدانة / رفض)",
  pending: "قيد المحكمة",
};

// ============================================================
// Predictive engine wrapper
// ============================================================

function confidenceRank(c: "مرتفع" | "متوسط" | "منخفض"): number {
  return c === "مرتفع" ? 3 : c === "متوسط" ? 2 : 1;
}

export class CaseOutcomePredictor {
  /**
   * Estimate the outcome of a case from its features using precedent
   * similarity (the model behind the numbers is the Egyptian legal
   * database itself — every factor is explainable).
   */
  predictOutcome(caseData: CaseFeatures): PredictionResult {
    const engine = getPredictiveAnalyticsEngine();
    const raw: EnginePrediction = engine.predict({
      category: caseData.category,
      keywords: caseData.keywords,
      facts: caseData.facts,
      pastOutcomes: caseData.pastOutcomes,
    });

    const similarCases: SimilarCase[] = raw.matchedPrecedents.map((p) => ({
      precedentId: p.precedentId,
      precedent: p.precedent,
      court: p.court,
      caseNumber: p.caseNumber,
      score: p.score / 100,
      direction: p.direction,
    }));

    // Human-readable factors derived from the matched precedents.
    const keyFactors: string[] = [];
    if (similarCases.length > 0) {
      const favorable = similarCases.filter((s) => s.direction === "موافق").length;
      keyFactors.push(
        `${similarCases.length} سابقة متشابهة في قاعدة البيانات (${favorable} منها تدعم موقف الدفاع)`,
      );
      const top = similarCases[0];
      if (top) {
        keyFactors.push(
          `أعلى سابقة تشابهاً: ${top.precedent} — ${top.court}، قضية ${top.caseNumber} (تشابه ${Math.round(top.score * 100)}%)`,
        );
      }
      const against = similarCases.filter((s) => s.direction === "ضد");
      if (against.length > 0) {
        keyFactors.push(
          `${against.length} سابقة متحفظة أو معاكسة — يستحسن تعزيز الدفوع الإجرائية وتوثيق الوقائع الفريدة`,
        );
      }
    } else {
      keyFactors.push("لا توجد سوابق متطابقة — النتيجة معتمدة على الخبرة اليدوية للمحامي");
    }
    if (confidenceRank(raw.confidence) < 3) {
      keyFactors.push(
        raw.confidence === "متوسط"
          ? "عدد السوابق المتطابقة متوسط — يُنصح بمزيد من البحث في أحكام النقض"
          : "عدد السوابق المتطابقة منخفض — التقدير أولي ويحتاج مراجعة",
      );
    }

    return {
      successProbability: raw.successRate / 100,
      confidence: raw.confidence,
      similarCases,
      keyFactors,
      recommendations: [raw.recommendation],
      disclaimer: raw.disclaimer,
    };
  }
}

// ============================================================
// Outcome history (offline registry)
// ============================================================

/**
 * Record a case outcome so future success-rate analysis includes it.
 */
export async function recordCaseOutcome(
  outcome: Omit<CaseOutcomeRecord, "id" | "type" | "createdAt">,
): Promise<CaseOutcomeRecord> {
  const record: CaseOutcomeRecord = {
    ...outcome,
    id: `outcome-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    type: "case_outcome",
    createdAt: new Date().toISOString(),
  };
  await cacheData("attachments", record);
  return record;
}

/** All recorded outcomes, newest first. */
export async function listCaseOutcomes(): Promise<CaseOutcomeRecord[]> {
  const all = (await getCachedData("attachments")) as CaseOutcomeRecord[];
  return all
    .filter((r) => r.type === "case_outcome")
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Remove a recorded outcome. */
export async function deleteCaseOutcome(id: string): Promise<void> {
  await deleteCachedData("attachments", id);
}

// ============================================================
// Success-rate analysis (mirrors analyzeSuccessRate sketch method)
// ============================================================

const MIN_SAMPLE = 2; // minimum decided cases before ranking a type

function rateStats(records: CaseOutcomeRecord[]): {
  successRate: number;
  averageDurationDays: number | null;
} {
  const decided = records.filter((r) => r.verdict !== "pending");
  const won = decided.filter((r) => r.verdict === "won").length;
  const successRate = decided.length === 0 ? 0 : (won / decided.length) * 100;

  const durations = decided
    .map((r) => r.durationDays)
    .filter((d): d is number => typeof d === "number" && d >= 0);
  const averageDurationDays =
    durations.length === 0 ? null : durations.reduce((s, d) => s + d, 0) / durations.length;

  return { successRate, averageDurationDays };
}

export class SuccessRateAnalyzer {
  /**
   * Analyze the firm's win rate per lawyer / case type from the local
   * outcome registry. `records` is optional — when omitted the registry
   * is read from the offline store.
   */
  async analyzeSuccessRate(
    lawyerId: string | null,
    caseType: string,
    records?: CaseOutcomeRecord[],
  ): Promise<SuccessRateAnalysis> {
    const source = records ?? (await listCaseOutcomes());

    const scoped = source.filter((r) => {
      if (lawyerId && r.lawyerId && r.lawyerId !== lawyerId) return false;
      if (caseType !== "الكل" && r.caseType !== caseType) return false;
      return true;
    });

    const { successRate, averageDurationDays } = rateStats(scoped);
    const decided = scoped.filter((r) => r.verdict !== "pending").length;

    // Per-type ranking over the lawyer scope (caseType filter excluded).
    const scopedByLawyer = source.filter((r) => !lawyerId || !r.lawyerId || r.lawyerId === lawyerId);
    const byType = new Map<string, CaseOutcomeRecord[]>();
    for (const record of scopedByLawyer) {
      if (record.verdict === "pending") continue;
      const list = byType.get(record.caseType) ?? [];
      list.push(record);
      byType.set(record.caseType, list);
    }

    const ranked = Array.from(byType.entries())
      .map(([caseTypeName, list]) => {
        const won = list.filter((r) => r.verdict === "won").length;
        return {
          caseType: caseTypeName,
          successRate: (won / list.length) * 100,
          decided: list.length,
        };
      })
      .filter((t) => t.decided >= MIN_SAMPLE)
      .sort((a, b) => b.successRate - a.successRate);

    return {
      totalCases: scoped.length,
      decidedCases: decided,
      successRate,
      averageDurationDays,
      strongestCaseTypes: ranked.slice(0, 3),
      improvementAreas: [...ranked].reverse().slice(0, 3),
      disclaimer:
        "⚠️ تحليل إحصائي استرشادي مبني على السجل المحلي للنتائج — لا يمثل تقييماً للمحامي ولا ضماناً للنتائج المستقبلية.",
    };
  }
}

// ============================================================
// Singleton + convenience helpers
// ============================================================

let predictorInstance: CaseOutcomePredictor | null = null;
let analyzerInstance: SuccessRateAnalyzer | null = null;

export function getCaseOutcomePredictor(): CaseOutcomePredictor {
  if (!predictorInstance) predictorInstance = new CaseOutcomePredictor();
  return predictorInstance;
}

export function getSuccessRateAnalyzer(): SuccessRateAnalyzer {
  if (!analyzerInstance) analyzerInstance = new SuccessRateAnalyzer();
  return analyzerInstance;
}

/** One-shot prediction helper. */
export function predictCaseOutcome(features: CaseFeatures): PredictionResult {
  return getCaseOutcomePredictor().predictOutcome(features);
}
