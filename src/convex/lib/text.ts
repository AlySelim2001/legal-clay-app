/**
 * Arabic text utilities for the Evidence-First legal pipeline (Convex side).
 *
 * Pure functions only — no Convex imports — so they are unit-testable and
 * reusable by mutations, actions and the evaluation runner.
 */

// ============================================================
// Arabic normalization (mirrors src/rag/retriever.ts semantics)
// ============================================================

/** Strip diacritics/tatweel, unify alef/yaa/taa variants, drop non-Arabic. */
export function normalizeArabic(text: string): string {
  return text
    .toLowerCase()
    // eslint-disable-next-line no-control-regex -- intentional unicode ranges
    .replace(/[\u064B-\u0652\u0670\u0640]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[^\u0600-\u06FF\u0020-\u007E]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const STOP_WORDS = new Set([
  "في","من","على","عن","الى","الي","هو","هي","ما","هذا","هذه","ذلك","التي",
  "الذي","كما","هل","ثم","او","أو","مع","كل","بين","قد","لا","ان","أن","إن",
  "كان","كانت","يكون","لقد","the","is","a","of","and","to","in","for",
]);

/** Normalized tokens with stop-word removal. */
export function tokenize(text: string): string[] {
  return normalizeArabic(text)
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOP_WORDS.has(t));
}

/** Sentence-ish split respecting Arabic terminators. */
export function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.؟!؛\n])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 8);
}

// ============================================================
// Hashing embeddings (mirrors src/rag/embeddings.ts — 256 dims)
// ============================================================

export const EMBEDDING_DIM = 256;

function hashToken(token: string): number {
  let hash = 0;
  for (let i = 0; i < token.length; i++) {
    hash = (hash * 31 + token.charCodeAt(i)) >>> 0;
  }
  return hash;
}

/** Deterministic offline embedding — no network, no keys. */
export function embed(text: string): number[] {
  const vector = new Array<number>(EMBEDDING_DIM).fill(0);
  for (const token of tokenize(text)) {
    const idx = hashToken(token) % EMBEDDING_DIM;
    vector[idx] = (vector[idx] ?? 0) + 1;
  }
  const norm = Math.sqrt(vector.reduce((s, v) => s + v * v, 0)) || 1;
  return vector.map((v) => v / norm);
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length === 0 || a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!;
    normA += a[i]! * a[i]!;
    normB += b[i]! * b[i]!;
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

/** Token-set overlap (Jaccard) — used for lexical scoring and entailment. */
export function tokenOverlap(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const setA = new Set(a);
  const setB = new Set(b);
  let inter = 0;
  for (const t of setA) if (setB.has(t)) inter++;
  return inter / (setA.size + setB.size - inter);
}

/** Containment: how much of the claim's vocabulary is covered by evidence. */
export function tokenContainment(claim: string[], evidence: string[]): number {
  if (claim.length === 0) return 0;
  const setE = new Set(evidence);
  let covered = 0;
  for (const t of claim) if (setE.has(t)) covered++;
  return covered / claim.length;
}

// ============================================================
// Content fingerprint (non-cryptographic integrity marker)
// ============================================================

/** FNV-1a 64-bit-ish fingerprint as hex — integrity marker, not a secret. */
export function contentFingerprint(text: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    h1 = (h1 ^ c) >>> 0;
    h1 = Math.imul(h1, 0x01000193) >>> 0;
    h2 = (h2 + Math.imul(c + i, 0x85ebca6b)) >>> 0;
  }
  return `fnv1a-${h1.toString(16).padStart(8, "0")}${h2.toString(16).padStart(8, "0")}`;
}

// ============================================================
// PII detection (warn-only in questions — never block exploration)
// ============================================================

const NID_PATTERN = /\b[23]\d{13}\b/;
const PHONE_PATTERN = /\b01[0125]\d{8}\b/;

/** Detects Egyptian PII in free text. Returns masked categories found. */
export function detectPii(text: string): string[] {
  const found: string[] = [];
  const normalizedDigits = text.replace(/[\u0660-\u0669]/g, (d) =>
    String(d.charCodeAt(0) - 0x0660),
  );
  if (NID_PATTERN.test(normalizedDigits)) found.push("رقم_قومي");
  if (PHONE_PATTERN.test(normalizedDigits)) found.push("هاتف");
  return found;
}

/** Masks detected PII before the text is stored in answers. */
export function maskPii(text: string): string {
  return text
    .replace(/(\b[23]\d{6})\d{6}(\d{2}\b)/g, "$1••••••$2")
    .replace(/\b(01[0125])\d{7}(\d)\b/g, "$1•••••••$2");
}

// ============================================================
// Prompt-injection screening for uploaded document text (T-002)
// ============================================================

const INJECTION_PATTERNS: Array<{ re: RegExp; label: string }> = [
  { re: /ignore\s+(all\s+)?(previous|prior|above)\s+instructions/i, label: "تجاهل التعليمات" },
  { re: /disregard\s+(all\s+)?(previous|prior|system)/i, label: "تجاهل النظام" },
  { re: /you\s+are\s+now\s+(a|an|the)/i, label: "إعادة تعريف الدور" },
  { re: /system\s*[:：]\s*prompt/i, label: "انتحال رسالة النظام" },
  { re: /تجاهل\s+(كل\s+)?التعليمات/i, label: "تجاهل التعليمات" },
  { re: /تجاهل\s+ما\s+(سبق|قبل)/i, label: "تجاهل ما سبق" },
  { re: /اعتبارك\s+الآن/i, label: "إعادة تعريف الدور" },
];

/** Returns matched injection heuristics — documents are DATA, never instructions. */
export function scanInjection(text: string): string[] {
  return INJECTION_PATTERNS.filter((p) => p.re.test(text)).map((p) => p.label);
}
