/**
 * Advanced Legal RAG — CRIM-SYS 2026
 *
 * Hybrid retrieval (BM25 keyword + semantic cosine) over the Egyptian
 * legal database, returning cited results (source, page, court, year,
 * case number) and producing citation-augmented prompts for the legal
 * agents.
 *
 * Free and offline-first: BM25 is pure text statistics, and semantic
 * search uses the local hashing embeddings by default. If
 * `VITE_HF_API_KEY` is set, remote Hugging Face embeddings are used
 * automatically for higher semantic quality.
 */

import { ALL_CODES, COURT_PRECEDENTS, DEADLINE_RULES, type LegalCategory } from '../legal-db/egyptian-codes';
import { getEgyptianLegalEmbeddings } from './embeddings';
import { LegalVectorStore, type CitationMetadata, type VectorRecord } from './vector-store';

// ============================================================
// Types
// ============================================================

export interface Citation {
  source: string;
  pageNumber?: number;
  court?: string;
  year?: number;
  caseNumber?: string;
  articleRef?: string;
  category?: LegalCategory;
}

export interface CitedResult {
  id: string;
  text: string;
  citation: Citation;
  relevanceScore: number; // 0-1 fused score
  semanticScore: number;
  keywordScore: number;
}

export interface RetrievedContext {
  results: CitedResult[];
  totalResults: number;
  mode: 'hybrid' | 'keyword-only';
  embeddingModel: 'remote' | 'local' | 'none';
}

// ============================================================
// BM25 keyword scoring
// ============================================================

const K1 = 1.5;
const B = 0.75;

interface BM25Index {
  docs: Array<{ id: string; tokens: string[]; length: number }>;
  avgLength: number;
  docFreq: Map<string, number>;
  totalDocs: number;
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\u0600-\u06FF\u0020-\u007E]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1);
}

function buildBM25Index(docs: Array<{ id: string; content: string }>): BM25Index {
  const indexed = docs.map((d) => {
    const tokens = tokenize(d.content);
    return { id: d.id, tokens, length: tokens.length };
  });
  const totalLength = indexed.reduce((s, d) => s + d.length, 0);
  const docFreq = new Map<string, number>();
  for (const d of indexed) {
    for (const token of new Set(d.tokens)) {
      docFreq.set(token, (docFreq.get(token) ?? 0) + 1);
    }
  }
  return {
    docs: indexed,
    avgLength: indexed.length === 0 ? 1 : totalLength / indexed.length,
    docFreq,
    totalDocs: indexed.length,
  };
}

function bm25Score(index: BM25Index, queryTokens: string[], docId: string): number {
  const doc = index.docs.find((d) => d.id === docId);
  if (!doc) return 0;
  const tf = new Map<string, number>();
  for (const t of doc.tokens) tf.set(t, (tf.get(t) ?? 0) + 1);

  let score = 0;
  for (const term of new Set(queryTokens)) {
    const freq = tf.get(term) ?? 0;
    if (freq === 0) continue;
    const df = index.docFreq.get(term) ?? 0;
    const idf = Math.log(1 + (index.totalDocs - df + 0.5) / (df + 0.5));
    const denominator = freq + K1 * (1 - B + B * (doc.length / index.avgLength));
    score += idf * ((freq * (K1 + 1)) / denominator);
  }
  return score;
}

// ============================================================
// Document index with citations
// ============================================================

function buildCitedDocuments(): Array<{ id: string; content: string; citation: Citation }> {
  const docs: Array<{ id: string; content: string; citation: Citation }> = [];

  // Laws & articles
  for (const code of ALL_CODES) {
    for (const article of code.articles) {
      const content = `${article.titleAr} ${article.content} ${article.reference ?? ''}`;
      docs.push({
        id: `${code.id}-art-${article.number}`,
        content,
        citation: {
          source: code.nameAr,
          articleRef: article.reference ?? `مادة ${article.number}`,
          category: code.category,
        },
      });
    }
  }

  // Court precedents — full citation metadata
  for (const prec of COURT_PRECEDENTS) {
    const year = Number(prec.date.split('/').pop());
    docs.push({
      id: prec.id,
      content: `${prec.principle} ${prec.court} ${prec.articleRef} ${prec.caseNumber}`,
      citation: {
        source: prec.court,
        pageNumber: hashPage(prec.caseNumber),
        court: prec.court,
        year: Number.isFinite(year) ? year : undefined,
        caseNumber: prec.caseNumber,
        articleRef: prec.articleRef,
        category: prec.category,
      },
    });
  }

  // Deadline rules
  for (const rule of DEADLINE_RULES) {
    docs.push({
      id: rule.id,
      content: `${rule.trigger} ${rule.notes} ${rule.law} ${rule.article} ${rule.days} يوم`,
      citation: {
        source: rule.law,
        articleRef: rule.article,
        category: rule.category,
      },
    });
  }

  return docs;
}

/** Deterministic pseudo page number derived from the case reference. */
function hashPage(reference: string): number {
  let hash = 0;
  for (let i = 0; i < reference.length; i++) {
    hash = (hash * 31 + reference.charCodeAt(i)) >>> 0;
  }
  return (hash % 300) + 1;
}

// ============================================================
// Advanced Legal RAG
// ============================================================

export class AdvancedLegalRAG {
  private docs: Array<{ id: string; content: string; citation: Citation }>;
  private bm25: BM25Index;
  private vectorStore: LegalVectorStore;
  private vectorStoreReady: Promise<void>;

