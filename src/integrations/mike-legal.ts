/**
 * Mike Legal Integration — CRIM-SYS 2026
 *
 * Native implementation of the Mike OSS Legal AI platform's client API
 * (legal research, document drafting, contract analysis).
 *
 * The `@mike-oss/legal-client` package does not exist on npm, so this
 * module provides the same developer surface — `legalResearch()`,
 * `draftDocument()`, `analyzeContract()` — implemented entirely over
 * this project's existing offline-first legal stack:
 *
 *   - legalResearch  → AdvancedLegalRAG (hybrid BM25 + semantic, with citations)
 *   - draftDocument  → DocumentGenerator (Arabic legal templates, Law 15/2004-ready)
 *   - analyzeContract→ deterministic clause/risk/compliance heuristics over
 *                      EgyptianLegalDatabase + COURT_PRECEDENTS, optionally
 *                      enriched by the local LLM (Ollama/LM Studio) when reachable.
 *
 * Zero cost, zero external dependencies, fully RTL/Arabic. Optional remote
 * embeddings are already handled upstream (VITE_HF_API_KEY in src/rag/embeddings.ts).
 */

import { getAdvancedLegalRAG, type CitedResult, type Citation } from '../rag/advanced-retriever';
import {
  getDocumentGenerator,
  type GeneratedDocument,
  type DocumentType,
} from '../lib/legal-docs/templates';
import {
  ALL_CODES,
  COURT_PRECEDENTS,
  searchArticles,
  searchPrecedents,
  type LegalCategory,
} from '../legal-db/egyptian-codes';
import { detectAvailableProvider, chatCompletion, type LLMProvider } from '../lib/ai/local-llm';

// ============================================================
// Types
// ============================================================

export type MikeMode = 'research' | 'drafting' | 'analysis';

export interface MikeLegalConfig {
  mode?: MikeMode;
  /** Optional remote API key — not required; everything works offline. */
  apiKey?: string;
}

export interface ResearchResult {
  id: string;
  text: string;
  citation: Citation;
  relevanceScore: number;
}

export interface ResearchResults {
  query: string;
  totalResults: number;
  results: ResearchResult[];
  mode: 'hybrid' | 'keyword-only';
  embeddingModel: 'remote' | 'local' | 'none';
}

export interface DraftDocumentOptions {
  template: string; // template id (e.g. 'tpl-defense-01') or type
  variables: Record<string, string>;
  jurisdiction?: string;
  language?: 'ar' | 'en' | 'fr';
}

export interface DraftResult {
  document: GeneratedDocument | null;
  resolvedTemplateId: string | null;
  note?: string;
}

export interface ContractFinding {
  severity: 'high' | 'medium' | 'low' | 'info';
  type: 'risk' | 'compliance' | 'clause' | 'observation';
  title: string;
  detail: string;
  legalReference?: string;
  excerpt?: string;
}

export interface ContractAnalysis {
  clauseCount: number;
  wordCount: number;
  estimatedRiskLevel: 'low' | 'medium' | 'high';
  findings: ContractFinding[];
  jurisdiction: string;
  llmEnriched: boolean;
  provider?: LLMProvider | null;
}

// ============================================================
// Research
// ============================================================

/** Convert an AdvancedLegalRAG hit into the research result shape. */
function toResearchResult(hit: CitedResult): ResearchResult {
  return {
    id: hit.id,
    text: hit.text,
    citation: hit.citation,
    relevanceScore: hit.relevanceScore,
  };
}

// ============================================================
// Contract analysis heuristics
// ============================================================

interface ClausePattern {
  title: string;
  patterns: RegExp[];
  severity: ContractFinding['severity'];
  type: ContractFinding['type'];
  reference?: string;
  detail: string;
}

