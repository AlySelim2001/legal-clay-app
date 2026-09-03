/**
 * LawGlance Integration — CRIM-SYS 2026
 *
 * Native implementation of the LawGlance OSS legal assistant's client
 * API (`chatWithLegalContext`, `getLegalGuidance`).
 *
 * The `@lawglance/sdk` package does not exist on npm, so this module
 * provides the same developer surface implemented over this project's
 * existing offline-first legal stack:
 *
 *   - chatWithLegalContext → LegalChatbot (18-agent swarm) + AdvancedLegalRAG
 *     citations, with a deterministic knowledge-base fallback when no
 *     local LLM (Ollama / LM Studio) is reachable.
 *   - getLegalGuidance     → SwarmOrchestrator.processQuery: query
 *     classification → best-matching agents → synthesized analysis with
 *     relevant articles, deadlines, and citations.
 *
 * Zero cost, fully offline, Arabic-first with legal disclaimers.
 */

import { getLegalChatbot } from '../agents/legal-chatbot';
import { getSwarmOrchestrator, type MultiAgentAnalysis } from '../agents/swarm-orchestrator';
import { getAdvancedLegalRAG, type Citation } from '../rag/advanced-retriever';
import type { LegalCategory } from '../legal-db/egyptian-codes';

// ============================================================
// Types
// ============================================================

export interface LawGlanceConfig {
  mode?: 'rag';
  database?: string;
  language?: 'ar' | 'en' | 'fr';
}

export interface ChatResponse {
  message: string;
  citations: Citation[];
  classification?: string;
  suggestedFollowUp: string[];
  engine: 'swarm-llm' | 'swarm-knowledge' | 'quick-response' | 'rag-only';
  disclaimer: string;
}

export interface LegalGuidance {
  caseType: string;
  scenario: string;
  domain: LegalCategory;
  complexity: 'simple' | 'moderate' | 'complex';
  suggestedAgents: string[];
  analysis: string;
  relevantArticles: string[];
  relevantDeadlines: string[];
  citations: Citation[];
  disclaimer: string;
}

// ============================================================
// LawGlance Integration
// ============================================================

export class LawGlanceIntegration {
  private config: LawGlanceConfig;
  private chatbot = getLegalChatbot();
  private orchestrator = getSwarmOrchestrator();
  private rag = getAdvancedLegalRAG();

  constructor(config: LawGlanceConfig = {}) {
    this.config = { mode: 'rag', database: 'egyptian-law', language: 'ar', ...config };
  }

  /**
   * Chat with legal context: route the question through the agent swarm
   * and attach retrieved Egyptian-law citations to the answer.
   */
  async chatWithLegalContext(
    question: string,
    context?: string,
  ): Promise<ChatResponse> {
    const disclaimer =
      '⚠️ نتيجة تقديرية استرشادية — يجب التحقق منها مع المحامي المختص قبل اتخاذ أي إجراء.';

    // 1) Retrieve citations for the question (hybrid BM25 + semantic)
    let citations: Citation[] = [];
    try {
      const cited = await this.rag.retrieveWithCitations(question, 6);
      citations = cited.map((r) => r.citation);
    } catch {
      // RAG failure — proceed with the chatbot alone.
    }

    // 2) Route through the multi-agent chatbot
    let engine: ChatResponse['engine'] = 'rag-only';
    let message = '';
    let suggestedFollowUp: string[] = [];
    let classification: string | undefined;

    try {
      const session = this.chatbot.createSession(
        context ? `استشارة: ${question.slice(0, 60)}` : undefined,
      );
      const response = await this.chatbot.processMessage(session.id, question);

      if (response) {
        message = response.message.content;
        suggestedFollowUp = response.suggestedFollowUp;
        classification = response.message.metadata?.classification;
        engine =
          response.message.metadata?.ragResults && response.message.metadata.ragResults > 0
            ? 'swarm-llm'
            : 'quick-response';
      }
    } catch {
      // Chatbot unavailable — fall through to RAG-only synthesis.
    }

    // 3) Fallback: build a grounded answer purely from retrieved citations
    if (!message) {
      if (citations.length > 0) {
        message = [
          '📚 المراجع القانونية المسترجعة (استناداً إلى قاعدة القانون المصري):',
          '',
          ...citations
            .slice(0, 5)
            .map(
              (c, i) =>
                `[${i + 1}] ${c.source}${c.articleRef ? ` — ${c.articleRef}` : ''}` +
                `${c.caseNumber ? ` — قضية ${c.caseNumber}` : ''}` +
                `${c.court ? ` (${c.court})` : ''}`,
            ),
          '',
          `السؤال: ${question}`,
          context ? `السياق: ${context}` : '',
        ]
          .filter(Boolean)
          .join('\n');
      } else {
        message =
          'لم يتم العثور على مراجع قانونية ذات صلة في قاعدة القانون المصري. ' +
          'يُرجى إعادة صياغة السؤال أو مراجعة محامٍ مختص.';
      }
      suggestedFollowUp = [
        'ما هي مدة التقادم في الجنايات؟',
        'كيف أحسب ميعاد الاستئناف؟',
        'ما هي الدفوع الجنائية المتاحة؟',
      ];
    }

    return {
      message: `${message}\n\n---\n${disclaimer}`,
      citations,
      classification,
      suggestedFollowUp,
      engine,
      disclaimer,
    };
  }

