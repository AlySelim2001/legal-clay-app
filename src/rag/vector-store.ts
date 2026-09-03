/**
 * Legal Vector Store — CRIM-SYS 2026
 *
 * In-memory vector store over the Egyptian legal database, designed to
 * mirror the Supabase pgvector interface so it can be lifted to a real
 * `legal_embeddings` table without changing consumers.
 *
 * Supabase / pgvector schema this mirrors:
 *
 *   create extension if not exists vector;
 *   create table legal_embeddings (
 *     id            text primary key,
 *     content       text not null,
 *     source        text not null,
 *     page_number   int,
 *     court         text,
 *     year          int,
 *     case_number   text,
 *     article_ref   text,
 *     category      text,
 *     embedding     vector(384)
 *   );
 *
 *   create index on legal_embeddings using hnsw (embedding vector_cosine_ops);
 */

import { cosineSimilarity } from './embeddings';
import type { LegalCategory } from '../legal-db/egyptian-codes';

// ============================================================
// Types
// ============================================================

export interface CitationMetadata {
  source: string;
  pageNumber?: number;
  court?: string;
  year?: number;
  caseNumber?: string;
  articleRef?: string;
  category?: LegalCategory;
}

export interface VectorRecord {
  id: string;
  content: string;
  metadata: CitationMetadata;
  embedding: number[];
}

export interface VectorSearchResult {
  record: VectorRecord;
  score: number;
}

// ============================================================
// In-memory vector store (pgvector-compatible interface)
// ============================================================

export class LegalVectorStore {
  private records = new Map<string, VectorRecord>();

  /** Insert or replace a record. */
  upsert(record: VectorRecord): void {
    this.records.set(record.id, record);
  }

  upsertMany(records: VectorRecord[]): void {
    for (const record of records) this.upsert(record);
  }

  delete(id: string): boolean {
    return this.records.delete(id);
  }

  clear(): void {
    this.records.clear();
  }

  get size(): number {
    return this.records.size;
  }

  getAll(): VectorRecord[] {
    return Array.from(this.records.values());
  }

  /**
   * Cosine similarity search over stored embeddings.
   * Optionally filters by category.
   */
  similaritySearch(
    queryEmbedding: number[],
    topK = 10,
    category?: LegalCategory,
  ): VectorSearchResult[] {
    const results: VectorSearchResult[] = [];
    for (const record of this.records.values()) {
      if (category && record.metadata.category !== category) continue;
      const score = cosineSimilarity(queryEmbedding, record.embedding);
      if (score > 0) {
        results.push({ record, score });
      }
    }
    return results.sort((a, b) => b.score - a.score).slice(0, topK);
  }

  /**
   * Output the equivalent pgvector SQL INSERT statements — handy when
   * migrating this in-memory index to Supabase.
   */
  toSQLInserts(): string[] {
    return this.getAll().map((r) => {
      const vec = `[${r.embedding.map((v) => v.toFixed(6)).join(',')}]`;
      return [
        `insert into legal_embeddings (id, content, source, court, case_number, article_ref, category, embedding) values (`,
        `  '${r.id.replace(/'/g, "''")}',`,
        `  '${r.content.slice(0, 200).replace(/'/g, "''")}',`,
        `  '${r.metadata.source.replace(/'/g, "''")}',`,
        `  ${r.metadata.court ? `'${r.metadata.court.replace(/'/g, "''")}'` : 'null'},`,
        `  ${r.metadata.caseNumber ? `'${r.metadata.caseNumber.replace(/'/g, "''")}'` : 'null'},`,
        `  ${r.metadata.articleRef ? `'${r.metadata.articleRef.replace(/'/g, "''")}'` : 'null'},`,
        `  '${r.metadata.category ?? ''}',`,
        `  '${vec}'::vector`,
        `);`,
      ].join('\n');
    });
  }
}