import { useState, useRef, useEffect, useCallback } from "react";
import {
  Send,
  Bot,
  User,
  Scale,
  Loader2,
  AlertTriangle,
  Briefcase,
  Heart,
  Building2,
  HardHat,
  Shield,
  FileText,
  Gavel,
  Brain,
  Search,
  Landmark,
  Users,
  BookOpen,
  Zap,
  Globe,
} from "lucide-react";
import { sanitizeHtml } from "@/lib/sanitize";
import { LEGAL_AGENTS } from "@/lib/ai/agent-swarm";
import { ADVANCED_AGENTS } from "@/agents/advanced-agents";
import { getSwarmOrchestrator } from "@/agents/swarm-orchestrator";
import { getLegalChatbot } from "@/agents/legal-chatbot";
import { getDocumentGenerator } from "@/lib/legal-docs/templates";
import { getBlockchainTimestamp } from "@/lib/blockchain/timestamp";

// ============================================================
// Types
// ============================================================

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  agentId: string;
  timestamp: string;
}

interface AgentUI {
  id: string;
  name: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bgColor: string;
  borderColor: string;
  laws: string[];
  specialties: string[];
  category: string;
}

// ============================================================
// Agent UI Mapping
// ============================================================

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Scale,
  Briefcase,
  Heart,
  Building2,
  HardHat,
  Shield,
  FileText,
  Gavel,
  Brain,
  Search,
  Landmark,
  Users,
  BookOpen,
  Zap,
  Globe,
};

function mapAgentToUI(agent: { id: string; nameAr: string; nameEn: string; domain: string; icon: string; capabilities: string[]; primaryLaws: string[] }): AgentUI {
  const icons: Record<string, React.ComponentType<{ className?: string }>> = {
    criminal: Scale,
    civil: Briefcase,
    family: Heart,
    administrative: Building2,
    labor: HardHat,
    commercial: Globe,
    'intellectual-property': Brain,
    execution: Zap,
  };

  const colors: Record<string, { text: string; bg: string; border: string }> = {
    criminal: { text: "text-urgency-critical", bg: "bg-urgency-critical/10", border: "border-urgency-critical/20" },
    civil: { text: "text-clay-blue", bg: "bg-clay-blue/10", border: "border-clay-blue/20" },
    family: { text: "text-clay-green", bg: "bg-clay-green/10", border: "border-clay-green/20" },
    administrative: { text: "text-clay-purple", bg: "bg-clay-purple/10", border: "border-clay-purple/20" },
    labor: { text: "text-clay-coral", bg: "bg-clay-coral/10", border: "border-clay-coral/20" },
    commercial: { text: "text-clay-teal", bg: "bg-clay-teal/10", border: "border-clay-teal/20" },
    'intellectual-property': { text: "text-clay-blue", bg: "bg-clay-blue/10", border: "border-clay-blue/20" },
    execution: { text: "text-urgency-high", bg: "bg-urgency-high/10", border: "border-urgency-high/20" },
  };

  const domain = agent.domain as string;
  const c = colors[domain] ?? colors.criminal;

  return {
    id: agent.id,
    name: agent.nameAr,
    title: agent.nameEn,
    icon: icons[domain] ?? icons.criminal,
    color: c.text,
    bgColor: c.bg,
    borderColor: c.border,
    laws: agent.primaryLaws,
    specialties: agent.capabilities,
    category: domain,
  };
}

// Merge base + advanced agents
const ALL_AGENT_UI: AgentUI[] = [
  ...LEGAL_AGENTS.map((a) => mapAgentToUI(a)),
  ...ADVANCED_AGENTS.map((a) => mapAgentToUI(a)),
];

// Deduplicate by id
const UNIQUE_AGENTS = ALL_AGENT_UI.filter(
  (a, i, arr) => arr.findIndex((b) => b.id === a.id) === i
);

// ============================================================
// Knowledge Base for quick responses
// ============================================================