  /**
   * Structured legal guidance for a case type + scenario: classify the
   * matter, consult the best-matching agents, and return the synthesized
   * analysis with articles, deadlines, and citations.
   */
  async getLegalGuidance(
    caseType: string,
    scenario: string,
  ): Promise<LegalGuidance> {
    const query = `${caseType}: ${scenario}`;

    // RAG citations for the guidance
    let citations: Citation[] = [];
    try {
      const cited = await this.rag.retrieveWithCitations(query, 5);
      citations = cited.map((r) => r.citation);
    } catch {
      // Non-fatal.
    }

    let analysis: MultiAgentAnalysis;
    try {
      analysis = await this.orchestrator.processQuery(query);
    } catch {
      // Fallback: classification-only guidance without agent responses.
      const classification = this.orchestrator.classifyQuery(query);
      analysis = {
        query,
        classifications: classification,
        agentResponses: [],
        synthesizedAnalysis:
          `📊 تصنيف الاستعلام: ${classification.primaryDomain}\n` +
          `🧭 المستوى: ${classification.complexity}\n` +
          (classification.suggestedAgents.length > 0
            ? `🕵️ الوكلاء المقترحون: ${classification.suggestedAgents.join('، ')}\n`
            : '') +
          '\nيرجى إعادة صياغة السؤال أو استشارة محامٍ مختص.',
        relevantArticles: [],
        relevantDeadlines: [],
        citations,
        disclaimer:
          '⚠️ نتيجة تقديرية استرشادية — يجب التحقق منها مع المحامي المختص قبل اتخاذ أي إجراء.',
      };
    }

    return {
      caseType,
      scenario,
      domain: analysis.classifications.primaryDomain,
      complexity: analysis.classifications.complexity,
      suggestedAgents: analysis.classifications.suggestedAgents,
      analysis: analysis.synthesizedAnalysis,
      relevantArticles: analysis.relevantArticles,
      relevantDeadlines: analysis.relevantDeadlines,
      citations,
      disclaimer: analysis.disclaimer,
    };
  }

  /**
   * Quick citation lookup for a legal question — the "RAG mode" of the
   * original SDK, exposed directly.
   */
  async retrieveContext(question: string, topK = 8, category?: LegalCategory) {
    return this.rag.retrieveContext(question, topK, category);
  }
}

// ============================================================
// Singleton
// ============================================================

let lawGlanceInstance: LawGlanceIntegration | null = null;

export function getLawGlanceIntegration(config?: LawGlanceConfig): LawGlanceIntegration {
  if (!lawGlanceInstance) {
    lawGlanceInstance = new LawGlanceIntegration(config);
  }
  return lawGlanceInstance;
}

export function resetLawGlanceIntegration(): void {
  lawGlanceInstance = null;
}