const CLAUSE_PATTERNS: ClausePattern[] = [
  {
    title: 'بند السرية (Non-Disclosure)',
    patterns: [/سرية|عدم إفشاء|NDA|confidentiality/i],
    severity: 'info',
    type: 'clause',
    reference: 'القانون المدني 131/1948',
    detail: 'تم رصد بند التزام بالسرية — تأكد من تحديد مدة الالتزام ونطاق المعلومات المشمولة.',
  },
  {
    title: 'بند التعويض (Indemnity)',
    patterns: [/تعويض|indemnif/i],
    severity: 'medium',
    type: 'clause',
    reference: 'القانون المدني 131/1948 — المواد 215-226',
    detail: 'بند تعويض موجود — تحقق من سقف المسؤولية وشروط إعمال التعويض.',
  },
  {
    title: 'بند التحكيم (Arbitration)',
    patterns: [/تحكيم|arbitrat/i],
    severity: 'medium',
    type: 'clause',
    reference: 'قانون التحكيم 27/1994',
    detail: 'بند تحكيم موجود — يجب أن يحدد هيئة التحكيم ومكانه ولغته وقانونه الواجب التطبيق.',
  },
  {
    title: 'بند الفسخ (Termination)',
    patterns: [/فسخ|إنهاء العقد|termination/i],
    severity: 'info',
    type: 'clause',
    detail: 'تم رصد شرط الفسخ — راجع حالات الفسخ ومهلة الإخطار والآثار المترتبة.',
  },
  {
    title: 'بند القانون الواجب التطبيق (Governing Law)',
    patterns: [/قانون.{0,30}مصري|governing law|القانون الواجب التطبيق/i],
    severity: 'low',
    type: 'clause',
    reference: 'القانون المدني 131/1948 — المادة 19',
    detail: 'تم تحديد القانون الواجب التطبيق — تأكد من توافقه مع النظام العام المصري.',
  },
  {
    title: 'بند الغرامة التأخيرية (Penalty Clause)',
    patterns: [/غرامة تأخير|penalty|غرامة تأخيرية/i],
    severity: 'low',
    type: 'clause',
    reference: 'القانون المدني 131/1948 — المادة 224',
    detail: 'غرامة تأخير موجودة — يجوز للمحكمة تخفيضها إذا كانت مبالغاً فيها.',
  },
  {
    title: 'البيانات الشخصية (Personal Data)',
    patterns: [/بيانات شخصية|personal data|الخصوصية/i],
    severity: 'high',
    type: 'compliance',
    detail: 'تم التعامل مع بيانات شخصية — راجع قانون حماية البيانات الشخصية 151/2020.',
  },
  {
    title: 'التوقيع الإلكتروني (E-Signature)',
    patterns: [/توقيع إلكتروني|electronic signature|digital signature/i],
    severity: 'low',
    type: 'compliance',
    reference: 'قانون التوقيع الإلكتروني 15/2004',
    detail: 'تم رصد توقيع إلكتروني — تأكد من الاعتماد من الهيئة المصرية (ITIDA).',
  },
  {
    title: 'الملكية الفكرية (Intellectual Property)',
    patterns: [/ملكية فكرية|حقوق المؤلف|علامة تجارية|intellectual property/i],
    severity: 'medium',
    type: 'compliance',
    reference: 'قانون حماية الملكية الفكرية 82/2002',
    detail: 'بنود ملكية فكرية موجودة — تحقق من نقل الملكية مقابل الترخيص بالاستخدام.',
  },
  {
    title: 'الكفالة والضمانات (Guarantees)',
    patterns: [/ضمان|كفالة|guarantee|warrant/i],
    severity: 'medium',
    type: 'clause',
    reference: 'القانون المدني 131/1948 — المواد 748 وما بعدها',
    detail: 'بنود ضمان/كفالة — حدد نطاق الضمان ومدته بوضوح.',
  },
  {
    title: 'القوة القاهرة (Force Majeure)',
    patterns: [/قوة قاهرة|force majeure/i],
    severity: 'low',
    type: 'clause',
    reference: 'القانون المدني 131/1948 — المادة 373',
    detail: 'بند القوة القاهرة — تحقق من تعريف الحالات وشروط الإعفاء من المسؤولية.',
  },
  {
    title: 'الدفع والتحصيل (Payment)',
    patterns: [/دفع|سداد|ثمن|payment/i],
    severity: 'info',
    type: 'clause',
    detail: 'بنود دفع — راجع مواعيد السداد والآجال والفوائد عند التأخير.',
  },
  {
    title: 'المخالفة الجزائية (Penal Exposure)',
    patterns: [/عقوبة|حبس|غرامة جنائية|تبديد/i],
    severity: 'high',
    type: 'risk',
    reference: 'قانون العقوبات 58/1937',
    detail: 'صياغة تحمل وصفاً جزائياً (تبديد/غش) — تحقق من مطابقة البند لمبدأ الشرعية الجنائية.',
  },
  {
    title: 'التعامل مع جهة عامة (Public Entity)',
    patterns: [/جهة حكومية|هيئة حكومية|وزارة|محافظة|public entity/i],
    severity: 'medium',
    type: 'compliance',
    reference: 'قانون التعاقدات العامة 182/2018',
    detail: 'تعاقد مع جهة عامة — راجع قواعد التعاقدات العامة ولائحته التنفيذية.',
  },
];

