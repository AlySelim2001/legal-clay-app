/**
 * RAG (Retrieval-Augmented Generation) Retriever for Legal Documents
 *
 * Provides semantic search over the Egyptian legal database.
 * Uses keyword matching + TF-IDF scoring for client-side retrieval.
 * Ready to plug into a vector database (Pinecone/Weaviate) when available.
 */

import {
  ALL_CODES,
  COURT_PRECEDENTS,
  DEADLINE_RULES,
  type LegalCategory,
} from '../legal-db/egyptian-codes';

// ============================================================
// Types
// ============================================================

export interface RAGDocument {
  id: string;
  content: string;
  metadata: {
    source: string;
    type: 'article' | 'precedent' | 'deadline';
    category: LegalCategory;
    law?: string;
    articleRef?: string;
    court?: string;
    date?: string;
  };
  score?: number;
}

export interface RAGQuery {
  text: string;
  category?: LegalCategory;
  topK?: number;
  typeFilter?: 'article' | 'precedent' | 'deadline';
}

export interface RAGResponse {
  documents: RAGDocument[];
  query: string;
  totalResults: number;
}

// ============================================================
// TF-IDF Scoring
// ============================================================

/**
 * Arabic-aware normalization: strips diacritics and tatweel, unifies
 * alef/hamza variants (أ إ آ → ا), final yaa (ى → ي) and taa marbuta
 * (ة → ه) so different written forms of the same word match each other.
 */
