/**
 * Expanded Legal Agents Swarm Orchestrator — CRIM-SYS 2026
 *
 * Coordinates 18 specialized AI agents for Egyptian legal domains.
 * Features intelligent query classification, multi-agent collaboration,
 * and RAG-augmented responses with legal context retrieval.
 */

import { LEGAL_AGENTS, type AgentResponse } from '../lib/ai/agent-swarm';
import { ADVANCED_AGENTS } from './advanced-agents';
import type { LegalAgent as AdvancedLegalAgent } from '../lib/ai/agent-swarm';
import { RAGRetriever as RAGRetrieverClass } from '../rag/retriever';
import { getAdvancedLegalRAG, type Citation } from '../rag/advanced-retriever';
import type { LegalCategory } from '../legal-db/egyptian-codes';
import { getDeadlinesByCategory } from '../legal-db/egyptian-codes';

// ============================================================
// Types
// ============================================================

export interface SwarmConfig {
  maxConcurrentAgents: number;
  enableRAG: boolean;
  enableMultiAgent: boolean;
  timeoutMs: number;
}

export interface QueryClassification {
  primaryDomain: LegalCategory;
  secondaryDomains: LegalCategory[];
  keywords: string[];
  complexity: 'simple' | 'moderate' | 'complex';
  suggestedAgents: string[];
  isDeadlineQuery: boolean;
  isPrecedentQuery: boolean;
}

export interface MultiAgentAnalysis {
  query: string;
  classifications: QueryClassification;
  agentResponses: AgentResponse[];
  synthesizedAnalysis: string;
  relevantArticles: string[];
  relevantDeadlines: string[];
  citations: Citation[];
  disclaimer: string;
}

// ============================================================
// Query Classifier
// ============================================================

const DOMAIN_KEYWORDS: Record<LegalCategory, string[]> = {
  criminal: ['جناية', 'جنحة', 'murder', 'قتل', 'مخدرات', ' cybercrime', 'crime', 'شرطة', 'نيابة', 'تحقيق', 'حبس', 'كفالة', 'تخفيف', 'عقوبة', 'نقض', 'استئناف', 'معارضة', ' defended'],
  civil: ['مدني', 'تعويض', 'عقد', 'debt', 'دين', 'تالف', 'قرار', 'court', 'محكمة', 'مرافعات', 'تقادم', 'ادعاء', 'いくら'],
  commercial: ['تجاري', 'شركة', 'contract', 'عقد', 'cheque', 'شيك', ' bancarotte', 'إفلاس', 'تصفية', 'Ángela'],
  family: ['أحوال شخصية', 'nafqa', 'نفقة', 'حضانة', 'طلاق', 'خلع', 'مواريث', 'ميراث', 'zawaj', 'زواج', 'awlad', 'أولاد'],
  administrative: ['إداري', 'مجلس دولة', 'إلغاء', 'تظلم', 'قرار إداري', '.patrick', 'حكومة', '(ministry)', 'وزارة'],
  labor: ['عمل', 'labor', 'عامل', 'فصل تعسفي', 'مكافأة', 'إجازة', 'تأمينات', 'accident', 'إصابة'],
  'intellectual-property': ['ملكية فكرية', 'علامة تجارية', 'براءة', '.patent', '版权', 'trademark', ' author'],
  arbitration: ['تحكيم', 'arbitration', ' mediador', 'تحكيمي'],
  bankruptcy: ['إفلاس', 'تصفية', 'debtor', 'مدين', 'دائن', 'creditor', 'bankruptcy'],
  execution: ['تنفيذ', 'إكراه', 'حجز', 'تخلع', ' enforcement', 'judgment'],
  forensic: ['تفتيش', 'محاضر', 'شرطة', 'ادعاء', 'indictment', 'forensic', 'crime scene', 'جثة'],
};

const DEADLINE_KEYWORDS = ['موعد', 'مدة', 'تقادم', 'مهلة', 'أيام', 'ساعات', 'deadline', '期限', 'filing', 'تقديم'];

const PRECEDENT_KEYWORDS = ['حكم', 'نقض', 'قضاء', 'precedent', 'jurisprudence', 'أحكام', '判决', ' محكمة'];

