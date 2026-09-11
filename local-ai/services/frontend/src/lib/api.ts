/* ======================================================================
   API client — talks ONLY to the same-origin nginx proxy (/api/*).
   The nginx sidecar injects X-Internal-Key server-side; the browser
   bundle contains no secrets. Never import INTERNAL_API_KEY here.
   ====================================================================== */

/** Backend contract (crew_pipeline.py → AnalyzeResponse) */
export interface AnalyzeResponse {
  status: "ok" | "blocked" | "held";
  answer: string;
  faithfulness: number | null;
  trace_id: string;
}

export interface OcrResponse {
  text: string;
}

export class ApiError extends Error {
  readonly status: number;
  readonly traceId?: string;
  constructor(status: number, message: string, traceId?: string) {
    super(message);
    this.status = status;
    this.traceId = traceId;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      credentials: "omit",
      ...init,
      headers: {
        ...(init?.headers ?? {}),
      },
    });
  } catch {
    throw new ApiError(
      0,
      "تعذّر الاتصال بالخدمة — تأكد من تشغيل المنظومة المحلية (make up).",
    );
  }
  if (res.status === 401) {
    throw new ApiError(401, "انتهت المصادقة مع الخدمة الداخلية.");
  }
  if (!res.ok) {
    throw new ApiError(res.status, `فشل الطلب (${res.status}).`);
  }
  return (await res.json()) as T;
}

export const api = {
  health: () => request<{ status: string }>("/api/health"),

  analyze: (question: string) =>
    request<AnalyzeResponse>("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question }),
    }),

  ocr: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return request<OcrResponse>("/api/ocr", { method: "POST", body: form });
  },
};
