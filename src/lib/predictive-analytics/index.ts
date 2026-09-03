/**
 * Predictive Analytics Module — CRIM-SYS 2026
 *
 * Free, transparent case-outcome estimation built on precedent
 * similarity scoring (TF-IDF style keyword overlap). No external ML
 * dependency: predictions are explainable and derived from the
 * Egyptian legal database.
 *
 * Disclaimer: outputs are directional estimates for case strategy,
 * never legal advice. Judges, facts, and evidence ultimately decide.
 */

import { COURT_PRECEDENTS, type LegalCategory } from '../../legal-db/egyptian-codes';

// ============================================================
// Types
// ============================================================

export interface CaseProfile {
  category: LegalCategory;
  /** Key legal keywords, e.g. ["قتل", "ترخيص", "دفاع شرعي"]. */
  keywords: string[];
  /** Procedural facts used for similarity (free text). */
  facts: string;
  /** Optional client-side win/loss history for calibration. */
  pastOutcomes?: Array<{ won: boolean }>;
}

export interface PredictionFactor {
  precedentId: string;
  precedent: string;
  court: string;
  caseNumber: string;
  score: number;
  direction: 'موافق' | 'ضد';
}

export interface PredictionResult {
  category: LegalCategory;
  successRate: number; // 0-100
  confidence: 'مرتفع' | 'متوسط' | 'منخفض';
  matchedPrecedents: PredictionFactor[];
  recommendation: string;
  disclaimer: string;
}

// ============================================================
// Tokenization (shared with RAG retriever approach)
// ============================================================

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^\u0600-\u06FF\u0020-\u007E]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length > 1),
  );
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let intersection = 0;
  for (const token of a) {
    if (b.has(token)) intersection++;
  }
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

// ============================================================
// Predictive Engine
// ============================================================

export class PredictiveAnalyticsEngine {
  /**
   * Estimate the likelihood of a favorable outcome for the case
   * profile based on similar court precedents.
   */
  predict(profile: CaseProfile): PredictionResult {
    const queryTokens = new Set([
      ...tokenize(profile.facts),
      ...profile.keywords.map((k) => k.toLowerCase()),
    ]);

    // Score each precedent by similarity
    const scored = COURT_PRECEDENTS.map((prec) => {
      const precedentText = `${prec.principle} ${prec.court} ${prec.articleRef}`;
      const score = jaccard(queryTokens, tokenize(precedentText));
      return { prec, score };
    })
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    // Base rate: the stronger the precedent support, the higher the rate
    const totalScore = scored.reduce((sum, s) => sum + s.score, 0);
    const coverage = Math.min(totalScore * 100, 80); // precedents contribute up to 80%

    // Calibrate with the lawyer's historical win rate if provided
    let winRateAdjustment = 0;
    const history = profile.pastOutcomes ?? [];
    if (history.length > 0) {
      const wins = history.filter((h) => h.won).length;
      winRateAdjustment = ((wins / history.length) - 0.5) * 10; // ±5%
    }

    const successRate = Math.max(
      5,
      Math.min(95, Math.round(50 + (coverage - 40) + winRateAdjustment)),
    );

    const confidence: PredictionResult['confidence'] =
      scored.length >= 3 ? 'مرتفع' : scored.length >= 1 ? 'متوسط' : 'منخفض';

    const matchedPrecedents: PredictionFactor[] = scored.map((s) => ({
      precedentId: s.prec.id,
      precedent: s.prec.principle,
      court: s.prec.court,
      caseNumber: s.prec.caseNumber,
      score: Math.round(s.score * 100),
      direction: s.score >= 0.15 ? 'موافق' : 'ضد',
    }));

    const recommendation =
      scored.length === 0
        ? 'لا توجد سوابق قضائية مماثلة في قاعدة البيانات — يُنصح بالبحث اليدوي في أحكام محكمة النقض ومجلس الدولة.'
        : matchedPrecedents.some((m) => m.direction === 'موافق')
          ? 'توجد سوابق قضائية موافقة لموقفك — يُنصح بالاستناد إليها في المذكرة مع توثيق كامل للوقائع.'
          : 'السوابق المتشابهة متحفظة — يُنصح بتعزيز الدفوع الإجرائية والتركيز على الوقائع الفريدة للقضية.';

    return {
      category: profile.category,
      successRate,
      confidence,
      matchedPrecedents,
      recommendation,
      disclaimer:
        '⚠️ نتيجة تقديرية استرشادية بناءً على تحليل السوابق — لا تمثل نصيحة قانونية ولا تضمن نتيجة القضية.',
    };
  }
}

// ============================================================
// Singleton + helpers
// ============================================================

let analyticsInstance: PredictiveAnalyticsEngine | null = null;

export function getPredictiveAnalyticsEngine(): PredictiveAnalyticsEngine {
  if (!analyticsInstance) {
    analyticsInstance = new PredictiveAnalyticsEngine();
  }
  return analyticsInstance;
}

/**
 * Quick prediction helper.
 */
export function predictCaseOutcome(profile: CaseProfile): PredictionResult {
  return getPredictiveAnalyticsEngine().predict(profile);
}