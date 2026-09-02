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
  ChevronLeft,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { sanitizeHtml } from "@/lib/sanitize";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  agentId: string;
  timestamp: string;
}

interface Agent {
  id: string;
  name: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bgColor: string;
  borderColor: string;
  laws: string[];
  specialties: string[];
  kb: Record<string, string>;
}

const AGENTS: Agent[] = [
  {
    id: "criminal",
    name: "المستشار الجنائي",
    title: "مستشار الإجراءات والجنايات",
    icon: Scale,
    color: "text-urgency-critical",
    bgColor: "bg-urgency-critical/10",
    borderColor: "border-urgency-critical/20",
    laws: ["قانون الإجراءات الجنائية 150/1950", "قانون العقوبات 58/1937", "القانون 174/2025"],
    specialties: ["التقادم الجنائي", "المعارضة", "الاستئناف", "النقض", "الكفالة", "الحبس الاحتياطي"],
    kb: {
      "التقادم": "وفقًا للمادة 15 من قانون العقوبات 58/1937:\n• الجنح: تقادم بمرور 3 سنوات\n• الجنايات: تقادم بمرور 10 سنوات\n• المخالفات: تقادم بمرور 6 أشهر\n\nبدء التقادم من تاريخ ارتكاب الجريمة أو تاريخ آخر فعل إجرائي.",
      "المعارضة": "وفقاً للمواد 295-297 من قانون الإجراءات الجنائية:\n• مدة المعارضة: 10 أيام من تاريخ العلم بالحكم\n• للمتهم الغائب: 10 أيام من تاريخ العلم الشخصي\n• المحكمة: المحكمة التي أصدرت الحكم الابتدائي",
      "الاستئناف": "وفقاً للمادة 393 من قانون الإجراءات الجنائية:\n• مدة الاستئناف: 10 أيام من تاريخ إعلان الحكم\n• الاستئناف من المحكمة التي أصدرت الحكم\n• يُقبل من النيابة العامة والمتهم والمدعي بالحقوق الخاصة",
      "النقض": "وفقاً للمادة 418 من قانون الإجراءات الجنائية:\n• مدة الطعن بالنقض: 40 يومًا من تاريخ إعلان الحكم\n• الطعن يُقدم لمحكمة النقض\n• الأسباب: إخلال بتطبيق القانون أو خطأ في تطبيقه",
      "الكفالة": "وفقاً للمادة 134 من قانون الإجراءات الجنائية:\n• يُحدد قاضي التحقيق مبلغ الكفالة\n• لا يجوز الحبس الاحتياطي超过 45 يومًا دون تجديد\n• الكفالة تُدفع نقدًا أو بكفالة بنكية",
    },
  },
  {
    id: "civil",
    name: "المستشار المدني والتجاري",
    title: "مستشارCivil & Commercial Law",
    icon: Briefcase,
    color: "text-clay-blue",
    bgColor: "bg-clay-blue/10",
    borderColor: "border-clay-blue/20",
    laws: ["القانون المدني 131/1948", "قانون المرافعات 13/1968", "قانون التجارة 17/1999"],
    specialties: ["التقادم الطويل", "التقادم القصير", "التعويض", "التنفيذ الجبري", "العقود", "المسؤولية التقصيرية"],
    kb: {
      "التقادم الطويل": "وفقاً للمادة 375 من القانون المدني 131/1948:\n• التقادم الطويل: 15 سنة\n• يطبق على جميع الدعاوى المدنية ما لم ينص القانون على خلاف ذلك\n• لا يجوز الاتفاق على تقليص أو تمديد المدة",
      "التقادم القصير": "وفقاً للمواد 498-500 من القانون المدني:\n• المستندات التجارية: سنة واحدة\n• أتعاب المحاماة: سنتان\n• تعويض الحوادث: 3 سنوات",
      "التعويض": "وفقاً للمادة 221 من القانون المدني:\n• التعويض عن الضرر المباشر والغير مباشر\n• يشمل الضرر المادي والمعنوي\n• يُحدد суд التقدير بذاته",
      "التنفيذ الجبري": "وفقاً للمرافعات المدنية 13/1968:\n• الإكراه البدني (الحبس)\n• الإكراه على المنقولات\n• الحجز العقاري\n• التخلع (البيع الجبري)",
    },
  },
  {
    id: "family",
    name: "مستشار الأحوال الشخصية",
    title: "مستشارPersonal Status & Family",
    icon: Heart,
    color: "text-clay-green",
    bgColor: "bg-clay-green/10",
    borderColor: "border-clay-green/20",
    laws: ["قانون الأحوال الشخصية 25/1920", "قانون الإرث 25/1929", "قانون الأسرة 1/2000"],
    specialties: ["النفقات", "الحضانة", "الخلع", "المواريث", "الطلاق", "شرعيات الميراث"],
    kb: {
      "النفقات": "وفقاً لقانون الأحوال الشخصية:\n• نفقات الأولاد: تُحدد حسب الاحتياج والleş\n• نفقات الزوجة: MINIMUM لا يقل عن 1/3 من الأجر\n• المدى: حتى زوال سببها (بلوغ الأولاد)",
      "الحضانة": "وفقاً لقانون الأحوال الشخصية:\n• حضانة الأم للأولاد حتى 15 سنة\n• حضانة البنات حتى الزواج\n• بعد ذلك اختيار القاصر",
      "الخلع": "وفقاً للمادة 1 من قانون الأحوال الشخصية 25/1920:\n• بذل عوض مالي من الزوجة للزوج\n• يُ书面 ويُسجل رسمياً\n• لا يسقط حق الأولاد في النفقة",
      "المواريث": "وفقاً لقانون الإرث 25/1929:\n• حصص الشريعة ثابتة لا تتغير\n• العوض بالتركة بين الورثة الشرعيين\n• الوصية لا تتجاوز ثلث التركة",
    },
  },
  {
    id: "administrative",
    name: "مستشار القضاء الإداري",
    title: "مستشارCouncil of State",
    icon: Building2,
    color: "text-clay-purple",
    bgColor: "bg-clay-purple/10",
    borderColor: "border-clay-purple/20",
    laws: ["قانون مجلس الدولة 47/1972", "قانون الإجراءات الإدارية"],
    specialties: ["الإلغاء", "التظلمات", "التعويض الإداري", " Contracts avec l'administration"],
    kb: {
      "الإلغاء": "وفقاً للمادة 52 من قانون مجلس الدولة 47/1972:\n• مدة رفع دعوى الإلغاء: 60 يومًا\n• من تاريخ نشر القرار الإداري أو العلم به\n• يجب إثبات مخالفة القانون أو بطلان الإجراءات",
      "التظلم الإداري": "وفقاً للمادة 23 من قانون مجلس الدولة:\n• يقدم خلال 60 يومًا من تاريخ القرار\n• يُعرض على الجهات الإدارية المختصة\n• مدة الرد: 30 يومًا",
      "التعويض الإداري": "وفقاً للمادة 54 من قانون مجلس الدولة:\n• التعويض عن الأضرار الناتجة عن أعمال الإدارة\n• يُقدم خلال 60 يومًا\n• لا يُشترط إثبات الخطأ في بعض الحالات",
    },
  },
  {
    id: "labor",
    name: "مستشار العمل والتأمينات",
    title: "مستشارLabor & Social Insurance",
    icon: HardHat,
    color: "text-clay-coral",
    bgColor: "bg-clay-coral/10",
    borderColor: "border-clay-coral/20",
    laws: ["قانون العمل 12/2003", "قانون التأمينات الاجتماعية 148/2019"],
    specialties: ["الفصل التعسفي", "المكافأة", "حوادث العمل", "التأمينات", "ساعات العمل"],
    kb: {
      "الفصل التعسفي": "وفقاً للمادة 94 من قانون العمل 12/2003:\n• التعويض: خمسين يومًا عن كل سنة خدمة\n• لا يجوز فصل العامل بسبب العضوية النقابية\n• الحكم بالتعويض لا يغني عن العودة للعمل",
      "المكافأة": "وفقاً للمادة 35 من قانون العمل:\n• نصف شهر عن كل سنة أولى و10 سنوات\n• شهر عن كل سنة فوق 10 سنوات\n• لا تقل عن خمسين يومًا أجر",
      "حوادث العمل": "وفقاً للمادة 103 من قانون العمل:\n• الإصابات الناتجة عن العمل أو بسببه\n• تعويض: 2-5 أضعاف الأجر الأساسي\n• يتحملها صاحب العمل أو شركات التأمين",
      "ساعات العمل": "وفقاً للمادة 30 من قانون العمل:\n• 8 ساعات يوميًا / 48 أسبوعيًا\n• التخفيض للعمل الشاق: 7 ساعات\n• العمل الليلي: زيادة 35% على الأجر",
    },
  },
];

