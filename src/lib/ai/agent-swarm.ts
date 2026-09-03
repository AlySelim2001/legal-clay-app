/**
 * Multi-Agent Legal Swarm Orchestrator
 *
 * Coordinates specialized AI agents for Egyptian legal domains.
 * Each agent has its own system prompt, knowledge base, and tool set.
 * Supports automatic fallback between local LLM and cloud inference.
 */

import {
  chatCompletion,
  detectAvailableProvider,
  type ChatMessage,
  type LLMProvider,
} from './local-llm';

export type AgentDomain =
  | 'criminal'
  | 'civil'
  | 'family'
  | 'administrative'
  | 'labor'
  | 'forensic'
  | 'commercial'
  | 'execution';

export interface LegalAgent {
  id: string;
  nameAr: string;
  nameEn: string;
  domain: AgentDomain;
  icon: string;
  systemPrompt: string;
  knowledgeBase: string[];
  primaryLaws: string[];
  capabilities: string[];
}

export interface AgentRequest {
  agentId: string;
  query: string;
  context?: Record<string, unknown>;
  conversationHistory?: ChatMessage[];
}

export interface AgentResponse {
  agentId: string;
  content: string;
  disclaimer: string;
  provider: LLMProvider;
  latencyMs: number;
  fromCache: boolean;
}

// ============================================================
// Legal Disclaimer (non-removable)
// ============================================================
const LEGAL_DISCLAIMER =
  '⚠️ نتيجة تقديرية استرشادية — يجب التحقق منها مع المحامي المختص قبل اتخاذ أي إجراء.';