const AGENT_KB: Record<string, Record<string, string>> = {
  criminal: {
    "التقادم":
      "وفقًا للمادة 15 من قانون العقوبات 58/1937:\n• الجنح: تقادم بمرور 3 سنوات\n• الجنايات: تقادم بمرور 10 سنوات\n• المخالفات: تقادم بمرور 6 أشهر\n\nبدء التقادم من تاريخ ارتكاب الجريمة أو آخر فعل إجرائي.",
    "المعارضة":
      "وفقاً للمواد 295-297 من قانون الإجراءات الجنائية:\n• مدة المعارضة: 10 أيام من تاريخ العلم بالحكم\n• للمتهم الغائب: 10 أيام من تاريخ العلم الشخصي\n• المحكمة: المحكمة التي أصدرت الحكم الابتدائي",
    "الاستئناف":
      "وفقاً للمادة 393 من قانون الإجراءات الجنائية:\n• مدة الاستئناف: 10 أيام من تاريخ إعلان الحكم\n• يُقدم من المحكمة التي أصدرت الحكم\n• يُقبل من النيابة العامة والمتهم والمدعي بالحقوق الخاصة",
    "النقض":
      "وفقاً للمادة 418 من قانون الإجراءات الجنائية:\n• مدة الطعن بالنقض: 40 يومًا من تاريخ إعلان الحكم\n• الطعن يُقدم لمحكمة النقض\n• الأسباب: إخلال بتطبيق القانون أو خطأ في تطبيقه",
    "الكفالة":
      "وفقاً للمادة 134 من قانون الإجراءات الجنائية:\n• يُحدد قاضي التحقيق مبلغ الكفالة\n• لا يجوز الحبس الاحتياطي超过 45 يومًا دون تجديد\n• الكفالة تُدفع نقدًا أو بكفالة بنكية",
    "الحبس الاحتياطي":
      "وفقاً للمادة 134 من قانون الإجراءات الجنائية:\n• المدة القصوى: 45 يومًا قابلة للتجديد\n• يُشترط وجود قرائن قوية على ارتكاب الجريمة",
  },
  civil: {
    "التقادم الطويل":
      "وفقاً للمادة 375 من القانون المدني 131/1948:\n• التقادم الطويل: 15 سنة\n• يطبق على جميع الدعاوى المدنية",
    "التقادم القصير":
      "وفقاً للمواد 498-500 من القانون المدني:\n• المستندات التجارية: سنة واحدة\n• أتعاب المحاماة: سنتان\n• تعويض الحوادث: 3 سنوات",
    "التعويض":
      "وفقاً للمادة 221 من القانون المدني:\n• التعويض عن الضرر المباشر وغير المباشر\n• يشمل الضرر المادي والمعنوي",
  },
  family: {
    "النفقات":
      "وفقاً لقانون الأحوال الشخصية:\n• نفقات الأولاد: تُحدد حسب الاحتياج والＬＥＳ\n• نفقات الزوجة: Minimum لا يقل عن 1/3 من الأجر\n• المدى: حتى زوال سببها (بلوغ الأولاد)",
    "الحضانة":
      "وفقاً لقانون الأحوال الشخصية:\n• حضانة الأم للأولاد حتى 15 سنة\n• حضانة البنات حتى الزواج\n• بعد ذلك اختيار القاصر",
    "المواريث":
      "وفقاً لقانون الإرث 25/1929:\n• حصص الشريعة ثابتة لا تتغير\n• العوض بالتركة بين الورثة الشرعيين\n• الوصية لا تتجاوز ثلث التركة",
  },
  administrative: {
    "الإلغاء":
      "وفقاً للمادة 52 من قانون مجلس الدولة 47/1972:\n• مدة رفع دعوى الإلغاء: 60 يومًا\n• من تاريخ نشر القرار الإداري أو العلم به",
  },
  labor: {
    "الفصل التعسفي":
      "وفقاً للمادة 94 من قانون العمل 12/2003:\n• التعويض: 50 يومًا عن كل سنة خدمة\n• لا يجوز فصل العامل بسبب العضوية النقابية",
    "المكافأة":
      "وفقاً للمادة 35 من قانون العمل:\n• نصف شهر عن كل سنة أولى حتى 10 سنوات\n• شهر عن كل سنة فوق 10 سنوات",
  },
};

function getAgentResponse(agent: AgentUI, query: string): string {
  const category = agent.category;
  const agentKB = AGENT_KB[category] ?? {};

  for (const [keyword, response] of Object.entries(agentKB)) {
    if (query.includes(keyword)) {
      return `📚 **${keyword}** — ${agent.name}\n\n${response}`;
    }
  }
  return `أنا ${agent.name} — ${agent.title}.\n\nيمكنك سؤالي عن:\n${agent.specialties.slice(0, 4).map((s) => `• ${s}`).join("\n")}`;
}

// ============================================================
// Component
// ============================================================

