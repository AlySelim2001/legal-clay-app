/**
 * Legal Chatbot — CRIM-SYS 2026
 *
 * Multi-agent legal chatbot with RAG-augmented responses,
 * query classification, and intelligent agent routing.
 * Supports both online (LLM) and offline (knowledge base) modes.
 */

import { SwarmOrchestrator, getSwarmOrchestrator } from './swarm-orchestrator';
import { RAGRetriever } from '../rag/retriever';
import { LEGAL_AGENTS, type AgentResponse } from '../lib/ai/agent-swarm';

// ============================================================
// Types
// ============================================================

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  agentId?: string;
  timestamp: string;
  metadata?: {
    classification?: string;
    ragResults?: number;
    confidence?: number;
    engine?: string;
  };
}

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: string;
  lastActivity: string;
}

export interface ChatbotResponse {
  message: ChatMessage;
  suggestedFollowUp: string[];
  relevantArticles: string[];
  relevantDeadlines: string[];
}

// ============================================================
// Offline Knowledge Base (fallback when no LLM available)
// ============================================================

const QUICK_RESPONSES: Record<string, string> = {
  'التقادم':
    '📚 **التقادم في القانون المصري**\n\n' +
    '• الجنح: 3 سنوات (المادة 15 من قانون العقوبات 58/1937)\n' +
    '• الجنايات: 10 سنوات\n' +
    '• المخالفات: 6 أشهر\n' +
    '• المدني الطويل: 15 سنة (المادة 374 مدني)\n' +
    '• التجاري القصير: سنة واحدة (المادة 50 تجارة)\n\n' +
    'يبدأ التقادم من تاريخ ارتكاب الجريمة أو آخر فعل إجرائي.',

  'المعارضة':
    '📚 **المعارضة في الأحكام الغيابية**\n\n' +
    '• الجنح: 10 أيام من العلم بالحكم (المادة 295 إ.ج)\n' +
    '• المدنى: 15 يومًا (المادة 302 م.م)\n' +
    '• المحكمة: المحكمة التي أصدرت الحكم الابتدائي\n' +
    '• تُنظر المعارضة في جلسة علنية',

  'الاستئناف':
    '📚 **الاستئناف**\n\n' +
    '• الجنح: 10 أيام من إعلان الحكم (المادة 406 إ.ج)\n' +
    '• الجنايات: 10 أيام (المادة 393 إ.ج)\n' +
    '• المدنى الجزئي: 15 يومًا (المادة 387 م.م)\n' +
    '• المدنى الابتدائي: 40 يومًا\n' +
    '• يُقدم من المحكمة التي أصدرت الحكم',

  'النقض':
    '📚 **الطعن بالنقض**\n\n' +
    '• 40 يومًا من إعلان الحكم (المادة 418 إ.ج)\n' +
    '• يُقدم لمحكمة النقض\n' +
    '• الأسباب: إخلال بتطبيق القانون أو خطأ في تطبيقه\n' +
    '• لا يوقف تنفيذ الحكم إلا في الجنايات',

  'الحبس الاحتياطي':
    '📚 **الحبس الاحتياطي**\n\n' +
    '• المدة القصوى: 45 يومًا قابلة للتجديد\n' +
    '• يُحدد قاضي التحقيق المدة\n' +
    '• يُشترط وجود قرائن قوية على ارتكاب الجريمة\n' +
    '• يُستثنى جرائم المخدرات (مدة أطول)',

  'الكفالة':
    '📚 **الكفالة الجنائية**\n\n' +
    '• يُحدد قاضي التحقيق مبلغ الكفالة\n' +
    '• لا يجوز الحبس الاحتياطي超过 45 يومًا دون تجديد\n' +
    '• الكفالة تُدفع نقدًا أو بكفالة بنكية\n' +
    '• الإفراج بكفالة وفقًا للمادة 134 إ.ج',

  'القتل':
    '📚 **جرائم القتل في قانون العقوبات 58/1937**\n\n' +
    '• القتل العمد مع التרצח: المادة 237 — الأشغال الشاقة المؤبدة\n' +
    '• القتل العمد دون تרצח: المادة 238 — 15-25 سنة\n' +
    '• قتل الخطأ: المادة 245 — سنة إلى 5 سنوات\n' +
    '• الضرب المفضي للوفاة: المادة 240 — أشغال مؤقتة',

  'النفقات':
    '📚 **نفقات الأولاد والزوجة**\n\n' +
    '• نفقات الأولاد: تُحدد حسب الاحتياج (قانون 25/1920)\n' +
    '• لا تقل عن 1/3 من أجر الأب\n' +
    '• تُوقف عند بلوغ الأولاد 21 سنة\n' +
    '• نفقات الزوجة: Minimum 1/3 من أجر الزوج\n' +
    '• يُنظر خلال 30 يومًا من تقديم الطلب',

  'الحضانة':
    '📚 **حضانة الأولاد**\n\n' +
    '• الأم: حتى 15 سنة للبنت و15 سنة للولد\n' +
    '• الحضانة الكبرى للأم حتى ثبوت عدم صلاحيتها\n' +
    '• بعد 15 سنة يُخَيَّر القاصر بين الأبوين\n' +
    '• حق الزيارة: يُحدد كل أسبوع أو أسبوعين',

  'المواريث':
    '📚 **الموروث الشرعي في الشريعة الإسلامية**\n\n' +
    '• الزوج: نصف التركة مع الأولاد، ربع بدون أولاد ذكور\n' +
    '• الزوجة: ثمن مع الأولاد، ربع بدون أولاد ذكور\n' +
    '• الأبناء: ذكور بضردين أنثيين\n' +
    '• الأب: سدس مع الأولاد\n' +
    '• الوصية: لا تتجاوز ثلث التركة',

  'الفصل التعسفي':
    '📚 **الفصل التعسفي من العمل**\n\n' +
    '• التعويض: 50 يومًا عن كل سنة خدمة (المادة 94 قانون العمل 12/2003)\n' +
    '• لا يجوز فصل العامل بسبب العضوية النقابية\n' +
    '• الحكم بالتعويض لا يغني عن العودة للعمل\n' +
    '• ميعاد الطعن: 30 يومًا من العلم بالفصل',

  'المكافأة':
    '📚 **مكافأة نهاية الخدمة**\n\n' +
    '• نصف شهر عن كل سنة أولى حتى 10 سنوات\n' +
    '• شهر عن كل سنة فوق 10 سنوات\n' +
    '• لا تقل عن 50 يومًا أجر\n' +
    '• يحصل عليها العامل عند انتهاء خدمته',

  'الإلغاء':
    '📚 **دعوى إلغاء القرار الإداري**\n\n' +
    '• المدة: 60 يومًا من النشر أو العلم (المادة 52 قانون مجلس الدولة 47/1972)\n' +
    '• التظلم الإداري لا يوقف الميعاد\n' +
    '• يجب إثبات مخالفة القانون أو بطلان الإجراءات\n' +
    '• الحكم بالإلغاء نهائياً وملزم للجميع',

  'التنفيذ':
    '📚 **التنفيذ الجبري** (قانون التنفيذ 40/1951)\n\n' +
    '• الإكراه البدني: شهرين كحد أقصى\n' +
    '• الإكراه على المنقولات: الحجز على الأموال المنقولة\n' +
    '• الحجز العقاري: تسجيل في الأzanoz العقارية\n' +
    '• التخلع: البيع الجبري في المزاد العلني\n' +
    '• الحجز على الحسابات البنكية',
};