const AGENT_DOMAIN_MAP: Record<string, LegalCategory> = {
  'criminal': 'criminal',
  'advanced-criminal': 'criminal',
  'narcotics-cyber': 'criminal',
  'public-funds': 'criminal',
  'judicial-inspection': 'criminal',
  'forensic': 'criminal',
  'appeals': 'criminal',
  'civil': 'civil',
  'companies-contracts': 'commercial',
  'ip': 'intellectual-property',
  'arbitration': 'civil',
  'bankruptcy': 'commercial',
  'family': 'family',
  'family-support': 'family',
  'inheritance': 'family',
  'administrative': 'administrative',
  'labor': 'labor',
  'execution': 'execution',
};

function classifyQuery(query: string): QueryClassification {
  const q = query.toLowerCase();

  // Score each domain
  const scores: Partial<Record<LegalCategory, number>> = {};
  const matchedKeywords: string[] = [];

  for (const [domain, keywords] of Object.entries(DOMAIN_KEYWORDS)) {
    let score = 0;
    for (const kw of keywords) {
      if (q.includes(kw.toLowerCase())) {
        score++;
        matchedKeywords.push(kw);
      }
    }
    if (score > 0) {
      scores[domain as LegalCategory] = score;
    }
  }

  // Determine primary domain
  const sortedDomains = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const primaryDomain = (sortedDomains[0]?.[0] as LegalCategory) ?? 'criminal';
  const secondaryDomains = sortedDomains.slice(1, 3).map(([d]) => d as LegalCategory);

  // Detect special queries
  const isDeadlineQuery = DEADLINE_KEYWORDS.some((kw) => q.includes(kw.toLowerCase()));
  const isPrecedentQuery = PRECEDENT_KEYWORDS.some((kw) => q.includes(kw.toLowerCase()));

  // Determine complexity
  const queryLength = q.length;
  const hasMultipleTopics = secondaryDomains.length > 0;
  const complexity =
    queryLength > 200 || hasMultipleTopics
      ? 'complex'
      : queryLength > 80
        ? 'moderate'
        : 'simple';

  // Suggest agents
  const suggestedAgents: string[] = [];
  for (const [agentId, agentDomain] of Object.entries(AGENT_DOMAIN_MAP)) {
    if (agentDomain === primaryDomain || secondaryDomains.includes(agentDomain)) {
      suggestedAgents.push(agentId);
    }
  }

  return {
    primaryDomain,
    secondaryDomains,
    keywords: matchedKeywords,
    complexity,
    suggestedAgents: suggestedAgents.slice(0, 5),
    isDeadlineQuery,
    isPrecedentQuery,
  };
}

// ============================================================
// Swarm Orchestrator
// ============================================================

export class SwarmOrchestrator {
  private config: SwarmConfig;
  private allAgents: Map<string, { base: typeof LEGAL_AGENTS[0]; advanced?: AdvancedLegalAgent }>;

  constructor(config: Partial<SwarmConfig> = {}) {
    this.config = {
      maxConcurrentAgents: 3,
      enableRAG: true,
      enableMultiAgent: true,
      timeoutMs: 15000,
      ...config,
    };

    // Merge base and advanced agents
    this.allAgents = new Map();
    for (const agent of LEGAL_AGENTS) {
      this.allAgents.set(agent.id, { base: agent });
    }
    for (const agent of ADVANCED_AGENTS) {
      this.allAgents.set(agent.id, { base: agent as unknown as typeof LEGAL_AGENTS[0], advanced: agent });
    }
  }

  /**
   * Classify a query and determine which agents should handle it.
   */
  classifyQuery(query: string): QueryClassification {
    return classifyQuery(query);
  }

