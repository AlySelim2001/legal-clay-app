/**
 * Egyptian Legal Embeddings — CRIM-SYS 2026
 *
 * Embedding provider for the legal vector store.
 *
 * Two modes:
 * 1. Local (default, offline, free): deterministic hashing-based
 *    bag-of-tokens embeddings. No network, no keys. Good enough for
 *    lexical-semantic overlap in Arabic legal text.
 * 2. Remote (optional): Hugging Face Inference API embeddings
 *    (e.g. sentence-transformers models fine-tuned for Arabic) used
 *    automatically when `VITE_HF_API_KEY` is present.
 */

// ============================================================
// Local Hashing Embeddings
// ============================================================

const EMBEDDING_DIM = 256;

function hashToken(token: string): number {
  let hash = 0;
  for (let i = 0; i < token.length; i++) {
    hash = (hash * 31 + token.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function tokenizeForEmbedding(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\u0600-\u06FF\u0020-\u007E]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1);
}

function localEmbed(text: string): number[] {
  const vector = new Array<number>(EMBEDDING_DIM).fill(0);
  const tokens = tokenizeForEmbedding(text);
  for (const token of tokens) {
    const idx = hashToken(token) % EMBEDDING_DIM;
    vector[idx] = (vector[idx] ?? 0) + 1;
  }
  // L2 normalize
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

// ============================================================
// Hugging Face Inference API (optional remote embeddings)
// ============================================================

const HF_INFERENCE_URL = 'https://api-inference.huggingface.co/pipeline/feature-extraction';
const HF_MODEL = 'sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2';

async function remoteEmbedBatch(texts: string[]): Promise<number[][] | null> {
  const apiKey = import.meta.env.VITE_HF_API_KEY as string | undefined;
  if (!apiKey) return null;

  try {
    const res = await fetch(`${HF_INFERENCE_URL}/${HF_MODEL}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ inputs: texts, options: { wait_for_model: true } }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as number[][] | number[];
    if (Array.isArray(data) && data.length > 0 && Array.isArray(data[0])) {
      return data as number[][];
    }
    return null;
  } catch {
    return null;
  }
}

// ============================================================
// Embedding Provider
// ============================================================

export interface EmbeddingsProvider {
  embedDocuments(texts: string[]): Promise<number[][]>;
  embedQuery(text: string): Promise<number[]>;
}

export class EgyptianLegalEmbeddings implements EmbeddingsProvider {
  private useRemote = false;
  private dim = EMBEDDING_DIM;

  /** Probe once whether the remote provider is available. */
  async initialize(): Promise<void> {
    if (import.meta.env.VITE_HF_API_KEY) {
      const sample = await remoteEmbedBatch(['اختبار']);
      this.useRemote = sample !== null;
    }
  }

  async embedDocuments(texts: string[]): Promise<number[][]> {
    if (this.useRemote) {
      const remote = await remoteEmbedBatch(texts);
      if (remote) {
        this.dim = remote[0]?.length ?? EMBEDDING_DIM;
        return remote;
      }
    }
    return texts.map((t) => localEmbed(t));
  }

  async embedQuery(text: string): Promise<number[]> {
    const [embedded] = await this.embedDocuments([text]);
    return embedded ?? localEmbed(text);
  }

  get dimension(): number {
    return this.dim;
  }

  get mode(): 'remote' | 'local' {
    return this.useRemote ? 'remote' : 'local';
  }
}

// ============================================================
// Singleton
// ============================================================

let embeddingsInstance: EgyptianLegalEmbeddings | null = null;

export async function getEgyptianLegalEmbeddings(): Promise<EgyptianLegalEmbeddings> {
  if (!embeddingsInstance) {
    embeddingsInstance = new EgyptianLegalEmbeddings();
    await embeddingsInstance.initialize();
  }
  return embeddingsInstance;
}