const FOLLOW_UP_SUGGESTIONS: Record<string, string[]> = {
  criminal: [
    'كيف أحسب ميعاد الاستئناف؟',
    'ما هي الدفوع الجنائية المتاحة؟',
    'كيف أطلب الإفراج بكفالة؟',
  ],
  civil: [
    'كيف أحسب التقادم المدني؟',
    'ما هي طرق التنفيذ الجبري؟',
    'كيف أعد صحيفة دعوى؟',
  ],
  family: [
    'كيف أحسب حصص المواريث؟',
    'ما هي شروط الحضانة؟',
    'كيف أطلب تعديل النفقات؟',
  ],
};

// ============================================================
// Legal Chatbot Service
// ============================================================

export class LegalChatbot {
  private orchestrator: SwarmOrchestrator;
  private sessions: Map<string, ChatSession>;

  constructor() {
    this.orchestrator = getSwarmOrchestrator();
    this.sessions = new Map();
  }

  /**
   * Create a new chat session.
   */
  createSession(title?: string): ChatSession {
    const id = `session-${Date.now()}`;
    const session: ChatSession = {
      id,
      title: title ?? 'محادثة قانونية جديدة',
      messages: [
        {
          id: 'welcome',
          role: 'assistant',
          content:
            'مرحبًا 👋 أنا المساعد القانوني الذكي لمنظومة CRIM-SYS 2026.\n\n' +
            'يمكنني مساعدتك في:\n' +
            '• التحليل القانوني والتشريعات المصرية\n' +
            '• حساب المواعيد القانونية\n' +
            '• اقتراح الدفوع القانونية\n' +
            '• استرجاع الأحكام القضائية\n' +
            '• صياغة المستندات القانونية\n\n' +
            '📢 جميع الاستشارات تقديرية — يُشترط التحقق مع المحامي المختص.\n\n' +
            'كيف يمكنني مساعدتك اليوم؟',
          agentId: 'system',
          timestamp: new Date().toISOString(),
        },
      ],
      createdAt: new Date().toISOString(),
      lastActivity: new Date().toISOString(),
    };

    this.sessions.set(id, session);
    return session;
  }