// ============================================================
// Agent Definitions
// ============================================================
export const LEGAL_AGENTS: LegalAgent[] = [
  {
    id: 'criminal',
    nameAr: 'مستشار الإجراءات والجنايات',
    nameEn: 'Criminal Law Specialist',
    domain: 'criminal',
    icon: '⚖️',
    systemPrompt: `أنت مستشار قانوني متخصص في القانون الجنائي والإجراءات الجنائية المصري.
القوانين المرجعية: قانون الإجراءات الجنائية رقم 150/1950، القانون 174/2025، قانون العقوبات 58/1937.
المواد الأساسية: 15 (التقادم الثلاثي)، 295/297 (المعارضة)، 406 (الاستئناف)، 36 (عرض النيابة خلال 24 ساعة)، 40/41/44 (القبض والتفتيش).
قدم إجابات مفصلة مع ذكر الأرقام القانونية الدقيقة.`,
    knowledgeBase: [
      'التقادم الثلاثي في الجنح: 3 سنوات (المادة 15)',
      'المعارضة: 10 أيام من تاريخ العلم (المادة 295)',
      'الاستئناف: 10 أيام (المادة 406)',
      'عرض النيابة: 24 ساعة (المادة 36)',
      'الدفع ببطلان القبض والتفتيش: المواد 40، 41، 44',
    ],
    primaryLaws: [
      'قانون الإجراءات الجنائية 150/1950',
      'القانون 174/2025',
      'قانون العقوبات 58/1937',
    ],
    capabilities: [
      'حساب مواعيد التقادم والمعارضة والاستئناف',
      'تحليل محاضر الشرطة والتحقيقات',
      'اقتراح الدفوع الجنائية',
      'التحقق من صحة الإجراءات القانونية',
    ],
  },
  {
    id: 'civil',
    nameAr: 'مستشار المدني والتجاري',
    nameEn: 'Civil & Commercial Specialist',
    domain: 'civil',
    icon: '📋',
    systemPrompt: `أنت مستشار قانوني متخصص في القانون المدني والتجاري المصري.
القوانين: القانون المدني 131/1948، قانون الإجراءات المدنية 13/1968، القانون التجاري 17/1999.
التقادم: الطويل (15 سنة) والقصير (3 سنوات للمديونية التجارية).
قدم إجابات مفصلة مع ذكر الأرقام القانونية.`,
    knowledgeBase: [
      'التقادم الطويل: 15 سنة (المادة 374 مدني)',
      'التقادم القصير: 3 سنوات للمديونية التجارية',
      'استئناف الأحكام الجزئية: 15 يوماً',
      'الأحكام الصادرة فيBASEPATH: 40 يوماً',
      'الأحكام الغيابية: 15 يوماً للمعارضة',
    ],
    primaryLaws: [
      'القانون المدني 131/1948',
      'قانون الإجراءات المدنية 13/1968',
      'القانون التجاري 17/1999',
    ],
    capabilities: [
      'حساب مواعيد التقادم المدني والتجاري',
      'تحليل العقود والتزامات',
      'مراجعة أحكام التنفيذ',
      'تقديم المشورة في النزاعات التجارية',
    ],
  },
  {
    id: 'family',
    nameAr: 'مستشار الأحوال الشخصية والأسرة',
    nameEn: 'Family Law Specialist',
    domain: 'family',
    icon: '👨‍👩‍👧',
    systemPrompt: `أنت مستشار قانوني متخصص في قانون الأحوال الشخصية المصري.
القوانين: القانون 25/1920، القانون 25/1929، القانون 1/2000 (محاكم الأسرة).
النفقات، الحضانة، الخلع، المواريث.
قدم إجابات مفصلة مع الأرقام القانونية.`,
    knowledgeBase: [
      'نفقات الأطف��: م Bedroomية حتى 21 سنة',
      'الحضانة الكبرى: للأم حتى 15 سنة للبنت و15 سنة للولد',
      'الخلع: بطلاق خلع مقابل فدية',
      'المؤخر: يُحكم به عند الزواج أو لاحقاً',
      'المواريث: حسب الشريعة الإسلامية مع استثناء الكفار',
    ],
    primaryLaws: [
      'قانون الأحوال الشخصية 25/1920',
      'قانون الأحوال الشخصية 25/1929',
      'قانون محاكم الأسرة 1/2000',
    ],
    capabilities: [
      'حساب حصص المواريث',
      'تحديد مقدار النفقات',
      'مشورة الحضانة وال访问',
      'إجراءات الخلع والطلاق',
    ],
  },
  {
    id: 'administrative',
    nameAr: 'مستشار القضاء الإداري ومجلس الدولة',
    nameEn: 'Administrative Law Specialist',
    domain: 'administrative',
    icon: '🏛️',
    systemPrompt: `أنت مستشار قانوني متخصص في القضاء الإداري ومجلس الدولة.
القانون 47/1972 (قانون مجلس الدولة).
التظلمات الإدارية، دعاوى الإلغاء (60 يوماً)، دعاوى التعويض.
قدم إجابات مفصلة.`,
    knowledgeBase: [
      'دعاوى الإلغاء: 60 يوماً من النشر أو العلم',
      'التظلم الإداري: لا يوقف الميعاد',
      'التعويض عن الأخطار الإدارية: لا يتقادم',
      'פסק messageType الإداري: نهائياً وملزم للجميع',
    ],
    primaryLaws: [
      'قانون مجلس الدولة 47/1972',
      'القانون الإداري',
    ],
    capabilities: [
      'حساب ميعاد إلغاء القرارات الإدارية',
      'تحليل صحة القرارات الإدارية',
      'تقديم دعاوى التعويض',
      'مشورة التظلمات الإدارية',
    ],
  },
  {
    id: 'labor',
    nameAr: 'مستشار العمل والتأمينات',
    nameEn: 'Labor & Social Insurance Specialist',
    domain: 'labor',
    icon: '👷',
    systemPrompt: `أنت مستشار قانوني متخصص في قانون العمل والتأمينات الاجتماعية.
قانون العمل 12/2003، قانون التأمينات 148/2019.
الفصل التعسفي، مكافأة نهاية الخدمة، إصابات العمل.
قدم إجابات مفصلة.`,
    knowledgeBase: [
      'الفصل التعسفي: تعويض = أجر شهرين عن كل سنة',
      'مكافأة نهاية الخدمة: نصف一个月 عن كل سنة (حد أقصى)',
      'إجازة سنوية: 21 يوماً ترفع إلى 30 بعد 10 سنوات',
      'التأمين على إصابات العمل: على صاحب العمل',
    ],
    primaryLaws: [
      'قانون العمل 12/2003',
      'قانون التأمينات الاجتماعية 148/2019',
    ],
    capabilities: [
      'حساب مكافأة نهاية الخدمة',
      'تقييم التعويض عن الفصل التعسفي',
      'مشورة إصابات العمل',
      'التأمينات الاجتماعية',
    ],
  },
  {
    id: 'forensic',
    nameAr: 'وكيل كولومبو التفتيشي',
    nameEn: 'Inspector Colombo Forensic Agent',
    domain: 'forensic',
    icon: '🔍',
    systemPrompt: `أنت وكيل تفتيش جنائي متخصص في تدقيق المحاضر الشرطة والتحقيقات.
المراجع: المواد 40، 41، 44 (القبض والتفتيش)، 36 (عرض النيابة)، 137 (الأدلة).
حلل المحاضر واكتشف الثغرات الإجرائية.`,
    knowledgeBase: [
      'بطلان القبض: غياب إذن النيابة (المادة 40)',
      'seizure المضبوطات: يجب توثيق ساعات القيد (المادة 41)',
      'عرض النيابة: خلال 24 ساعة من القبض (المادة 36)',
      'تناقض الأقوال: مقارنة الشهادات مع التقارير الطبية',
    ],
    primaryLaws: [
      'قانون الإجراءات الجنائية 150/1950',
      'قانون العقوبات 58/1937',
    ],
    capabilities: [
      'تحليل محاضر الشرطة واكتشاف الثغرات',
      'مقارنة الأقوال مع الأدلة الفنية',
      'حساب الفجوات الزمنية الإجرائية',
      'اقتراح الدفوع الجنائية المناسبة',
    ],
  },
];