function normalizeArabic(text: string): string {
  return text
    .toLowerCase()
    .replace(/[\u064B-\u0652\u0670\u0640]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[^\u0600-\u06FF\u0020-\u007E]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(text: string): string[] {
  return normalizeArabic(text)
    .split(/\s+/)
    .filter((t) => t.length > 1);
}

function charBigrams(token: string): Set<string> {
  const grams = new Set<string>();
  for (let i = 0; i < token.length - 1; i++) {
    grams.add(token.slice(i, i + 2));
  }
  return grams;
}

/** Overlap ratio of two token bigram sets (0..1). */
function bigramOverlap(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const gram of a) {
    if (b.has(gram)) intersection++;
  }
  return intersection / Math.min(a.size, b.size);
}

function computeTF(tokens: string[]): Map<string, number> {
  const tf = new Map<string, number>();
  const total = tokens.length;
  for (const token of tokens) {
    tf.set(token, (tf.get(token) ?? 0) + 1);
  }
  for (const [key, val] of tf) {
    tf.set(key, val / total);
  }
  return tf;
}

function computeIDF(documents: string[][]): Map<string, number> {
  const idf = new Map<string, number>();
  const N = documents.length;
  const docFreq = new Map<string, number>();

  for (const doc of documents) {
    const uniqueTokens = new Set(doc);
    for (const token of uniqueTokens) {
      docFreq.set(token, (docFreq.get(token) ?? 0) + 1);
    }
  }

  for (const [token, freq] of docFreq) {
    idf.set(token, Math.log((N + 1) / (freq + 1)) + 1);
  }

  return idf;
}

/**
 * TF-IDF score with fuzzy fallback: when a query token has no exact
 * document term, its character-bigram overlap against candidate terms
 * (length ±3) catches Arabic morphological variants that normalization
 * could not unify (prefixes, inflections, broken plurals). Only strong
 * overlaps (≥ 0.55) contribute, at a discounted weight, to avoid noise.
 */
function scoreDocument(
  queryTF: Map<string, number>,
  idf: Map<string, number>,
  docTokens: string[]
): number {
  const docTF = computeTF(docTokens);
  const bigramCache = new Map<string, Set<string>>();
  const gramsOf = (token: string): Set<string> => {
    let grams = bigramCache.get(token);
    if (!grams) {
      grams = charBigrams(token);
      bigramCache.set(token, grams);
    }
    return grams;
  };

  let score = 0;
  for (const [term, qtf] of queryTF) {
    const idfVal = idf.get(term) ?? 1;
    const dtf = docTF.get(term) ?? 0;
    if (dtf > 0) {
      score += qtf * dtf * idfVal;
      continue;
    }

    const queryGrams = gramsOf(term);
    let bestOverlap = 0;
    for (const docToken of docTF.keys()) {
      if (Math.abs(docToken.length - term.length) > 3) continue;
      const overlap = bigramOverlap(queryGrams, gramsOf(docToken));
      if (overlap > bestOverlap) bestOverlap = overlap;
    }
    if (bestOverlap >= 0.55) {
      score += qtf * 0.6 * idfVal * bestOverlap;
    }
  }

  return score;
}

// ============================================================
// Document Index
// ============================================================

let documentIndex: RAGDocument[] | null = null;
let idfCache: Map<string, number> | null = null;

function buildIndex(): RAGDocument[] {
  if (documentIndex) return documentIndex;

  const docs: RAGDocument[] = [];

  // Index all legal articles
  for (const code of ALL_CODES) {
    for (const article of code.articles) {
      docs.push({
        id: `${code.id}-art-${article.number}`,
        content: `${article.titleAr} ${article.content} ${article.reference ?? ''}`,
        metadata: {
          source: code.nameAr,
          type: 'article',
          category: code.category,
          law: code.nameAr,
          articleRef: article.reference,
        },
      });
    }
  }

  // Index court precedents
  for (const prec of COURT_PRECEDENTS) {
    docs.push({
      id: prec.id,
      content: `${prec.principle} ${prec.court} ${prec.articleRef} ${prec.caseNumber}`,
      metadata: {
        source: prec.court,
        type: 'precedent',
        category: prec.category,
        court: prec.court,
        articleRef: prec.articleRef,
        date: prec.date,
      },
    });
  }

  // Index deadline rules
  for (const rule of DEADLINE_RULES) {
    docs.push({
      id: rule.id,
      content: `${rule.trigger} ${rule.notes} ${rule.law} ${rule.article} ${rule.days} يوم`,
      metadata: {
        source: rule.law,
        type: 'deadline',
        category: rule.category,
        law: rule.law,
        articleRef: rule.article,
      },
    });
  }

  // Build IDF
  const allTokens = docs.map((d) => tokenize(d.content));
  idfCache = computeIDF(allTokens);

  documentIndex = docs;
  return docs;
}

// ============================================================
// RAG Retriever
// ============================================================

export class RAGRetriever {
  private topK: number;
  private category?: LegalCategory;
  private typeFilter?: 'article' | 'precedent' | 'deadline';

  constructor(options: {
    topK?: number;
    collection?: string;
    category?: LegalCategory;
    typeFilter?: 'article' | 'precedent' | 'deadline';
  } = {}) {
    this.topK = options.topK ?? 5;
    this.category = options.category;
    this.typeFilter = options.typeFilter;
  }

  async retrieve(query: string): Promise<RAGDocument[]> {
    const docs = buildIndex();
    const idf = idfCache!;

    // Apply filters
    let filtered = docs;
    if (this.category) {
      filtered = filtered.filter((d) => d.metadata.category === this.category);
    }
    if (this.typeFilter) {
      filtered = filtered.filter((d) => d.metadata.type === this.typeFilter);
    }

    // Score documents
    const queryTokens = tokenize(query);
    const queryTF = computeTF(queryTokens);

    const scored = filtered.map((doc) => {
      const docTokens = tokenize(doc.content);
      const score = scoreDocument(queryTF, idf, docTokens);

      // Boost exact (normalized) matches
      const boost = normalizeArabic(doc.content).includes(normalizeArabic(query))
        ? 2.0
        : 1.0;

      return { ...doc, score: score * boost };
    });

    // Sort by score and return top K
    return scored
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
      .slice(0, this.topK)
      .filter((d) => (d.score ?? 0) > 0);
  }

  async retrieveWithContext(query: string): Promise<RAGResponse> {
    const documents = await this.retrieve(query);
    return {
      documents,
      query,
      totalResults: documents.length,
    };
  }

  /**
   * Multi-query retrieval: run multiple queries and merge results.
   */
  async multiQueryRetrieve(queries: string[]): Promise<RAGResponse> {
    const allDocs = new Map<string, RAGDocument>();

    for (const q of queries) {
      const results = await this.retrieve(q);
      for (const doc of results) {
        const existing = allDocs.get(doc.id);
        if (!existing || (doc.score ?? 0) > (existing.score ?? 0)) {
          allDocs.set(doc.id, doc);
        }
      }
    }

    const documents = Array.from(allDocs.values())
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
      .slice(0, this.topK);

    return {
      documents,
      query: queries.join(' | '),
      totalResults: documents.length,
    };
  }

  /**
   * Format retrieved documents as context for LLM.
   */
  static formatAsContext(docs: RAGDocument[]): string {
    if (docs.length === 0) return 'لا توجد مراجع قانونية ذات صلة.';

    return docs
      .map((doc, i) => {
        const typeLabel =
          doc.metadata.type === 'article'
            ? '📏 مرجع قانوني'
            : doc.metadata.type === 'precedent'
              ? '⚖️ حكم قضائي'
              : '⏰ قاعدة مواعيد';

        return `${typeLabel} [${i + 1}]\n${doc.content}\nالمصدر: ${doc.metadata.source}`;
      })
      .join('\n\n---\n\n');
  }
}

// ============================================================
// Specialized Retrievers
// ============================================================

export const criminalRetriever = new RAGRetriever({
  topK: 5,
  category: 'criminal',
});

export const civilRetriever = new RAGRetriever({
  topK: 5,
  category: 'civil',
});

export const familyRetriever = new RAGRetriever({
  topK: 5,
  category: 'family',
});

export const administrativeRetriever = new RAGRetriever({
  topK: 5,
  category: 'administrative',
});

export const laborRetriever = new RAGRetriever({
  topK: 5,
  category: 'labor',
});

export const precedentsRetriever = new RAGRetriever({
  topK: 5,
  typeFilter: 'precedent',
});

export const deadlinesRetriever = new RAGRetriever({
  topK: 5,
  typeFilter: 'deadline',
});
