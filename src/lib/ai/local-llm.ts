/**
 * Local LLM Inference Service — Zero-cost, privacy-first AI.
 * Supports Ollama, LocalAI, and LM Studio with auto-detection.
 */

export type LLMProvider = 'ollama' | 'localai' | 'lmstudio';

export interface LLMConfig {
  provider: LLMProvider;
  baseUrl: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
  contextWindow?: number;
}

export interface LLMResponse {
  content: string;
  model: string;
  provider: LLMProvider;
  latencyMs: number;
  fromCache: boolean;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

const PROVIDER_CONFIGS: Record<LLMProvider, LLMConfig> = {
  ollama: {
    provider: 'ollama',
    baseUrl: 'http://localhost:11434',
    model: 'qwen2.5:1.5b',
    temperature: 0.3,
    maxTokens: 1024,
    contextWindow: 2048,
  },
  localai: {
    provider: 'localai',
    baseUrl: 'http://localhost:8080',
    model: 'qwen2.5-1.5b-instruct',
    temperature: 0.3,
    maxTokens: 1024,
  },
  lmstudio: {
    provider: 'lmstudio',
    baseUrl: 'http://localhost:1234',
    model: 'qwen2.5-1.5b-instruct',
    temperature: 0.3,
    maxTokens: 1024,
  },
};

// Simple LRU cache
const cache = new Map<string, { response: LLMResponse; ts: number }>();
const CACHE_TTL = 5 * 60 * 1000;
const CACHE_MAX = 100;

function cacheKey(msgs: ChatMessage[], cfg: LLMConfig): string {
  return `${cfg.provider}:${cfg.model}:${msgs.map((m) => m.content).join('|')}`;
}

function getCache(key: string): LLMResponse | null {
  const e = cache.get(key);
  if (!e) return null;
  if (Date.now() - e.ts > CACHE_TTL) { cache.delete(key); return null; }
  return { ...e.response, fromCache: true };
}

function setCache(key: string, r: LLMResponse): void {
  if (cache.size >= CACHE_MAX) {
    const first = cache.keys().next().value;
    if (first) cache.delete(first);
  }
  cache.set(key, { response: r, ts: Date.now() });
}

export async function checkProviderHealth(provider: LLMProvider, url?: string): Promise<boolean> {
  const base = url ?? PROVIDER_CONFIGS[provider].baseUrl;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 3000);
    const ep = provider === 'ollama' ? '/api/tags' : '/v1/models';
    const res = await fetch(`${base}${ep}`, { signal: ctrl.signal });
    clearTimeout(t);
    return res.ok;
  } catch { return false; }
}

export async function detectAvailableProvider(): Promise<LLMProvider | null> {
  for (const p of (['ollama', 'lmstudio', 'localai'] as LLMProvider[])) {
    if (await checkProviderHealth(p)) return p;
  }
  return null;
}

export async function chatCompletion(
  messages: ChatMessage[],
  config?: Partial<LLMConfig>,
): Promise<LLMResponse> {
  const cfg = { ...PROVIDER_CONFIGS[config?.provider ?? 'ollama'], ...config };
  const start = Date.now();
  const key = cacheKey(messages, cfg);
  const cached = getCache(key);
  if (cached) return cached;

  const content = cfg.provider === 'ollama'
    ? await callOllama(messages, cfg)
    : await callOpenAI(messages, cfg);

  const result: LLMResponse = {
    content, model: cfg.model, provider: cfg.provider,
    latencyMs: Date.now() - start, fromCache: false,
  };
  setCache(key, result);
  return result;
}

async function callOllama(msgs: ChatMessage[], cfg: LLMConfig): Promise<string> {
  const res = await fetch(`${cfg.baseUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: cfg.model,
      messages: msgs.map((m) => ({ role: m.role, content: m.content })),
      options: {
        temperature: cfg.temperature ?? 0.3,
        num_predict: cfg.maxTokens ?? 1024,
        num_ctx: cfg.contextWindow ?? 2048,
        num_thread: 4,
        num_batch: 256,
      },
      stream: false,
    }),
  });
  if (!res.ok) throw new Error(`Ollama ${res.status}`);
  const data = await res.json();
  return data.message?.content ?? '';
}

async function callOpenAI(msgs: ChatMessage[], cfg: LLMConfig): Promise<string> {
  const res = await fetch(`${cfg.baseUrl}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: cfg.model,
      messages: msgs.map((m) => ({ role: m.role, content: m.content })),
      temperature: cfg.temperature ?? 0.3,
      max_tokens: cfg.maxTokens ?? 1024,
    }),
  });
  if (!res.ok) throw new Error(`LLM API ${res.status}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? '';
}

export function clearCache(): void { cache.clear(); }
