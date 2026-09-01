import { useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  FileText,
  Landmark,
  UserCheck,
  Wallet,
  BookOpen,
  Printer,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ────────────────────────────────────────────────────────────
interface StepData {
  id: number;
  title: string;
  titleEn: string;
  icon: React.ElementType;
  department: string;
  role: string;
  roleDescription: string;
  documents: string[];
  estimatedTime: string;
  instructions: string[];
  tips: string[];
  warning?: string;
  article?: string;
}

// ── Step Data ────────────────────────────────────────────────────────
const steps: StepData[] = [
  {
    id: 1,
    title: "جدول الجنح — التحقق من حالة الحكم",
    titleEn: "Court Register — Verify Judgment Status",
    icon: FileText,
    department: "جدول الجنح — Clerk of Records",
    role: "أمين السر",
    roleDescription: "المسؤول عن إصدار صور الأحكام وتسجيل البيانات في سجلات المحكمة الرسمية.",
    documents: [
      "بطاقة الرقم القومي الأصلية",
      "صورة من الحكم الغيابي (إن وُجدت)",
      "شارة القضية أو رقمها",
    ],
    estimatedTime: "15 — 30 دقيقة",
    instructions: [
      "توجه إلى جدول الجنح في المحكمة المختصة.",
      "اطلب من أمين السر التحقق من حالة الحكم الغيابي في النظام الإلكتروني.",
      "احصل على صورة رسمية من الحكم الغيابي (مختومة وم signed).",
      "تأكد من صحة تاريخ العلم بالحكم — إذ منه يبدأ ميعاد المعارضة.",
    ],
    tips: [
      "الحكم الغيابي هو الحكم الصادر في غياب المتهم.",
      "مدة المعارضة: 10 أيام من تاريخ العلم بالحكم (المادة 295 إجراءات جنائية).",
      "إذا كان الحكم صادراً بالغرامة فقط، قد لا يكون هناك نية للمعارضة.",
    ],
    article: "المادة 295 — قانون الإجراءات الجنائية رقم 150 لسنة 1950",
  },
  {
    id: 2,
    title: "خزينة المحكمة — دفع رسوم المعارض",
    titleEn: "Court Treasury — Pay Opposition Fees",
    icon: Wallet,
    department: "خزينة المحكمة — Court Treasury",
    role: "الصراف",
    roleDescription: "المسؤول عن استلام الرسوم الحكومية وإصدار الإيصالات الرسمية.",
    documents: [
      "صورة من الحكم الغيابي",
      "بطاقة الرقم القومي",
      "إيصال دفع الرسوم (احتفظ بالصورة الأصلية)",
    ],
    estimatedTime: "10 — 20 دقيقة",
    instructions: [
      "توجه إلى خزينة المحكمة (عادةً في الطابق الأرضي).",
      "اطلب إصدار إيصال دفع رسوم المعارض.",
      "ادفع المبلغ المطلوب (رسوم المحكمة + رسوم الإخطار).",
      "احصل على الإيصال المختوم — ستحتاجه في خطوة المعارضات.",
    ],
    tips: [
      "احتفظ بنسخة من الإيصال في ملف القضية.",
      "الرسوم قد تتغير — تأكد من المبلغ الحالي مع الصراف.",
      "بعض المحاكم تقبل الدفع الإلكتروني — اسأل عن هذا الخيار.",
    ],
  },
  {
    id: 3,
    title: "قلم المعارضات — تقديم تقرير المعارض",
    titleEn: "Opposition Desk — File Official Opposition",
    icon: Landmark,
    department: "قلم المعارضات — Opposition Desk",
    role: "كاتب المعارضات",
    roleDescription: "المسؤول عن استلام طلبات المعارض وتسجيلها في السجل الرسمي وتحديد موعد الجلسة.",
    documents: [
      "صورة الحكم الغيابي",
      "إيصال دفع الرسوم",
      "بطاقة الرقم القومي",
      "了一份 مختصرة بأسباب المعارض (اختياري لكن يُنصح بها)",
    ],
    estimatedTime: "20 — 40 دقيقة",
    instructions: [
      "توجه إلى قلم المعارضات في المحكمة.",
      "سلّم مستندات المعارض لكاتب المعارضات.",
      "املأ نموذج طلب المعارض (يُوفر في القلم).",
      "احصل على رقم الوارد وتاريخ تسجيل المعارض.",
      "سيتم تحديد موعد جلسة المعارض خلال 30 — 60 يوماً.",
    ],
    tips: [
      "اكتب أسباب المعارض بوضوح: إما عدم العلم بالحكم أو وجود حجة دفاعية.",
      "أرسل إخطاراً للطرف الآخر (المدعي) بالمعارضة.",
      "اطلب نسخة من محضر المعارض المختوم.",
    ],
    article: "المادة 297 — قانون الإجراءات الجنائية رقم 150 لسنة 1950",
  },
  {
    id: 4,
    title: "قلم المحضرين — إخطار الطرف الآخر",
    titleEn: "Bailiffs Office — Route Court Summons",
    icon: UserCheck,
    department: "قلم المحضرين — Bailiffs Office",
    role: "المحضر الجنائي",
    roleDescription: "المسؤول عن إخطار الأطراف المعنويين وال physical بالجلسات وتسليم المحاضر الرسمية.",
    documents: [
      "محضر المعارض المسجل",
      "بيانات الطرف الآخر (الاسم، العنوان، رقم الهاتف إن وُجد)",
      "صورة من الحكم الغيابي",
    ],
    estimatedTime: "10 — 15 دقيقة (تقديم) + 3 — 7 أيام (تنفيذ)",
    instructions: [
      "سلّم طلب الإخطار لقلم المحضرين مرفقاً ببيانات الطرف الآخر.",
      "احصل على رقم الإخطار وتاريخ التقديم.",
      "سيقوم المحضر الجنائي بتسليم الإخطار للطرف الآخر.",
      "إذا تعذر التسليم، يُعاد الإخطار مع تقرير مبرر.",
    ],
    tips: [
      "تأكد من صحة العنوان — التأخير في التسليم يؤجل الجلسة.",
      "يمكنك طلب تتبع حالة الإخطار من القلم.",
      "في حالة تعذر التسليم، يمكن طلب نشر إعلان في الجرائد الرسمية.",
    ],
  },
  {
    id: 5,
    title: "قاعة الجلسات — حضور جلسة المعارض",
    titleEn: "Courtroom Session — Attend Opposition Hearing",
    icon: CheckCircle2,
    department: "قاعة الجلسات — Courtroom",
    role: "القاضي وأمين سر الجلسة",
    roleDescription: "القاضي المختص بالبت في المعارض وamin سر الجلسة المسؤول عن تدوين المحاضر.",
    documents: [
      "بطاقة الرقم القومي الأصلية",
      "محضر المعارض",
      "ملف الدفاع (أدلة، شهود، مستندات داعمة)",
      " breathedPower of Attorney (توكيل رسمي) إن تم التوكيل لمحامٍ آخر",
    ],
    estimatedTime: "Variables — حسب عدد القضايا في الروة",
    instructions: [
      "احضر إلى المحكمة قبل الموعد المحدد بـ 30 دقيقة على الأقل.",
      "سجّل حضورك مع أمين سر الجلسة.",
      "انتظر النطق بالقضية حسب ترتيب الروة.",
      "عند النطق بالقضية، قدم المعارض وأسبابها.",
      "يمكنك طلب تأجيل الجلسة مرة واحدة فقط (الأولى).",
    ],
    tips: [
      "الأثر في المحكمة ملزم — حضورك ضروري لنجاح المعارض.",
      "إذا كنت تستخدم محامياً، تأكد من وجوده في المحكمة.",
      "احمل جميع المستندات الأصلية + نسخ إضافية.",
      "الحكم في المعارض يُصدر في الجلسة ذاتها أو تأجيل لisclosed.",
    ],
    article: "المادة 298 — قانون الإجراءات الجنائية رقم 150 لسنة 1950",
  },
];

// ── Component ────────────────────────────────────────────────────────
export default function OppositionGuide() {
  const [expandedStep, setExpandedStep] = useState<number | null>(1);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());

  const toggleStep = (id: number) => {
    setExpandedStep(expandedStep === id ? null : id);
  };

  const toggleComplete = (id: number) => {
    setCompletedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const progress = Math.round((completedSteps.size / steps.length) * 100);

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl mx-auto" dir="rtl">
      {/* Disclaimer */}
      <div className="flex items-start gap-3 rounded-xl border-2 border-amber-200 bg-amber-50 p-4">
        <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-bold text-amber-800">دليل إرشادي — غير بديل عن الاستشارة القانونية</p>
          <p className="text-xs text-amber-700 mt-1">
            هذا الدليل مُعد لمساعدة المواطنين غير المتخصصين. يجب التحقق من جميع المواعيد والإجراءات مع المحامي المختص أو سكرتارية المحكمة المختصة قبل اتخاذ أي إجراء رسمي.
          </p>
        </div>
      </div>

      {/* Header */}
      <div className="text-center">
        <h1 className="text-2xl font-bold text-foreground">
          عمل معارضة في حكم جنائي غيابي
        </h1>
        <p className="text-sm text-muted-foreground mt-2">
          دليل خطوة بخطوة لتقديم المعارضة أمام المحاكم المصرية
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          court procedures according to Egyptian Criminal Procedure Law No. 150/1950
        </p>
      </div>

      {/* Progress Bar */}
      <div className="clay-card p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-bold text-foreground">التقدم في الإجراءات</span>
          <span className="text-xs font-bold text-clay-blue">{progress}%</span>
        </div>
        <div className="w-full h-3 rounded-full bg-clay-surface overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-l from-primary to-clay-blue transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex justify-between mt-2">
          <span className="text-[10px] text-muted-foreground">{completedSteps.size} من {steps.length} خطوات مكتملة</span>
          {progress === 100 && (
            <span className="text-[10px] font-bold text-green-600">✨ أكملت جميع الخطوات!</span>
          )}
        </div>
      </div>

      {/* Timeline */}
      <div className="relative">
        {/* Vertical line */}
        <div className="absolute top-0 bottom-0 right-6 w-0.5 bg-clay-border" />

        <div className="space-y-4">
          {steps.map((step) => {
            const Icon = step.icon;
            const isExpanded = expandedStep === step.id;
            const isComplete = completedSteps.has(step.id);

            return (
              <div key={step.id} className="relative">
                {/* Step number circle */}
                <div className="absolute right-4 top-4 z-10">
                  <button
                    onClick={() => toggleComplete(step.id)}
                    className={cn(
                      "w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all",
                      isComplete
                        ? "bg-green-500 border-green-500 text-white"
                        : "bg-background border-clay-border hover:border-primary"
                    )}
                    title={isComplete ? "إلغاء الإكمال" : "تحديد كمكتمل"}
                  >
                    {isComplete && <CheckCircle2 className="w-3 h-3" />}
                  </button>
                </div>

                {/* Step Card */}
                <div className={cn(
                  "mr-14 clay-card overflow-hidden transition-all",
                  isComplete && "opacity-70"
                )}>
                  <button
                    onClick={() => toggleStep(step.id)}
                    className="w-full flex items-center gap-4 p-4 text-start hover:bg-clay-surface/50 transition-colors"
                  >
                    <div className={cn(
                      "rounded-xl p-2.5 shrink-0 transition-colors",
                      isComplete ? "bg-green-100" : "bg-primary/10"
                    )}>
                      <Icon className={cn("w-5 h-5", isComplete ? "text-green-600" : "text-primary")} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-clay-blue bg-clay-surface px-2 py-0.5 rounded-full">
                          الخطوة {step.id}
                        </span>
                        {isComplete && (
                          <span className="text-[10px] font-bold text-green-600">✓ مكتملة</span>
                        )}
                      </div>
                      <h3 className="text-sm font-bold text-foreground mt-1">{step.title}</h3>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{step.department}</p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="hidden sm:flex items-center gap-1 text-[10px] text-muted-foreground">
                        <Clock className="w-3 h-3" />
                        {step.estimatedTime}
                      </span>
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-muted-foreground" />
                      )}
                    </div>
                  </button>

                  {/* Expanded Content */}
                  {isExpanded && (
                    <div className="border-t border-clay-border p-4 space-y-4 animate-fade-in">
                      {/* Role Info */}
                      <div className="flex items-start gap-3 rounded-xl bg-clay-surface p-3">
                        <UserCheck className="w-4 h-4 text-clay-blue shrink-0 mt-0.5" />
                        <div>
                          <p className="text-xs font-bold text-foreground">{step.role}</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">{step.roleDescription}</p>
                        </div>
                      </div>

                      {/* Required Documents */}
                      <div>
                        <h4 className="text-xs font-bold text-foreground mb-2 flex items-center gap-2">
                          <FileText className="w-3 h-3 text-clay-blue" />
                          المستندات المطلوبة
                        </h4>
                        <ul className="space-y-1.5">
                          {step.documents.map((doc, i) => (
                            <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                              <span className="w-1.5 h-1.5 rounded-full bg-clay-blue shrink-0 mt-1.5" />
                              {doc}
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Instructions */}
                      <div>
                        <h4 className="text-xs font-bold text-foreground mb-2 flex items-center gap-2">
                          <Landmark className="w-3 h-3 text-clay-blue" />
                          خطوات التنفيذ
                        </h4>
                        <ol className="space-y-2">
                          {step.instructions.map((inst, i) => (
                            <li key={i} className="flex items-start gap-3 text-xs text-muted-foreground">
                              <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                                {i + 1}
                              </span>
                              <span className="leading-relaxed">{inst}</span>
                            </li>
                          ))}
                        </ol>
                      </div>

                      {/* Tips */}
                      <div className="rounded-xl bg-clay-blue/5 border border-clay-blue/20 p-3">
                        <h4 className="text-xs font-bold text-clay-blue mb-2 flex items-center gap-2">
                          <BookOpen className="w-3 h-3" />
                          نصائح مهمة
                        </h4>
                        <ul className="space-y-1.5">
                          {step.tips.map((tip, i) => (
                            <li key={i} className="text-[10px] text-muted-foreground leading-relaxed flex items-start gap-2">
                              <span className="text-clay-blue shrink-0">💡</span>
                              {tip}
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Legal Article */}
                      {step.article && (
                        <div className="flex items-center gap-2 text-[10px] text-clay-blue bg-clay-surface rounded-lg px-3 py-2">
                          <BookOpen className="w-3 h-3 shrink-0" />
                          <span className="font-bold">{step.article}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Summary Card */}
      <div className="clay-card p-6">
        <h3 className="text-sm font-bold text-foreground mb-4">ملخص الإجراءات</h3>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
          {steps.map((step) => (
            <div key={step.id} className="text-center">
              <div className={cn(
                "w-10 h-10 rounded-full mx-auto flex items-center justify-center mb-2",
                completedSteps.has(step.id) ? "bg-green-100 text-green-600" : "bg-clay-surface text-muted-foreground"
              )}>
                {completedSteps.has(step.id) ? (
                  <CheckCircle2 className="w-5 h-5" />
                ) : (
                  <span className="text-sm font-bold">{step.id}</span>
                )}
              </div>
              <p className="text-[10px] font-bold text-foreground">{step.role}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{step.estimatedTime}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Print & Export */}
      <div className="flex items-center justify-center gap-3">
        <button
          onClick={() => window.print()}
          className="clay-button px-4 py-2 text-xs font-semibold bg-clay-surface text-foreground rounded-xl flex items-center gap-2 hover:bg-clay-card transition-colors"
        >
          <Printer className="w-4 h-4" />
          طباعة الدليل
        </button>
      </div>

      {/* Footer Disclaimer */}
      <div className="text-center text-[10px] text-muted-foreground border-t border-clay-border pt-4">
        <p>
          ⚠️ نتيجة تقديرية استرشادية — يجب التحقق منها مع المحامي المختص قبل اتخاذ أي إجراء.
        </p>
        <p className="mt-1">
          جميع المواعيد والأرقام تقديرية وقد تختلف حسب المحكمة والظروف具体情况.
        </p>
      </div>
    </div>
  );
}