function getAgentResponse(agent: Agent, query: string): string {
  const q = query.toLowerCase();
  for (const [keyword, response] of Object.entries(agent.kb)) {
    if (q.includes(keyword.toLowerCase()) || q.includes(keyword)) {
      return `📚 **${keyword}** — ${agent.name}\n\n${response}\n\n---\n⚠️ نتيجة تقديرية استرشادية — يجب التحقق منها مع المحامي المختص قبل اتخاذ أي إجراء.`;
    }
  }
  return `أنا ${agent.name}، متخصص في ${agent.specialties.slice(0, 3).join("، ")}.\n\nيمكنك سؤالي عن:\n${agent.specialties.map((s) => `• ${s}`).join("\n")}\n\n⚠️ نتيجة تقديرية استرشادية — يجب التحقق منها مع المحامي المختص قبل اتخاذ أي إجراء.`;
}

export default function AIAgents() {
  const [selectedAgent, setSelectedAgent] = useState<Agent>(AGENTS[0]);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content: `مرحبًا 👋 أنا **${AGENTS[0].name}** المتخصص في ${AGENTS[0].specialties.slice(0, 3).join("، ")}.\n\n📚 أمتلك معرفة بـ:\n${AGENTS[0].laws.map((l) => `• ${l}`).join("\n")}\n\nكيف يمكنني مساعدتك اليوم؟`,
      agentId: AGENTS[0].id,
      timestamp: new Date().toISOString(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [showAgentList, setShowAgentList] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const selectAgent = useCallback(
    (agent: Agent) => {
      setSelectedAgent(agent);
      setShowAgentList(false);
      setMessages([
        {
          id: "welcome-" + agent.id,
          role: "assistant",
          content: `مرحبًا 👋 أنا **${agent.name}** المتخصص في ${agent.specialties.slice(0, 3).join("، ")}.\n\n📚 أمتلك معرفة بـ:\n${agent.specialties.map((s) => `• ${s}`).join("\n")}\n\nكيف يمكنني مساعدتك اليوم؟`,
          agentId: agent.id,
          timestamp: new Date().toISOString(),
        },
      ]);
    },
    [],
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

    // Try RPC first, fall back to local KB
    try {
      const { data } = await supabase.rpc("get_agent_knowledge", {
        p_agent_type: selectedAgent.id,
      });

      let response: string;
      if (data && Array.isArray(data) && data.length > 0) {
        const kb = data as Array<{ topic: string; content: string; legal_basis: string }>;
        const match = kb.find(
          (k) =>
            input.includes(k.topic.toLowerCase()) ||
            k.topic.toLowerCase().includes(input.toLowerCase()),
        );
        response = match
          ? `📚 **${match.topic}** — ${selectedAgent.name}\n\n${match.content}\n\n📖 الأساس القانوني: ${match.legal_basis}\n\n---\n⚠️ نتيجة تقديرية استرشادية — يجب التحقق منها مع المحامي المختص قبل اتخاذ أي إجراء.`
          : getAgentResponse(selectedAgent, input);
      } else {
        response = getAgentResponse(selectedAgent, input);
      }

      // Simulate typing delay
      await new Promise((resolve) => setTimeout(resolve, 800));

      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: "assistant",
          content: response,
          agentId: selectedAgent.id,
          timestamp: new Date().toISOString(),
        },
      ]);
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 500));
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: "assistant",
          content: getAgentResponse(selectedAgent, input),
          agentId: selectedAgent.id,
          timestamp: new Date().toISOString(),
        },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  const renderMarkdown = (text: string) => {
    return text.split("\n").map((line, i) => {
      let styled = line;
      // Bold
      styled = styled.replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold">$1</strong>');
      // Bullet points
      if (styled.startsWith("• ") || styled.startsWith("- ")) {
        return (
          <div key={i} className="flex items-start gap-2 me-2">
            <span className="text-clay-purple mt-0.5">•</span>
            <span dangerouslySetInnerHTML={{ __html: sanitizeHtml(styled.slice(2)) }} />
          </div>
        );
      }
      // Horizontal rule
      if (styled === "---") {
        return <hr key={i} className="border-border/30 my-2" />;
      }
      return (
        <p
          key={i}
          className="min-h-[1.2em]"
          dangerouslySetInnerHTML={{ __html: sanitizeHtml(styled) }}
        />
      );
    });
  };

  const Icon = selectedAgent.icon;

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col" dir="rtl">
      {/* Agent Selector Bar */}
      <div className="clay-card p-3 mb-3 flex items-center gap-2 overflow-x-auto">
        {AGENTS.map((agent) => {
          const AgentIcon = agent.icon;
          const isActive = agent.id === selectedAgent.id;
          return (
            <button
              key={agent.id}
              onClick={() => selectAgent(agent)}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-arabic font-semibold transition-all whitespace-nowrap ${
                isActive
                  ? `${agent.bgColor} ${agent.color} ${agent.borderColor} border`
                  : "text-muted-foreground hover:bg-muted/50 border border-transparent"
              }`}
            >
              <AgentIcon className="w-4 h-4" />
              {agent.name}
            </button>
          );
        })}
      </div>

      {/* Current Agent Info */}
      <div className={`clay-card p-3 mb-3 ${selectedAgent.borderColor} border`}>
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
          <button
            onClick={() => setShowAgentList(!showAgentList)}
            className="p-2 rounded-lg hover:bg-muted/50"
          >
            <ChevronLeft className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
      </div>

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto space-y-3 px-1 mb-3">
        {messages.map((msg) => {
          const isUser = msg.role === "user";
          return (
            <div
              key={msg.id}
              className={`flex ${isUser ? "justify-start" : "justify-end"}`}
            >
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
                    <Bot className="w-3.5 h-3.5" style={{ color: "var(--tw-text-opacity)" }} />
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
                <span className="text-xs text-muted-foreground font-arabic">جاري الكتابة...</span>
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
            نتيجة تقديرية — يجب التحقق منها مع المحامي المختص
          </p>
        </div>
      </div>
    </div>
  );
}