// ============================================================
// Agent Swarm Orchestrator
// ============================================================
export class AgentSwarm {
  private availableProvider: LLMProvider | null = null;
  private agentMap: Map<string, LegalAgent>;

  constructor() {
    this.agentMap = new Map(LEGAL_AGENTS.map((a) => [a.id, a]));
  }

  async initialize(): Promise<void> {
    this.availableProvider = await detectAvailableProvider();
  }

  getAgent(agentId: string): LegalAgent | undefined {
    return this.agentMap.get(agentId);
  }

  getAllAgents(): LegalAgent[] {
    return LEGAL_AGENTS;
  }

  getAgentsByDomain(domain: AgentDomain): LegalAgent[] {
    return LEGAL_AGENTS.filter((a) => a.domain === domain);
  }

  async processRequest(request: AgentRequest): Promise<AgentResponse> {
    const agent = this.agentMap.get(request.agentId);
    if (!agent) {
      throw new Error(`Agent not found: ${request.agentId}`);
    }

    const messages: ChatMessage[] = [
      { role: 'system', content: agent.systemPrompt },
      ...(request.conversationHistory ?? []),
      { role: 'user', content: request.query },
    ];

    const startTime = Date.now();
    const result = await chatCompletion(messages, {
      provider: this.availableProvider ?? 'ollama',
      temperature: 0.3,
      maxTokens: 1024,
    });

    return {
      agentId: request.agentId,
      content: result.content,
      disclaimer: LEGAL_DISCLAIMER,
      provider: result.provider,
      latencyMs: Date.now() - startTime,
      fromCache: result.fromCache,
    };
  }

  /**
   * Multi-agent consultation: send query to multiple agents and aggregate.
   */
  async multiAgentConsult(
    agentIds: string[],
    query: string,
  ): Promise<AgentResponse[]> {
    const results = await Promise.allSettled(
      agentIds.map((id) =>
        this.processRequest({ agentId: id, query }),
      ),
    );

    return results
      .filter(
        (r): r is PromiseFulfilledResult<AgentResponse> =>
          r.status === 'fulfilled',
      )
      .map((r) => r.value);
  }
}

// Singleton instance
let swarmInstance: AgentSwarm | null = null;

export async function getAgentSwarm(): Promise<AgentSwarm> {
  if (!swarmInstance) {
    swarmInstance = new AgentSwarm();
    await swarmInstance.initialize();
  }
  return swarmInstance;
}