  /**
   * Process a user message and get a response.
   */
  async processMessage(
    sessionId: string,
    userMessage: string
  ): Promise<ChatbotResponse | null> {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    // Add user message
    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: userMessage,
      timestamp: new Date().toISOString(),
    };
    session.messages.push(userMsg);

    // Classify and route
    const classification = this.orchestrator.classifyQuery(userMessage);

    // Try to get a response from the swarm
    let assistantContent = '';
    let agentId = '';
    let ragCount = 0;

    // First: check quick responses for common queries
    for (const [keyword, response] of Object.entries(QUICK_RESPONSES)) {
      if (userMessage.includes(keyword)) {
        assistantContent = response;
        agentId = classification.suggestedAgents[0] ?? 'criminal';
        break;
      }
    }

    // Second: try full orchestrator if no quick response found
    if (!assistantContent) {
      try {
        const analysis = await this.orchestrator.processQuery(
          userMessage,
          session.messages.map((m) => ({ role: m.role, content: m.content }))
        );

        if (analysis.agentResponses.length > 0) {
          assistantContent = analysis.synthesizedAnalysis;
          agentId = analysis.agentResponses[0].agentId;
          ragCount = analysis.relevantArticles.length;
        }
      } catch {
        // Fall through to fallback
      }
    }

    // Third: fallback to basic response
    if (!assistantContent) {
      assistantContent = this.getFallbackResponse(userMessage, classification.primaryDomain);
      agentId = classification.suggestedAgents[0] ?? 'system';
    }

    // Add disclaimer
    assistantContent +=
      '\n\n---\n⚠️ نتيجة تقديرية استرشادية — يجب التحقق منها مع المحامي المختص قبل اتخاذ أي إجراء.';

    // Create assistant message
    const assistantMsg: ChatMessage = {
      id: `msg-${Date.now() + 1}`,
      role: 'assistant',
      content: assistantContent,
      agentId,
      timestamp: new Date().toISOString(),
      metadata: {
        classification: classification.primaryDomain,
        ragResults: ragCount,
        confidence: classification.complexity === 'simple' ? 0.8 : 0.6,
      },
    };

    session.messages.push(assistantMsg);
    session.lastActivity = new Date().toISOString();

    // Get follow-up suggestions
    const suggestedFollowUp =
      FOLLOW_UP_SUGGESTIONS[classification.primaryDomain] ??
      FOLLOW_UP_SUGGESTIONS.criminal;

    return {
      message: assistantMsg,
      suggestedFollowUp,
      relevantArticles: [],
      relevantDeadlines: [],
    };
  }

  /**
   * Get all sessions.
   */
  getSessions(): ChatSession[] {
    return Array.from(this.sessions.values()).sort(
      (a, b) => new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime()
    );
  }

  /**
   * Get a session by ID.
   */
  getSession(sessionId: string): ChatSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Delete a session.
   */
  deleteSession(sessionId: string): boolean {
    return this.sessions.delete(sessionId);
  }

  /**
   * Get available agents for the chatbot.
   */
  getAvailableAgents() {
    return this.orchestrator.getAllAgents();
  }

  // ============================================================
  // Private
  // ============================================================

  private getFallbackResponse(query: string, domain: string): string {
    const agentList = this.orchestrator.getAgentsByDomain(
      domain as 'criminal' | 'civil' | 'family' | 'administrative' | 'labor'
    );

    if (agentList.length > 0) {
      return (
        `أنا المساعد القانوني الذكي — مساعدك في مجال ${domain}.\n\n` +
        `يمكنني مساعدتك في:\n` +
        agentList.map((a) => `• ${a.nameAr}`).join('\n') +
        `\n\n✍️ حاول إعادة صياغة سؤالك للحصول على إجابة أفضل.\n` +
        `\n💡 جرّب أسئلة مثل:\n` +
        `• ما هي مدة التقادم في الجنايات؟\n` +
        '• كيف أحسب ميعاد الاستئناف؟\n' +
        '• ما هي خطوات التنفيذ الجبري؟'
      );
    }

    return (
      'أنا المساعد القانوني الذكي — يمكنني مساعدتك فيVarious legal matters.\n\n' +
      '✍️ يرجى إعادة صياغة سؤالك بشكل أوضح.\n' +
      '💡 يمكنك سؤالي عن: التقادم، المعارضة، الاستئناف، النقض، النفقات، الحضانة، المواريث، التعويض، أو أي موضوع قانوني آخر.'
    );
  }
}

// ============================================================
// Singleton
// ============================================================

let chatbotInstance: LegalChatbot | null = null;

export function getLegalChatbot(): LegalChatbot {
  if (!chatbotInstance) {
    chatbotInstance = new LegalChatbot();
  }
  return chatbotInstance;
}