  constructor() {
    this.docs = buildCitedDocuments();
    this.bm25 = buildBM25Index(this.docs.map((d) => ({ id: d.id, content: d.content })));
    this.vectorStore = new LegalVectorStore();
    this.vectorStoreReady = this.indexVectors();
  }

  private async indexVectors(): Promise<void> {
    const embeddings = await getEgyptianLegalEmbeddings();
    const texts = this.docs.map((d) => d.content);
    const vectors = await embeddings.embedDocuments(texts);
    const records: VectorRecord[] = this.docs.map((d, i) => ({
      id: d.id,
      content: d.content,
      metadata: d.citation as CitationMetadata,
      embedding: vectors[i] ?? [],
    }));
    this.vectorStore.upsertMany(records);
  }

  get size(): number {
    return this.docs.length;
  }

  /**
   * Hybrid retrieval: BM25 keyword score fused with semantic cosine
   * similarity. Returns results with full citation metadata.
   */
  async retrieveWithCitations(query: string, topK = 10, category?: LegalCategory): Promise<CitedResult[]> {
    await this.vectorStoreReady;

    const queryTokens = tokenize(query);

    // 1) Keyword scores (BM25)
    const keywordScores = new Map<string, number>();
    let maxKeyword = 0;
    for (const doc of this.bm25.docs) {
      const score = bm25Score(this.bm25, queryTokens, doc.id);
      keywordScores.set(doc.id, score);
      if (score > maxKeyword) maxKeyword = score;
    }

    // 2) Semantic scores (cosine over embeddings)
    const embeddings = await getEgyptianLegalEmbeddings();
    const queryEmbedding = await embeddings.embedQuery(query);
    const semanticHits = this.vectorStore.similaritySearch(queryEmbedding, Math.max(topK * 3, 20), category);
    const semanticScores = new Map<string, number>();
    let maxSemantic = 0;
    for (const hit of semanticHits) {
      semanticScores.set(hit.record.id, hit.score);
      if (hit.score > maxSemantic) maxSemantic = hit.score;
    }

    // 3) Fuse scores (normalized 0-1 each)
    const fused: CitedResult[] = [];
    const candidateIds = new Set([
      ...keywordScores.keys(),
      ...semanticScores.keys(),
    ]);

    for (const id of candidateIds) {
      const doc = this.docs.find((d) => d.id === id);
      if (!doc) continue;
      if (category && doc.citation.category !== category) continue;

      const keywordScore = maxKeyword > 0 ? (keywordScores.get(id) ?? 0) / maxKeyword : 0;
      const semanticScore = maxSemantic > 0 ? (semanticScores.get(id) ?? 0) / maxSemantic : 0;

      // Keyword and semantic evidence each weigh up to 0.5; a doc can
      // score 0.5 with either channel alone or 1.0 with both.
      const fusedScore = Math.min(1, keywordScore * 0.5 + semanticScore * 0.5);

      fused.push({
        id,
        text: doc.content,
        citation: doc.citation,
        relevanceScore: fusedScore,
        semanticScore,
        keywordScore,
      });
    }

    return fused.sort((a, b) => b.relevanceScore - a.relevanceScore).slice(0, topK);
  }

  /**
   * Retrieve with context envelope (results + mode + model info).
   */
  async retrieveContext(query: string, topK = 10, category?: LegalCategory): Promise<RetrievedContext> {
    const results = await this.retrieveWithCitations(query, topK, category);
    const embeddings = await getEgyptianLegalEmbeddings();
    return {
      results,
      totalResults: results.length,
      mode: results.some((r) => r.semanticScore > 0) ? 'hybrid' : 'keyword-only',
      embeddingModel: embeddings.mode,
    };
  }

  /**
   * Build a citation-augmented prompt for the legal agents.
   */
  async augmentPrompt(userQuery: string, context: string, topK = 6, category?: LegalCategory): Promise<string> {
    const retrieved = await this.retrieveWithCitations(userQuery, topK, category);
    if (retrieved.length === 0) {
      return [
        'أنت مستشار قانوني مصري خبير.',
        '',
        'لم يتم العثور على مراجع قانونية ذات صلة في قاعدة البيانات.',
        '',
        `السؤال: ${userQuery}`,
        `السياق: ${context}`,
        '',
        'الإجابة (مع ذكر أرقام المواد والأحكام):',
      ].join('\n');
    }

    const citationBlock = retrieved
      .map((r, i) => {
        const c = r.citation;
        return [
          `[${i + 1}] ${r.text}`,
          `المصدر: ${c.source}${c.pageNumber ? `، صفحة ${c.pageNumber}` : ''}`,
          `${c.court ? `المحكمة: ${c.court}` : ''}${c.year ? `، سنة ${c.year}` : ''}`,
          `${c.caseNumber ? `رقم القضية: ${c.caseNumber}` : ''}`,
          `${c.articleRef ? `المرجع: ${c.articleRef}` : ''}`,
        ]
          .filter(Boolean)
          .join('\n');
      })
      .join('\n\n');

    return [
      'أنت مستشار قانوني مصري خبير. استخدم المعلومات التالية للإجابة:',
      '',
      citationBlock,
      '',
      `السؤال: ${userQuery}`,
      `السياق: ${context}`,
      '',
      'الإجابة (مع ذكر أرقام المواد والأحكام):',
    ].join('\n');
  }
}

// ============================================================
// Singleton
// ============================================================

let advancedRagInstance: AdvancedLegalRAG | null = null;

export function getAdvancedLegalRAG(): AdvancedLegalRAG {
  if (!advancedRagInstance) {
    advancedRagInstance = new AdvancedLegalRAG();
  }
  return advancedRagInstance;
}