  /**
   * Process a query with the best-matching agent, augmented with RAG context.
   */
  async processQuery(
    query: string,
    conversationHistory?: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>
  ): Promise<MultiAgentAnalysis> {
    const classification = classifyQuery(query);
    const disclaimer =
      '⚠️ نتيجة تقديرية استرشادية — يجب التحقق منها مع المحامي المختص قبل اتخاذ أي إجراء.';

    // Retrieve relevant legal context via RAG
    let ragContext = '';
    let relevantArticles: string[] = [];
    let relevantDeadlines: string[] = [];
    let citations: Citation[] = [];

    if (this.config.enableRAG) {
      // Advanced hybrid retrieval (BM25 + semantic) with citations
      try {
        const advanced = getAdvancedLegalRAG();
        const cited = await advanced.retrieveWithCitations(
          query,
          5,
          classification.primaryDomain,
        );
        citations = cited.map((r) => r.citation);
        ragContext = cited
          .map((r, i) => `[${i + 1}] ${r.text}\nالمصدر: ${r.citation.source}${r.citation.articleRef ? ` — ${r.citation.articleRef}` : ''}`)
          .join('\n\n');
        relevantArticles = cited
          .filter((r) => r.citation.articleRef)
          .map((r) => `${r.citation.source} — ${r.citation.articleRef}: ${r.text.slice(0, 120)}`);
      } catch {
        // Fall back to the classic TF-IDF retriever
        const retriever = new RAGRetrieverClass({
          topK: 5,
          category: classification.primaryDomain,
        });
        const ragResults = await retriever.retrieve(query);
        ragContext = RAGRetrieverClass.formatAsContext(ragResults);
        relevantArticles = ragResults
          .filter((d) => d.metadata.type === 'article')
          .map((d) => d.content);
      }
    }

    // Get relevant deadlines
    if (classification.isDeadlineQuery) {
      const deadlines = getDeadlinesByCategory(classification.primaryDomain);
      relevantDeadlines = deadlines.map(
        (d) => `${d.trigger}: ${d.days} يومًا (${d.article} — ${d.law})`
      );
    }

    // Get agent responses
    const agentResponses: AgentResponse[] = [];
    const agentsToQuery = classification.suggestedAgents.slice(
      0,
      this.config.maxConcurrentAgents
    );

    for (const agentId of agentsToQuery) {
      try {
        const agentInfo = this.allAgents.get(agentId);
        if (!agentInfo) continue;

        // Build augmented query with RAG context
        const augmentedQuery = ragContext
          ? `السياق القانوني المتاح:\n${ragContext}\n\n---\n\nالسؤال: ${query}`
          : query;

        const response = await this.getAgentResponse(agentId, augmentedQuery, conversationHistory);
        if (response) {
          agentResponses.push(response);
        }
      } catch {
        // Agent failed, continue with others
      }
    }

    // Synthesize multi-agent analysis
    const synthesizedAnalysis = this.synthesizeAnalysis(
      classification,
      agentResponses,
      relevantDeadlines,
      citations
    );

    return {
      query,
      classifications: classification,
      agentResponses,
      synthesizedAnalysis,
      relevantArticles,
      relevantDeadlines,
      citations,
      disclaimer,
    };
  }

  /**
   * Route a query to a specific agent by ID.
   */
  async routeToAgent(agentId: string, query: string): Promise<AgentResponse | null> {
    return this.getAgentResponse(agentId, query);
  }

  /**
   * Multi-agent consultation for complex cases.
   */
  async multiAgentConsult(
    agentIds: string[],
    query: string
  ): Promise<AgentResponse[]> {
    const results: AgentResponse[] = [];
    const subset = agentIds.slice(0, this.config.maxConcurrentAgents);

    const promises = subset.map((id) => this.getAgentResponse(id, query));
    const settled = await Promise.allSettled(promises);

    for (const result of settled) {
      if (result.status === 'fulfilled' && result.value) {
        results.push(result.value);
      }
    }

    return results;
  }

  /**
   * Get all available agents with their metadata.
   */
  getAllAgents(): Array<{
    id: string;
    nameAr: string;
    nameEn: string;
    domain: LegalCategory;
    icon: string;
    capabilities: string[];
  }> {
    const agents: Array<{
      id: string;
      nameAr: string;
      nameEn: string;
      domain: LegalCategory;
      icon: string;
      capabilities: string[];
    }> = [];

    for (const [id, info] of this.allAgents) {
      agents.push({
        id,
        nameAr: info.base.nameAr,
        nameEn: info.base.nameEn,
        domain: info.base.domain,
        icon: info.base.icon,
        capabilities: info.base.capabilities,
      });
    }

    return agents;
  }

