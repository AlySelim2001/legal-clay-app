/**
 * Hosted Vector Search — CRIM-SYS 2026
 *
 * Optional integration with Turbopuffer (serverless vector database)
 * via plain `fetch` against its REST API — no SDK, no Node runtime,
 * consistent with the app's browser-only, zero-dependency policy.
 *
 * The integration is **key-gated**: until the user adds the two
 * credentials below (in the project's Keys/API-keys tab), the app keeps
 * using the on-device engine (`src/rag/retriever.ts` + Arabic
 * normalization). Once configured, this module can upsert chunk vectors
 * and run semantic queries.
 *
 * Credentials (env vars read from `import.meta.env`):
 *   VITE_TURBOPUFFER_API_KEY    — Turbopuffer API key
 *   VITE_TURBOPUFFER_NAMESPACE  — e.g. "arabic-legal-docs"
 *
 * Security note: a key shipped to a browser is visible to users. For
 * production, proxy calls through a backend; for this browser-only
 * demo the key is kept behind the VITE_ gate and never logged.
 *
 * Embeddings are NOT generated here: this module stores and queries
 * vectors. The on-device app has no local embedder, so indexing the
 * legal corpus requires an embedding source (see docs/dependency-decisions.md).
 */

// ============================================================
// Configuration
// ============================================================

export const HOSTED_VECTOR_ENV = {
  apiKey: "VITE_TURBOPUFFER_API_KEY",
  namespace: "VITE_TURBOPUFFER_NAMESPACE",
} as const;

const DEFAULT_BASE_URL = "https://api.turbopuffer.com/v1";
const DEFAULT_DIMENSIONS = 384; // e.g. multilingual-e5-small, set at namespace creation

interface EnvLike {
  [key: string]: string | undefined;
}

function readEnv(): EnvLike {
  if (typeof import.meta !== "undefined") {
    return (import.meta as { env?: EnvLike }).env ?? {};
  }
  return {};
}

/** True when both credentials are present (and not placeholder text). */
export function isHostedVectorConfigured(): boolean {
  const env = readEnv();
  const key = env[HOSTED_VECTOR_ENV.apiKey];
  const ns = env[HOSTED_VECTOR_ENV.namespace];
  return Boolean(key && ns && key !== "your_api_key_here" && key !== "TURBOPUFFER_API_KEY");
}

/** Status object for UI badges. */
export function hostedVectorStatus(): {
  configured: boolean;
  namespace: string | null;
  missingEnvVars: string[];
} {
  const env = readEnv();
  const key = env[HOSTED_VECTOR_ENV.apiKey];
  const ns = env[HOSTED_VECTOR_ENV.namespace];
  const missing: string[] = [];
  if (!key || key === "your_api_key_here") missing.push(HOSTED_VECTOR_ENV.apiKey);
  if (!ns) missing.push(HOSTED_VECTOR_ENV.namespace);
  return {
    configured: missing.length === 0,
    namespace: ns ?? null,
    missingEnvVars: missing,
  };
}

// ============================================================
// Types
// ============================================================

export interface VectorRecord<TMetadata extends Record<string, unknown> = Record<string, unknown>> {
  id: string;
  vector: number[];
  metadata?: TMetadata;
}

export interface HostedQueryOptions {
  topK?: number;
  /** Return metadata alongside matches. */
  includeMetadata?: boolean;
}

export interface HostedSearchHit<TMetadata extends Record<string, unknown> = Record<string, unknown>> {
  id: string;
  score: number;
  metadata?: TMetadata;
}

// ============================================================
// Client (fetch-only)
// ============================================================

export class HostedVectorSearch {
  private readonly apiKey: string;
  private readonly namespace: string;
  private readonly baseUrl: string;

  constructor(config?: { apiKey?: string; namespace?: string; baseUrl?: string }) {
    const env = readEnv();
    this.apiKey = config?.apiKey ?? env[HOSTED_VECTOR_ENV.apiKey] ?? "";
    this.namespace = config?.namespace ?? env[HOSTED_VECTOR_ENV.namespace] ?? "";
    this.baseUrl = config?.baseUrl ?? DEFAULT_BASE_URL;

    if (!this.apiKey || !this.namespace) {
      throw new Error(
        `HostedVectorSearch غير مُهيّأ — أضف ${HOSTED_VECTOR_ENV.apiKey} و ${HOSTED_VECTOR_ENV.namespace} في تبويب المفاتيح`,
      );
    }
  }

  /** POST helper with Turbopuffer auth + JSON body. */
  private async request<T>(path: string, body: unknown): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      throw new Error(`Turbopuffer API ${response.status}: ${(await response.text()).slice(0, 200)}`);
    }
    return (await response.json()) as T;
  }

  /** Check connectivity + credential validity (reads namespace info). */
  async ping(): Promise<boolean> {
    try {
      await this.request<unknown>(`/namespaces/${encodeURIComponent(this.namespace)}`, {});
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Upsert vectors (and optionally metadata) into the namespace.
   * The namespace must already exist with matching dimensions.
   */
  async upsert<TMetadata extends Record<string, unknown>>(
    records: VectorRecord<TMetadata>[],
  ): Promise<unknown> {
    return this.request(
      `/namespaces/${encodeURIComponent(this.namespace)}/index`,
      {
        upserts: records.map((r) => ({
          id: r.id,
          vector: r.vector,
          attributes: r.metadata ?? {},
        })),
      },
    );
  }

  /** Semantic query by vector. Returns ranked matches. */
  async query<TMetadata extends Record<string, unknown>>(
    vector: number[],
    options: HostedQueryOptions = {},
  ): Promise<HostedSearchHit<TMetadata>[]> {
    if (vector.length === 0) throw new Error("ناقل البحث فارغ");
    const { topK = 5, includeMetadata = true } = options;
    const result = await this.request<{
      results?: Array<{ id: string; score: number; attributes?: TMetadata }>;
    }>(`/namespaces/${encodeURIComponent(this.namespace)}/index/query`, {
      vector,
      top_k: topK,
      include_attributes: includeMetadata,
    });
    return (result.results ?? []).map((r) => ({
      id: r.id,
      score: r.score,
      metadata: r.attributes,
    }));
  }

  /** Delete the whole namespace contents (use carefully). */
  async resetNamespace(): Promise<unknown> {
    return this.request(`/namespaces/${encodeURIComponent(this.namespace)}/index`, {
      upserts: [],
    });
  }
}

// ============================================================
// Singleton
// ============================================================

let hostedInstance: HostedVectorSearch | null = null;

/** Get the configured client — throws unless credentials are present. */
export function getHostedVectorSearch(): HostedVectorSearch {
  if (!hostedInstance) hostedInstance = new HostedVectorSearch();
  return hostedInstance;
}

/** Convenience: run a query only when configured; otherwise null. */
export async function tryHostedSearch(
  vector: number[],
  options?: HostedQueryOptions,
): Promise<HostedSearchHit[] | null> {
  if (!isHostedVectorConfigured()) return null;
  try {
    return await getHostedVectorSearch().query(vector, options);
  } catch {
    return null; // Hosted failure → caller falls back to the on-device engine
  }
}

/** Suggested dimensions for common free multilingual embedders. */
export const SUGGESTED_DIMENSIONS = {
  "multilingual-e5-small": 384,
  "multilingual-e5-base": 768,
  "bge-m3": 1024,
} as const;