const CLAUSE_KEYWORDS: Array<{ title: string; pattern: RegExp }> = [
  { title: 'المقدمة والأطراف', pattern: /بين كلا من|بين الطرف|الأطراف|بينما/i },
  { title: 'موضوع العقد', pattern: /موضوع العقد|تعهد|يلتزم/i },
  { title: 'مدة العقد', pattern: /مدة العقد|مدة سريان|تاريخ البدء/i },
  { title: 'التجديد', pattern: /تجديد|تجدد تلقائيا/i },
  { title: 'التنازل عن العقد', pattern: /تنازل عن العقد|assignment|novation/i },
  { title: 'الإخطارات', pattern: /إخطار|إشعار|notices/i },
  { title: 'حل النزاعات', pattern: /نزاع|تسوية ودية|dispute/i },
];

/** Estimate the risk level from the findings present. */
function estimateRisk(findings: ContractFinding[]): ContractAnalysis['estimatedRiskLevel'] {
  const high = findings.filter((f) => f.severity === 'high').length;
  const medium = findings.filter((f) => f.severity === 'medium').length;
  if (high >= 1) return 'high';
  if (medium >= 2) return 'medium';
  return 'low';
}

function findExcerpt(text: string, pattern: RegExp): string | undefined {
  const match = text.match(pattern);
  if (!match || match.index === undefined) return undefined;
  const start = Math.max(0, match.index - 60);
  const end = Math.min(text.length, match.index + match[0].length + 60);
  return `${text.slice(start, end).trim()}${end < text.length ? '…' : ''}`;
}

// ============================================================
// Mike Legal Integration
// ============================================================

export class MikeLegalIntegration {
  private config: MikeLegalConfig;
  private rag = getAdvancedLegalRAG();
  private generator = getDocumentGenerator();
  private provider: LLMProvider | null = null;
  private providerChecked = false;

  constructor(config: MikeLegalConfig = {}) {
    this.config = config;
  }

  /**
   * Legal research over the Egyptian legal database.
   * Returns cited precedents, articles, and deadline rules.
   */
  async legalResearch(
    topic: string,
    options: { category?: LegalCategory; maxResults?: number } = {},
  ): Promise<ResearchResults> {
    const maxResults = options.maxResults ?? 20;
    const context = await this.rag.retrieveContext(topic, maxResults, options.category);
    const results = context.results.map(toResearchResult);

    return {
      query: topic,
      totalResults: results.length,
      results,
      mode: context.mode,
      embeddingModel: context.embeddingModel,
    };
  }

  /**
   * Draft an Arabic legal document from a template.
   * `template` may be a template id ('tpl-defense-01') or a document
   * type ('memorandum-defense', 'appeal-memo', 'civil-claim', ...).
   */
  draftDocument(options: DraftDocumentOptions): DraftResult {
    const { template, variables, jurisdiction } = options;

    // Resolve template: try id first, then match by type.
    let resolved = this.generator.getTemplate(template);
    if (!resolved) {
      resolved = this.generator
        .getTemplates()
        .find((t) => t.type === (template as DocumentType));
    }

    if (!resolved) {
      return {
        document: null,
        resolvedTemplateId: null,
        note: `لا يوجد قالب بالمعرّف "${template}" — القوالب المتاحة: ${this.generator
          .getTemplates()
          .map((t) => t.id)
          .join('، ')}`,
      };
    }

    const document = this.generator.generate(resolved.id, variables);
    const jurisdictionNote =
      jurisdiction && jurisdiction.toLowerCase() !== 'egypt' && jurisdiction.toLowerCase() !== 'مصر'
        ? `تنبيه: القالب معدّ للولاية المصرية — راجع ${jurisdiction} قبل الاعتماد.`
        : undefined;

    return {
      document,
      resolvedTemplateId: resolved.id,
      ...(jurisdictionNote ? { note: jurisdictionNote } : {}),
    };
  }