  /**
   * Get agents by domain.
   */
  getAgentsByDomain(domain: LegalCategory): Array<{ id: string; nameAr: string; icon: string }> {
    const result: Array<{ id: string; nameAr: string; icon: string }> = [];

    for (const [id, info] of this.allAgents) {
      if (info.base.domain === domain) {
        result.push({
          id,
          nameAr: info.base.nameAr,
          icon: info.base.icon,
        });
      }
    }

    return result;
  }

  // ============================================================
  // Private Methods
  // ============================================================

  private async getAgentResponse(
    agentId: string,
    query: string,
    _history?: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>
  ): Promise<AgentResponse | null> {
    const agentInfo = this.allAgents.get(agentId);
    if (!agentInfo) return null;

    const startTime = Date.now();

    try {
      // Try the base AgentSwarm's processRequest which uses LLM
      const { getAgentSwarm } = await import('../lib/ai/agent-swarm');
      const swarm = await getAgentSwarm();
      return await swarm.processRequest({
        agentId,
        query,
        conversationHistory: _history,
      });
    } catch {
      // Fallback: return knowledge-based response
      const agent = agentInfo.base;
      const kbMatch = agent.knowledgeBase.find((kb) =>
        query.toLowerCase().includes(kb.split(':')[0]?.toLowerCase() ?? '')
      );

      return {
        agentId,
        content: kbMatch
          ? `📚 **${agent.nameAr}**\n\n${kbMatch}\n\n💡:${agent.capabilities.slice(0, 3).join('، ')}`
          : `أنا ${agent.nameAr} — ${agent.nameEn}.\n\nيمكنني مساعدتك في:\n${agent.capabilities.map((c) => `• ${c}`).join('\n')}`,
        disclaimer: '⚠️ نتيجة تقديرية استرشادية — يجب التحقق منها مع المحامي المختص قبل اتخاذ أي إجراء.',
        provider: 'ollama',
        latencyMs: Date.now() - startTime,
        fromCache: false,
      };
    }
  }

  private synthesizeAnalysis(
    classification: QueryClassification,
    responses: AgentResponse[],
    deadlines: string[],
    citations: Citation[] = []
  ): string {
    const parts: string[] = [];

    // Classification summary
    parts.push(`📊 تصنيف الاستعلام: ${classification.primaryDomain}`);
    if (classification.complexity === 'complex') {
      parts.push('⚡ مستوى التعقيد: معقد — تحليل متعدد المجالات');
    }

    // Agent responses summary
    if (responses.length > 0) {
      parts.push('\n---\n');
      for (const response of responses) {
        parts.push(`\n${response.content}`);
      }
    }

    // Deadlines
    if (deadlines.length > 0) {
      parts.push('\n---\n⏰ المواعيد القانونية ذات الصلة:');
      for (const dl of deadlines) {
        parts.push(`• ${dl}`);
      }
    }

    // Citations
    if (citations.length > 0) {
      parts.push('\n---\n📚 المراجع القانونية المسترجعة:');
      for (const c of citations) {
        const pieces = [c.source, c.articleRef, c.caseNumber, c.court, c.year ? `سنة ${c.year}` : ''].filter(Boolean);
        parts.push(`• ${pieces.join(' — ')}`);
      }
    }

    if (responses.length === 0 && parts.length === 1) {
      return `لم يتم العثور على تحليل مناسب لهذا السؤال. يرجى توضيح السؤال.`;
    }

    return parts.join('\n');
  }
}

// ============================================================
// Singleton
// ============================================================

let orchestratorInstance: SwarmOrchestrator | null = null;

export function getSwarmOrchestrator(config?: Partial<SwarmConfig>): SwarmOrchestrator {
  if (!orchestratorInstance) {
    orchestratorInstance = new SwarmOrchestrator(config);
  }
  return orchestratorInstance;
}
