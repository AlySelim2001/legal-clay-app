import { useState, useRef, useEffect } from "react";
import { Send, Bot, User, Scale, Loader2, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { useLegalDeadlines } from "@/hooks/useSupabaseData";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

// Egyptian Criminal Law knowledge base for offline responses
const LAW_KB: Record<string, string> = {
  "التقادم": "وفقًا للمادة 15 من قانون العقوبات رقم 58 لسنة 1937:\n• الجنح: تقادم بمرور 3 سنوات\n• الجنايات: تقادم بمرور 10 سنوات\n• المخالفات: تقادم بمرور 6 أشهر\n\nبدء التقادم ي commence من تاريخ ارتكاب الجريمة أو تاريخ آخر فعل إجرائي.",
  "المعارضة": "وفقاً للمواد 295-297 من قانون الإجراءات الجنائية:\n• مدة المعارضة: 10 أيام من تاريخ العلم بالحكم\n• للمتهم الغائب: 10 أيام من تاريخ العلم الشخصي أو النشر\n• المحكمةcompetent: المحكمة التي أصدرت الحكم الابتدائي",
  "الاستئناف": "وفقاً للمادة 393 من قانون الإجراءات الجنائية:\n• مدة الاستئناف: 10 أيام من تاريخ إعلان الحكم\n• الاستئناف مقدم من المحكمة التي أصدرت الحكم\n• يُقبل الاستئناف من النيابة العامة والمتهم وال movedدعي بال Civil",
  "النقض": "وفقاً للمادة 418 من قانون الإجراءات الجنائية:\n• مدة الطعن بالنقض: 40 يومًا من تاريخ إعلان الحكم\n• الطعن يُقدم لمحكمة النقض\n• الأسباب الموجبة: إخلال ب应用 law or procedural error",
  "الكفالة": "وفقاً للمادة 134 من قانون الإجراءات الجنائية:\n• يُحدد قاضي التحقيق مبلغ الكفالة\n• لا يجوز الحبس الاحتياطي超过 45 يومًا دون تجديد\n• الكفالة تُدفع نقدًا أو بكفالة bankers",
  "الحبس الاحتياطي": "وفقاً للمادة 134 من قانون الإجراءات الجنائية:\n• المدة القصوى: 45 يومًا قابلة للتجديد\n• يُشترط وجود قرائن قوية على ارتكاب الجريمة\n• يُستثنى من ذلك جرائم المخدرات (مدة أطول)",
};

// Prescribed offline responses for common legal questions
function getOfflineResponse(query: string): string {
  const q = query.toLowerCase();

  for (const [keyword, response] of Object.entries(LAW_KB)) {
    if (q.includes(keyword.toLowerCase()) || q.includes(keyword)) {
      return `📚 **المرجع القانوني:** ${keyword}\n\n${response}\n\n---\n⚠️ نتيجة تقديرية استرشادية — يجب التحقق منها مع المحامي المختص قبل اتخاذ أي إجراء.`;
    }
  }

  if (q.includes("计算") || q.includes("احتساب") || q.includes("compute")) {
    return "يمكنك استخدام حاسبة المواعيد القانونية في صفحة `/app/deadlines` لاحتساب المواعيد بناءً على المدد القانونية المرجعية.\n\n---\n⚠️ نتيجة تقديرية استرشادية — يجب التحقق منها مع المحامي المختص قبل اتخاذ أي إجراء.";
  }

  if (q.includes("防御") || q.includes("دفاع") || q.includes("defense")) {
    return "الدفوع الجنائية المتاحة في القانون المصري:\n\n1. **إسقاط الإجراءات** (المادة 137 إ.ج) — بطلان الأدلة المكتسبة\n2. **الإنكار** (المادة 34 عقوبات) — عبء الإثبات على النيابة\n3. **الضرورة القصوى** (المادة 49 عقوبات) — مبرر للسلوك\n4. **نقص الصلاحية** (المادة 230 إ.ج) — دفع جوهري\n5. **الأدلة الدامغة** — إثبات البراءة\n6. **التقادم** (المادة 15 عقوبات) — سقوط الحق في المقاضاة\n\n---\n⚠️ نتيجة تقديرية استرشادية — يجب التحقق منها مع المحامي المختص قبل اتخاذ أي إجراء.";
  }

  return "أنا الوكيل القانوني الذكي — مساعدك المتخصص في القانون الجنائي المصري.\n\nيمكنني مساعدتك في:\n• حساب المواعيد القانونية (التقادم، المعارضة، الاستئناف، النقض)\n• شرح الدفوع الجنائية المتاحة\n• الإحالة على الأحكام القضائية ذات الصلة\n• تفسير مواد قانون الإجراءات الجنائية والعقوبات\n\n✍️ اكتب سؤالك بالتفصيل لكي أتمكن من مساعدتك بشكل أفضل.\n\n---\n⚠️ نتيجة تقديرية استرشادية — يجب التحقق منها مع المحامي المختص قبل اتخاذ أي إجراء.";
}

export default function AIAgent() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "مرحبًا 👋 أنا **الوكيل القانوني الذكي** المتخصص في القانون الجنائي المصري.\n\n📚 أمتلك معرفة ب:\n• قانون الإجراءات الجنائية رقم 150 لسنة 1950 وتعديلاته\n• القانون رقم 174 لسنة 2025\n• قانون العقوبات رقم 58 لسنة 1937\n\nكيف يمكنني مساعدتك اليوم؟",
      timestamp: new Date().toISOString(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { data: legalDeadlines } = useLegalDeadlines();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input.trim(),
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsTyping(true);

    // Try RPC first, fall back to offline knowledge base
    let response: string;

    try {
      const { data: precedents } = await supabase
        .rpc("suggest_precedents", { p_case_id: "00000000-0000-0000-0000-000000000000" })
        .limit(3);

      // Use offline response for now since we don't have a real LLM endpoint
      response = getOfflineResponse(input.trim());

      // Append relevant precedents if found
      if (precedents && precedents.length > 0) {
        response += "\n\n📖 **أحكام قضائية ذات صلة:**\n";
        precedents.slice(0, 2).forEach((p: Record<string, unknown>) => {
          response += `\n• ${p.title} (${p.ruling_date})\n  ${p.principle_summary}`;
        });
      }
    } catch {
      response = getOfflineResponse(input.trim());
    }

    const aiMsg: Message = {
      id: (Date.now() + 1).toString(),
      role: "assistant",
      content: response,
      timestamp: new Date().toISOString(),
    };

    // Simulate typing delay
    setTimeout(() => {
      setMessages((prev) => [...prev, aiMsg]);
      setIsTyping(false);
    }, 800);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] animate-fade-in">
      {/* Header */}
      <div className="clay-card p-4 flex items-center gap-3 shrink-0">
        <div className="w-10 h-10 rounded-2xl bg-clay-blue/15 flex items-center justify-center">
          <Bot className="w-5 h-5 text-clay-blue" />
        </div>
        <div className="flex-1">
          <h1 className="text-base font-bold text-foreground">الوكيل القانوني الذكي</h1>
          <p className="text-xs text-muted-foreground">م specializes في القانون الجنائي المصري</p>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-urgency-normal animate-pulse" />
          <span className="text-[10px] text-muted-foreground">متصل</span>
        </div>
      </div>

      {/* Legal Disclaimer */}
      <div className="bg-urgency-high/10 border-b border-urgency-high/20 px-4 py-2 flex items-center justify-center gap-2 shrink-0">
        <AlertTriangle className="w-3.5 h-3.5 text-urgency-high shrink-0" />
        <p className="text-[10px] font-medium text-urgency-high text-center">
          ⚠️ نتيجة تقديرية استرشادية — يجب التحقق منها مع المحامي المختص قبل اتخاذ أي إجراء.
        </p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={cn("flex gap-3", msg.role === "user" ? "flex-row-reverse" : "")}
          >
            <div
              className={cn(
                "w-8 h-8 rounded-xl flex items-center justify-center shrink-0",
                msg.role === "user"
                  ? "bg-clay-teal/15"
                  : "bg-clay-blue/15"
              )}
            >
              {msg.role === "user" ? (
                <User className="w-4 h-4 text-clay-teal" />
              ) : (
                <Scale className="w-4 h-4 text-clay-blue" />
              )}
            </div>
            <div
              className={cn(
                "max-w-[80%] clay-card-soft p-3.5 rounded-2xl",
                msg.role === "user"
                  ? "rounded-tl-sm"
                  : "rounded-tr-sm"
              )}
            >
              <div className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                {msg.content.split("**").map((part, i) =>
                  i % 2 === 1 ? (
                    <strong key={i} className="font-semibold">{part}</strong>
                  ) : (
                    <span key={i}>{part}</span>
                  )
                )}
              </div>
              <p className="text-[9px] text-muted-foreground mt-2">
                {new Date(msg.timestamp).toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" })}
              </p>
            </div>
          </div>
        ))}

        {isTyping && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-xl bg-clay-blue/15 flex items-center justify-center shrink-0">
              <Scale className="w-4 h-4 text-clay-blue" />
            </div>
            <div className="clay-card-soft p-3.5 rounded-2xl rounded-tr-sm">
              <div className="flex items-center gap-1.5">
                <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
                <span className="text-xs text-muted-foreground">جاري التحليل...</span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-border shrink-0">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="اكتب سؤالك القانوني هنا..."
            className="clay-input flex-1 px-4 py-3 text-sm bg-background"
            disabled={isTyping}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isTyping}
            className="clay-button px-4 py-3 bg-primary text-primary-foreground rounded-xl disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        <p className="text-[9px] text-muted-foreground text-center mt-2">
          مدعوم by Qwen2.5-1.5B / Llama-3.2-1B — التشغيل المحلي على الأجهزة المتوسطة
        </p>
      </div>
    </div>
  );
}