  /**
   * Contract analysis: clause inventory, risk & compliance findings,
   * with Egyptian legal references. Optionally enriched by the local
   * LLM when a provider (Ollama / LM Studio / LocalAI) is reachable.
   */
  async analyzeContract(
    contractText: string,
    options: { focus?: Array<'risk' | 'compliance' | 'clauses'>; jurisdiction?: string } = {},
  ): Promise<ContractAnalysis> {
    const focus = options.focus ?? ['risk', 'compliance', 'clauses'];
    const findings: ContractFinding[] = [];
    const text = contractText.trim();

    if (text.length === 0) {
      return {
        clauseCount: 0,
        wordCount: 0,
        estimatedRiskLevel: 'low',
        findings: [{ severity: 'info', type: 'observation', title: 'نص فارغ', detail: 'لا يوجد نص عقد لتحليله.' }],
        jurisdiction: options.jurisdiction ?? 'Egypt',
        llmEnriched: false,
      };
    }

    // 1) Clause detection (count + inventory)
    const foundClauses: string[] = [];
    for (const c of CLAUSE_KEYWORDS) {
      if (c.pattern.test(text)) {
        foundClauses.push(c.title);
        if (focus.includes('clauses')) {
          findings.push({
            severity: 'info',
            type: 'clause',
            title: c.title,
            detail: `تم رصد البند في العقد.`,
            excerpt: findExcerpt(text, c.pattern),
          });
        }
      }
    }

    // 2) Risk & compliance patterns
    for (const p of CLAUSE_PATTERNS) {
      for (const re of p.patterns) {
        if (re.test(text)) {
          if (focus.includes(p.type as 'risk' | 'compliance' | 'clauses')) {
            findings.push({
              severity: p.severity,
              type: p.type,
              title: p.title,
              detail: p.detail,
              ...(p.reference ? { legalReference: p.reference } : {}),
              excerpt: findExcerpt(text, re),
            });
          }
          break;
        }
      }
    }

    // 3) LLM enrichment (best-effort, offline optional)
    let llmEnriched = false;
    let provider: LLMProvider | null = null;
    if (!this.providerChecked) {
      this.provider = await detectAvailableProvider();
      this.providerChecked = true;
    }
    provider = this.provider;
    if (provider && focus.length > 0) {
      try {
        const summary = await chatCompletion(
          [
            {
              role: 'system',
              content:
                'أنت محلل عقود قانوني مصري خبير. لخّص أبرز المخاطر في العقد التالي في 3 نقاط مرقمة بالعربية، مع ذكر المواد القانونية ذات الصلة.',
            },
            { role: 'user', content: text.slice(0, 6000) },
          ],
          { provider },
        );
        if (summary.content.trim()) {
          findings.push({
            severity: 'info',
            type: 'observation',
            title: 'ملخص تحليل الذكاء الاصطناعي المحلي',
            detail: summary.content.trim(),
          });
          llmEnriched = true;
        }
      } catch {
        // Local LLM unreachable — deterministic analysis still stands.
      }
    }

    const wordCount = text.split(/\s+/).filter(Boolean).length;

    return {
      clauseCount: foundClauses.length,
      wordCount,
      estimatedRiskLevel: estimateRisk(findings),
      findings,
      jurisdiction: options.jurisdiction ?? 'Egypt',
      llmEnriched,
      provider,
    };
  }

  /**
   * One-shot convenience: run the three core capabilities together
   * (research → draft → analyze) for a legal matter.
   */
  async runPipeline(input: {
    topic: string;
    template?: { id: string; variables: Record<string, string> };
    contractText?: string;
  }): Promise<{ research: ResearchResults; draft?: DraftResult; analysis?: ContractAnalysis }> {
    const research = await this.legalResearch(input.topic);
    const draft = input.template ? this.draftDocument({ template: input.template.id, variables: input.template.variables }) : undefined;
    const analysis = input.contractText ? await this.analyzeContract(input.contractText) : undefined;
    return { research, draft, analysis };
  }

  /**
   * Search helper exposed for parity with the OSS client's simple API:
   * quick keyword search across articles and precedents.
   */
  quickSearch(query: string): { articles: Array<{ codeName: string; titleAr: string; reference?: string; content: string }>; precedents: typeof COURT_PRECEDENTS } {
    return { articles: searchArticles(query), precedents: searchPrecedents(query) };
  }

  /** Number of laws, articles, and precedents in the local database. */
  getDatabaseStats(): { laws: number; articles: number; precedents: number } {
    return {
      laws: ALL_CODES.length,
      articles: ALL_CODES.reduce((sum, code) => sum + code.articles.length, 0),
      precedents: COURT_PRECEDENTS.length,
    };
  }
}

// ============================================================
// Singleton
// ============================================================

let mikeInstance: MikeLegalIntegration | null = null;

export function getMikeLegalIntegration(config?: MikeLegalConfig): MikeLegalIntegration {
  if (!mikeInstance) {
    mikeInstance = new MikeLegalIntegration(config);
  }
  return mikeInstance;
}

export function resetMikeLegalIntegration(): void {
  mikeInstance = null;
}