export default function AIAgents() {
  const [selectedAgent, setSelectedAgent] = useState<AgentUI>(UNIQUE_AGENTS[0]);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content: `مرحبًا 👋 أنا **${UNIQUE_AGENTS[0].name}** المتخصص في ${UNIQUE_AGENTS[0].specialties.slice(0, 3).join("، ")}.\n\n📚 أمتلك معرفة بـ:\n${UNIQUE_AGENTS[0].laws.map((l) => `• ${l}`).join("\n")}\n\n🔍 يمكنني الوصول إلى ${UNIQUE_AGENTS.length} وكيل قانوني متخصص.\n\nكيف يمكنني مساعدتك اليوم؟`,
      agentId: UNIQUE_AGENTS[0].id,
      timestamp: new Date().toISOString(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [showAgentList, setShowAgentList] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const categories = [
    { id: "all", label: "الكل", count: UNIQUE_AGENTS.length },
    { id: "criminal", label: "جنائي", count: UNIQUE_AGENTS.filter((a) => a.category === "criminal").length },
    { id: "civil", label: "مدني", count: UNIQUE_AGENTS.filter((a) => a.category === "civil").length },
    { id: "family", label: "أسرة", count: UNIQUE_AGENTS.filter((a) => a.category === "family").length },
    { id: "administrative", label: "إداري", count: UNIQUE_AGENTS.filter((a) => a.category === "administrative").length },
    { id: "labor", label: "عمل", count: UNIQUE_AGENTS.filter((a) => a.category === "labor").length },
  ];

  const filteredAgents = filterCategory === "all"
    ? UNIQUE_AGENTS
    : UNIQUE_AGENTS.filter((a) => a.category === filterCategory);

  const selectAgent = useCallback(
    (agent: AgentUI) => {
      setSelectedAgent(agent);
      setShowAgentList(false);
      setMessages([
        {
          id: "welcome-" + agent.id,
          role: "assistant",
          content: `مرحبًا 👋 أنا **${agent.name}** المتخصص في:\n\n${agent.specialties.map((s) => `• ${s}`).join("\n")}\n\n📚 القوانين المرجعية:\n${agent.laws.map((l) => `• ${l}`).join("\n")}\n\nكيف يمكنني مساعدتك اليوم؟`,
          agentId: agent.id,
          timestamp: new Date().toISOString(),
        },
      ]);
    },
    []
  );

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input,
      agentId: selectedAgent.id,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsTyping(true);

    // Try orchestrator first, then local KB
    let response: string;
    let respondedBy = selectedAgent.id;

    try {
      const orchestrator = getSwarmOrchestrator();
      const analysis = await orchestrator.processQuery(input);

      if (analysis.agentResponses.length > 0) {
        response = analysis.synthesizedAnalysis;
        respondedBy = analysis.agentResponses[0].agentId;
      } else {
        response = getAgentResponse(selectedAgent, input);
      }
    } catch {
      response = getAgentResponse(selectedAgent, input);
    }

    response += "\n\n---\n⚠️ نتيجة تقديرية استرشادية — يجب التحقق منها مع المحامي المختص قبل اتخاذ أي إجراء.";

    await new Promise((resolve) => setTimeout(resolve, 800));

    setMessages((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        role: "assistant",
        content: response,
        agentId: respondedBy,
        timestamp: new Date().toISOString(),
      },
    ]);
    setIsTyping(false);
  };

  const renderMarkdown = (text: string) => {
    return text.split("\n").map((line, i) => {
      let styled = line;
      styled = styled.replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold">$1</strong>');
      if (styled.startsWith("• ") || styled.startsWith("- ")) {
        return (
          <div key={i} className="flex items-start gap-2 me-2">
            <span className="text-clay-purple mt-0.5">•</span>
            <span dangerouslySetInnerHTML={{ __html: sanitizeHtml(styled.slice(2)) }} />
          </div>
        );
      }
      if (styled === "---") {
        return <hr key={i} className="border-border/30 my-2" />;
      }
      return (
        <p key={i} className="min-h-[1.2em]" dangerouslySetInnerHTML={{ __html: sanitizeHtml(styled) }} />
      );
    });
  };

  const Icon = selectedAgent.icon;

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col" dir="rtl">
      {/* Agent Count Banner */}
      <div className="clay-card p-2 mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain className="w-4 h-4 text-clay-purple" />
          <span className="text-xs font-bold font-arabic text-foreground">
            {UNIQUE_AGENTS.length} وكيل قانوني متخصص
          </span>
        </div>
        <button
          onClick={() => setShowAgentList(!showAgentList)}
          className="text-xs text-clay-purple hover:underline font-arabic"
        >
          {showAgentList ? "إخفاء القائمة" : "عرض الكل"}
        </button>
      </div>

      {/* Agent List Panel */}
      {showAgentList && (
        <div className="clay-card p-3 mb-2 max-h-64 overflow-y-auto">
          {/* Category Filters */}
          <div className="flex items-center gap-1.5 mb-3 overflow-x-auto pb-1">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setFilterCategory(cat.id)}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold font-arabic whitespace-nowrap transition-all ${
                  filterCategory === cat.id
                    ? "bg-clay-purple text-white"
                    : "bg-muted/50 text-muted-foreground hover:bg-muted"
                }`}
              >
                {cat.label} ({cat.count})
              </button>
            ))}
          </div>

          {/* Agent Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {filteredAgents.map((agent) => {
              const AgentIcon = agent.icon;
              const isActive = agent.id === selectedAgent.id;
              return (
                <button
                  key={agent.id}
                  onClick={() => selectAgent(agent)}
                  className={`p-2.5 rounded-xl text-start transition-all ${
                    isActive
                      ? `${agent.bgColor} ${agent.borderColor} border-2`
                      : "border border-transparent hover:bg-muted/50"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <AgentIcon className={`w-4 h-4 ${agent.color}`} />
                    <span className="text-[11px] font-bold font-arabic text-foreground truncate">
                      {agent.name}
                    </span>
                  </div>
                  <p className="text-[9px] text-muted-foreground font-arabic truncate">
                    {agent.specialties.slice(0, 2).join(" • ")}
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Agent Selector Bar (compact) */}
      {!showAgentList && (
        <div className="clay-card p-2 mb-2 flex items-center gap-1.5 overflow-x-auto">
          {UNIQUE_AGENTS.slice(0, 10).map((agent) => {
            const AgentIcon = agent.icon;
            const isActive = agent.id === selectedAgent.id;
            return (
              <button
                key={agent.id}
                onClick={() => selectAgent(agent)}
                className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-[10px] font-bold font-arabic transition-all whitespace-nowrap ${
                  isActive
                    ? `${agent.bgColor} ${agent.color} ${agent.borderColor} border`
                    : "text-muted-foreground hover:bg-muted/50 border border-transparent"
                }`}
                title={agent.name}
              >
                <AgentIcon className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{agent.name}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Current Agent Info */}
      <div className={`clay-card p-3 mb-2 ${selectedAgent.borderColor} border`}>
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl ${selectedAgent.bgColor} flex items-center justify-center`}>
            <Icon className={`w-5 h-5 ${selectedAgent.color}`} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-bold font-arabic text-foreground">{selectedAgent.name}</h3>
            <p className="text-xs text-muted-foreground font-arabic truncate">
              {selectedAgent.specialties.slice(0, 4).join(" • ")}
            </p>
          </div>
        </div>
      </div>

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto space-y-3 px-1 mb-2">
        {messages.map((msg) => {
          const isUser = msg.role === "user";
          return (
            <div key={msg.id} className={`flex ${isUser ? "justify-start" : "justify-end"}`}>
              <div
                className={`max-w-[85%] rounded-2xl p-3 ${
                  isUser
                    ? "bg-muted text-foreground rounded-br-md"
                    : "clay-card text-foreground rounded-bl-md"
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  {isUser ? (
                    <User className="w-3.5 h-3.5 text-muted-foreground" />
                  ) : (
                    <Bot className="w-3.5 h-3.5 text-clay-purple" />
                  )}
                  <span className="text-[10px] text-muted-foreground font-arabic">
                    {isUser ? "أنت" : selectedAgent.name}
                  </span>
                </div>
                <div className="text-sm font-arabic leading-relaxed">
                  {renderMarkdown(msg.content)}
                </div>
              </div>
            </div>
          );
        })}
        {isTyping && (
          <div className="flex justify-end">
            <div className="clay-card p-3 rounded-bl-md">
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-xs text-muted-foreground font-arabic">جاري التحليل...</span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="clay-card p-3">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder={`اسأل ${selectedAgent.name}...`}
            className="clay-input flex-1 px-4 py-2.5 text-sm font-arabic bg-background"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isTyping}
            className="clay-button px-4 py-2.5 bg-clay-purple/10 text-clay-purple rounded-xl"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        <div className="flex items-center gap-1.5 mt-2">
          <AlertTriangle className="w-3 h-3 text-urgency-high" />
          <p className="text-[10px] text-muted-foreground font-arabic">
            نتيجة تقديرية — يجب التحقق منها مع المحامي المختص • {UNIQUE_AGENTS.length} وكيل متاح
          </p>
        </div>
      </div>
    </div>
  );
}
