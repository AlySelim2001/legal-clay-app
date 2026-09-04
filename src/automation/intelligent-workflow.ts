/**
 * Intelligent Workflow Automation — CRIM-SYS 2026
 *
 * Browser-safe adaptation of the pasted sketch
 * (`src/automation/intelligent-workflow.ts`): the `n8n-workflow`
 * package is a Node-host workflow runtime and cannot run inside this
 * Vite SPA (see docs/dependency-decisions.md). This module keeps the
 * sketch's declarative model — registered workflows with triggers and
 * ordered steps — but every step executes against modules the app
 * already ships:
 *
 *   classify-case-type     → SwarmOrchestrator.classifyQuery()
 *   assign-specialist      → swarm routing (suggested agents)
 *   calculate-deadlines    → DEADLINE_RULES date arithmetic
 *   generate-checklist     → per-domain Egyptian case checklists
 *   notify-lawyer          → browser Notification + OpenLawOffice task
 *   ocr-scan               → real Tesseract.js OCR (uploaded file)
 *   check-compliance       → per-domain compliance rule sets
 *   extract-key-precedents → RAG precedents retriever
 *   store-securely         → app's offline-first IndexedDB layer
 *
 * Runs are deterministic, fully offline, and logged to the offline
 * store (`type: "workflow_run"`). Step failures never abort the whole
 * run: each step reports ok/skipped/error independently.
 */

import type { LegalCategory } from "@/legal-db/egyptian-codes";
import { DEADLINE_RULES } from "@/legal-db/egyptian-codes";
import { getSwarmOrchestrator } from "@/agents/swarm-orchestrator";
import { RAGRetriever } from "@/rag/retriever";
import { processDocument } from "@/lib/open-source/ocr";
import {
  cacheData,
  getCachedData,
  deleteCachedData,
} from "@/lib/open-source/offline-sync";
import { OpenLawOfficeIntegration } from "@/integrations/github-open-source";

// ============================================================
// Domain labels & checklists
// ============================================================

const DOMAIN_AR: Record<LegalCategory, string> = {
  criminal: "جنائي",
  civil: "مدني",
  commercial: "تجاري",
  family: "أحوال شخصية",
  administrative: "إداري",
  labor: "عمالي",
  "intellectual-property": "ملكية فكرية",
  forensic: "أدلة جنائية (رقمي/طب شرعي)",
  execution: "تنفيذ جبري",
  bankruptcy: "إفلاس وتصفية",
  arbitration: "تحكيم دولي",
};

const COMPLIANCE_RULES: Record<string, string[]> = {
  criminal: [
    "تأكد من أمر الإحالة أو القبض — بطلان الإجراءات (المادتان 40 و41 إجراءات)",
    "تحقق من مدة الحبس الاحتياطي وتواريخها",
    "أصل وثيقة التوكيل معتمد من النقابة",
  ],
  civil: [
    "صلاحية أصل العقد/السند وختم التوثيق",
    "مراجعة التقادم المسقط قبل التقاضي",
    "إعلان صحيح بعنوان المعلن إليه",
  ],
  family: [
    "وثائق الزواج/الطلاق/الخلع الأصلية",
    "إثبات الدخل والملاءة (نفقة/حضانة)",
    "المستندات الدالة على إقامة الصغير",
  ],
  commercial: [
    "السجل التجاري وشهادة التأسيس",
    "صلاحية التوقيعات وسلطة الممثل القانوني",
    "العقود وشروط التحكيم والاختصاص",
  ],
  administrative: [
    "إثبات تاريخ العلم بالقرار الإداري (ميعاد الطعن)",
    "القرار المطعون فيه ومرفقاته الرسمية",
    "توكيل خاص بالطعن أمام مجلس الدولة",
  ],
  labor: [
    "عقد العمل وإخطار الفصل",
    "كشف الأجور والمنشآت التأمينية",
    "ميعاد الدعوى العمالية (60 يوماً)",
  ],
  "intellectual-property": [
    "شهادة التسجيل أو أولوية البراءة/العلامة",
    "إثبات تاريخ الاستعمال السابق",
    "توكيل خاص بالتعامل مع جهاز الملكية الفكرية",
  ],
  forensic: [
    "سلسلة الحيازة للأدلة الرقمية (Chain of Custody)",
    "تقرير المعمل الجنائي أو الخبير الفني معتمداً",
    "أصل وسائط الأدلة وصورها المحفوظة",
  ],
  execution: [
    "السند التنفيذي وصيغته التنفيذية الأصلية",
    "إعلان السند للمدين قبل الحجز",
    "بيان أموال المدين ومأمورية التنفيذ",
  ],
  bankruptcy: [
    "قرار إشهار الإفلاس أو التصفية",
    "كشوف الدائنين والمطالبات المؤيدة",
    "تقرير أمين التفليسة أو المصفي",
  ],
  arbitration: [
    "اتفاق التحكيم أو الشرط التحكيمي",
    "مذكرات الدفاع أمام هيئة التحكيم",
    "قرار الهيئة ومحضر إعلانه (الطعن)",
  ],
};

const DEFAULT_CHECKLIST: Record<string, string[]> = {
  criminal: [
    "أمر الإحالة / محضر التحقيق",
    "حافظة مستندات مرقمة الفهارس",
    "مذكرة الدفاع التمهيدية",
    "توكيل من النقابة وتصويراته",
  ],
  civil: [
    "صورة الدعوى والسندات المرفقة",
    "إعلان الدعوى وتاريخه",
    "مذكرة الرد على الدفع الشكلي",
    "قائمة الشهود والمستندات",
  ],
  family: [
    "عقد الزواج وبياناته",
    "المستندات المالية (إثبات الدخل)",
    "تقرير هيئة الخبراء عند الحاجة",
    "توكيل المحامي المعتمد",
  ],
  commercial: [
    "عقد التأسيس والسجل التجاري",
    "المراسلات والعقود محل النزاع",
    "كشوف الحسابات والمراجع",
    "توكيل إدارة النزاع التجاري",
  ],
  administrative: [
    "القرار الإداري المطعون فيه",
    "المستندات الدالة على العلم بالقرار",
    "أسباب الطعن والمذكرات",
    "توكيل خاص بالطعن",
  ],
  labor: [
    "عقد العمل وإخطارات الأجور",
    "شهادة التفتيش/المفاوضة الودية",
    "كشف حساب مستحقات",
    "إثبات تاريخ الفصل",
  ],
  "intellectual-property": [
    "شهادات التسجيل وسندات الأولوية",
    "نماذج المقارنة (العنصر محل الحماية)",
    "مستندات إثبات الاستعمال",
    "توكيلات الجهات المتخصصة",
  ],
  forensic: [
    "سلسلة الحيازة وضبط الوسائط",
    "تقرير المعمل الجنائي",
    "صور الأدلة الرقمية الموقوتة",
    "شهادة الخبير الفني",
  ],
  execution: [
    "السند التنفيذي وصيغته",
    "إعلان الحجز وأوراقه",
    "بيان أموال المدين",
    "مذكرة تقدير المصاريف والأتعاب",
  ],
  bankruptcy: [
    "قرار الإشهار أو التصفية",
    "كشوف الدائنين",
    "تقرير الأمين/المصفي",
    "مذكرة توزيع الأموال",
  ],
  arbitration: [
    "اتفاق التحكيم وسنده",
    "مذكرات الدفاع أمام الهيئة",
    "مستندات الإثبات المقدمة",
    "توكيل خاص بالتحكيم",
  ],
};

const SESSION_CHECKLIST = [
  "حافظة المستندات وأصول الأوراق",
  "توكيل المحامي وصورة من عضوية النقابة",
  "مذكرة الدفاع (أصل + نسخ للمحكمة)",
  "الحوافظ الثبوتية وشهادة الإعلان",
  "تقرير مصاريف الجلسة والسفر",
];

const SPECIALIST_LABELS: Record<LegalCategory, string[]> = {
  criminal: ["وكيل الجنايات المستشار", "وكيل النقض والاستئناف", "وكيل التفتيش القضائي"],
  civil: ["وكيل الشركات والعقود", "وكيل التنفيذ الجبري"],
  commercial: ["وكيل الشركات والعقود", "وكيل الإفلاس والتصفية"],
  family: ["وكيل النفقة والحضانة", "وكيل الميراث والتركات"],
  administrative: ["وكيل الطعون والاستئناف", "وكيل قضايا الأموال العامة"],
  labor: ["وكيل العمال والمستحقات", "وكيل الطعون والاستئناف"],
  "intellectual-property": ["وكيل الملكية الفكرية", "وكيل الشركات والعقود"],
  forensic: ["وكيل الجرائم الإلكترونية والأدلة", "وكيل التفتيش القضائي"],
  execution: ["وكيل التنفيذ الجبري", "وكيل الأموال العامة"],
  bankruptcy: ["وكيل الإفلاس والتصفية", "وكيل الشركات والعقود"],
  arbitration: ["وكيل التحكيم الدولي", "وكيل الشركات والعقود"],
};

// ============================================================
// Types
// ============================================================

export type WorkflowId =
  | "new-case-intake"
  | "document-review"
  | "deadline-monitoring"
  | "court-session-prep";

export interface WorkflowInput {
  key: string;
  label: string;
  placeholder: string;
  required?: boolean;
}

export interface WorkflowContext {
  [key: string]: string;
}

export interface WorkflowStepOutcome {
  id: string;
  labelAr: string;
  ok: boolean;
  skipped: boolean;
  detail: string;
  durationMs: number;
}

export interface WorkflowRunSummary {
  workflowId: WorkflowId;
  workflowLabel: string;
  startedAt: string;
  finishedAt: string;
  status: "completed" | "completed-with-notes" | "failed";
  steps: WorkflowStepOutcome[];
}

interface WorkflowRunRecord extends WorkflowRunSummary {
  id: string;
  type: "workflow_run";
  context: WorkflowContext;
}

export interface WorkflowDefinition {
  id: WorkflowId;
  labelAr: string;
  descAr: string;
  triggerAr: string;
  inputs: WorkflowInput[];
  acceptFile?: boolean;
  fileInputLabel?: string;
  stepsPreview: string[];
}

// ============================================================
// Helpers
// ============================================================

const newRunId = () =>
  `workflow-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

const todayISO = () => new Date().toISOString().slice(0, 10);

const addDaysISO = (days: number): string => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

const isoInDays = (baseISO: string, days: number): string => {
  const d = new Date(`${baseISO}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

const daysUntil = (baseISO: string): number => {
  const base = new Date(`${baseISO}T00:00:00`);
  const now = new Date(`${todayISO()}T00:00:00`);
  return Math.round((base.getTime() - now.getTime()) / 86_400_000);
};

function significantTokens(text: string): string[] {
  return text
    .replace(/[^\u0600-\u06FFa-zA-Z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2);
}

/** First deadline rule whose trigger/law/notes contain any query token. */
function matchDeadlineRule(text: string) {
  const tokens = significantTokens(text);
  if (tokens.length === 0) return undefined;
  return DEADLINE_RULES.find((rule) => {
    const haystack = `${rule.trigger} ${rule.notes} ${rule.law} ${rule.article}`;
    return tokens.some((t) => haystack.includes(t));
  });
}

/** Awaitable tick so step latencies are visible and the UI can paint. */
const tick = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Send a browser notification when permitted; never throws. */
async function browserNotify(title: string, body: string): Promise<boolean> {
  try {
    if (typeof Notification === "undefined") return false;
    if (Notification.permission === "granted") {
      new Notification(title, { body });
      return true;
    }
    const permission = await Notification.requestPermission();
    if (permission === "granted") {
      new Notification(title, { body });
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

const olo = new OpenLawOfficeIntegration();

async function pushLawyerTask(input: {
  caseCode: string;
  title: string;
  dueDays: number;
  assignee: string;
}): Promise<string> {
  const task = await olo.addTask({
    caseCode: input.caseCode || "غير محدد",
    title: input.title,
    dueDate: addDaysISO(input.dueDays),
    assignee: input.assignee,
  });
  return task.id;
}

// ============================================================
// Workflow definitions
// ============================================================

const DEFINITIONS: WorkflowDefinition[] = [
  {
    id: "new-case-intake",
    labelAr: "إدخال قضية جديدة",
    descAr: "تصنيف القضية، إسناد الوكيل المتخصص، احتساب المواعيد القانونية، وتوليد قائمة المهام — عند إنشاء قضية.",
    triggerAr: "trigger: case-created",
    inputs: [
      { key: "title", label: "موضوع القضية / الواقعة", placeholder: "مثال: اتهام بالقتل العمد — جناية", required: true },
      { key: "caseCode", label: "رقم القضية (اختياري)", placeholder: "مثال: ج-2026-0847" },
      { key: "court", label: "المحكمة (اختياري)", placeholder: "مثال: محكمة جنايات القاهرة" },
      { key: "lawyer", label: "المحامي المسؤول", placeholder: "مثال: أ/ أحمد سليم" },
    ],
    stepsPreview: ["تصنيف نوع القضية (سرب الوكلاء)", "إسناد الوكيل المتخصص", "احتساب المواعيد القانونية", "توليد قائمة المهام", "إشعار المحامي"],
  },
  {
    id: "document-review",
    labelAr: "مراجعة مستند",
    descAr: "مسح OCR حقيقي للمستند المرفوع، تصنيفه، فحص الالتزام، وحفظه في خزينة الملفات المحلية.",
    triggerAr: "trigger: document-uploaded",
    inputs: [
      { key: "docTitle", label: "اسم المستند", placeholder: "مثال: محضر تحقيق نيابة", required: true },
      { key: "caseCode", label: "رقم القضية", placeholder: "مثال: ج-2026-0847" },
    ],
    acceptFile: true,
    fileInputLabel: "أرفق صورة المستند للتعرف الضوئي (Tesseract)",
    stepsPreview: ["مسح ضوئي OCR (Tesseract)", "تصنيف المستند", "فحص الالتزام", "حفظ آمن محلياً"],
  },
  {
    id: "deadline-monitoring",
    labelAr: "مراقبة الميعاد القانوني",
    descAr: "فحص حالة الميعاد قبل 7/3/1 أيام، إرسال تذكيرات، والتصعيد للمحامي الأول عند التجاوز.",
    triggerAr: "trigger: deadline-approaching",
    inputs: [
      { key: "caseCode", label: "رقم القضية", placeholder: "مثال: ج-2026-0847", required: true },
      { key: "caseTitle", label: "وصف الميعاد", placeholder: "مثال: ميعاد الطعن بالنقض", required: true },
      { key: "deadlineDate", label: "تاريخ الاستحقاق", placeholder: todayISO(), required: true },
      { key: "lawyer", label: "المحامي المتابع", placeholder: "مثال: أ/ أحمد سليم" },
    ],
    stepsPreview: ["فحص الحالة (7/3/1 يوم قبل الاستحقاق)", "إرسال تذكير (إشعار + مهمة)", "تصعيد عند التجاوز"],
  },
  {
    id: "court-session-prep",
    labelAr: "تجهيز جلسة محكمة",
    descAr: "جمع ملف القضية، استرجاع الأحكام المرشدة، توليد مسودة المذكرة، وقائمة تجهيزات الجلسة.",
    triggerAr: "trigger: session-scheduled",
    inputs: [
      { key: "caseCode", label: "رقم القضية", placeholder: "مثال: ج-2026-0847", required: true },
      { key: "sessionType", label: "نوع الجلسة", placeholder: "مثال: جنايات / جنحة / نقض", required: true },
      { key: "sessionDate", label: "تاريخ الجلسة", placeholder: todayISO() },
    ],
    stepsPreview: ["جمع ملف القضية من الخزينة المحلية", "استرجاع الأحكام المرشدة (RAG)", "توليد مسودة المذكرة", "قائمة تجهيزات الجلسة"],
  },
];

export const WORKFLOW_DEFINITIONS: WorkflowDefinition[] = DEFINITIONS;

// ============================================================
// Step runners
// ============================================================

type Runner = (ctx: WorkflowContext, file?: File | null) => Promise<{ ok: boolean; skipped?: boolean; detail: string }>;

const RUNNERS: Record<string, Runner> = {
  // ---- new-case-intake -----------------------------------------
  async classify_case_type(ctx) {
    const text = `${ctx.title ?? ""} ${ctx.court ?? ""} ${ctx.caseCode ?? ""}`;
    const swarm = getSwarmOrchestrator();
    const c = swarm.classifyQuery(text);
    const domain = DOMAIN_AR[c.primaryDomain] ?? c.primaryDomain;
    return {
      ok: true,
      detail: `التصنيف: ${domain}${c.complexity === "complex" ? " — تعقيد مرتفع، يُفضّل تعدد الوكلاء" : c.complexity === "moderate" ? " — تعقيد متوسط" : ""}`,
    };
  },

  async assign_specialist_agent(ctx) {
    const text = `${ctx.title ?? ""} ${ctx.court ?? ""}`;
    const swarm = getSwarmOrchestrator();
    const c = swarm.classifyQuery(text);
    const roster = SPECIALIST_LABELS[c.primaryDomain] ?? [];
    const agents = c.suggestedAgents.length > 0 ? c.suggestedAgents.slice(0, 2) : roster.slice(0, 2);
    return {
      ok: true,
      detail: agents.length
        ? `أسند إلى: ${agents.join("، ")}`
        : `أسند إلى: ${DOMAIN_AR[c.primaryDomain]} — الوكيل العام`,
    };
  },

  async calculate_deadlines(ctx) {
    const text = `${ctx.title ?? ""} ${ctx.court ?? ""}`;
    const rule = matchDeadlineRule(text);
    if (!rule) {
      return { ok: true, detail: "لم تطابق قاعدة مواعيد من قاعدة المواعيد المدمجة — راجع الميعاد يدوياً" };
    }
    const due = addDaysISO(rule.days);
    return {
      ok: true,
      detail: `${rule.law} — ${rule.article} (${rule.trigger}): ${rule.days} يوم → الاستحقاق ${due}`,
    };
  },

  async generate_checklist(ctx) {
    const text = `${ctx.title ?? ""} ${ctx.court ?? ""}`;
    const swarm = getSwarmOrchestrator();
    const { primaryDomain } = swarm.classifyQuery(text);
    const items = DEFAULT_CHECKLIST[primaryDomain] ?? DEFAULT_CHECKLIST.criminal;
    return { ok: true, detail: items.map((i) => `• ${i}`).join("\n") };
  },

  async notify_lawyer(ctx) {
    const caseCode = ctx.caseCode?.trim() || "غير محدد";
    const title = ctx.title?.trim() || "قضية جديدة";
    const lawyer = ctx.lawyer?.trim() || "المحامي المختص";
    const notified = await browserNotify(
      "قضية جديدة — CRIM-SYS",
      `${title} (${caseCode}) — راجعت قائمة المهام والمواعيد المحسوبة.`,
    );
    const taskId = await pushLawyerTask({
      caseCode,
      title: `مراجعة ملف القضية: ${title}`,
      dueDays: 1,
      assignee: lawyer,
    });
    return {
      ok: true,
      detail: `مهمة «مراجعة ملف القضية» أُنشئت للمحامي${notified ? " + إشعار متصفح مرسل" : " (إشعار المتصفح غير متاح — المهمة محفوظة محلياً)"} (id: ${taskId.slice(0, 12)})`,
    };
  },

  // ---- document-review ------------------------------------------
  async ocr_scan(ctx, file) {
    if (!file) {
      return { ok: true, skipped: true, detail: "لم يُرفق ملف — أعد التشغيل مع صورة المستند لتشغيل OCR حقيقي (Tesseract.js)" };
    }
    const result = await processDocument(file);
    const head = result.extractedText.trim().slice(0, 220) || "(لم يُستخرج نص — قد تكون الصورة غير واضحة)";
    return {
      ok: true,
      detail: `استُخرج ${result.extractedText.trim().length} حرفاً — ثقة ${Math.round((result.confidenceScore ?? 0) * 100)}%\n«${head}${result.extractedText.trim().length > 220 ? "…" : ""}»`,
    };
  },

  async classify_document(ctx, file) {
    const text = `${ctx.docTitle ?? ""} ${ctx.caseCode ?? ""}`;
    const swarm = getSwarmOrchestrator();
    const c = swarm.classifyQuery(text);
    return { ok: true, detail: `نوع المستند: ${DOMAIN_AR[c.primaryDomain]} (أهم الكلمات: ${c.keywords.slice(0, 4).join("، ") || "—"})` };
  },

  async check_compliance(ctx, file) {
    const text = `${ctx.docTitle ?? ""} ${ctx.caseCode ?? ""}`;
    const swarm = getSwarmOrchestrator();
    const { primaryDomain } = swarm.classifyQuery(text);
    const rules = COMPLIANCE_RULES[primaryDomain] ?? COMPLIANCE_RULES.criminal;
    const detail = rules.map((r) => `⚠ ${r}`).join("\n");
    return { ok: true, detail: `فحص الالتزام (${rules.length} قواعد):\n${detail}` };
  },

  async store_securely(ctx) {
    const record = {
      id: newRunId(),
      type: "workflow_document",
      docTitle: ctx.docTitle?.trim() || "مستند غير معنون",
      caseCode: ctx.caseCode?.trim() || null,
      storedAt: new Date().toISOString(),
    } as const;
    await cacheData("attachments", record);
    return { ok: true, detail: `حُفظ في الخزينة المحلية (IndexedDB) — المرجع ${record.id}` };
  },

  // ---- deadline-monitoring --------------------------------------
  async check_status(ctx) {
    const due = ctx.deadlineDate?.trim() || todayISO();
    const diff = daysUntil(due);
    const lines = [7, 3, 1].map((d) => {
      if (diff < 0) return `• قبل ${d} يوم: ⏰ الميعاد قد تجاوز (متأخر ${-diff} يوم)`;
      if (diff <= d) return `• قبل ${d} يوم: 🚨 قريب — متبقٍ ${diff} يوم`;
      return `• قبل ${d} يوم: آمن (متبقٍ ${diff} يوم)`;
    });
    return { ok: true, detail: lines.join("\n") };
  },

  async send_reminder(ctx) {
    const due = ctx.deadlineDate?.trim() || todayISO();
    const diff = daysUntil(due);
    const caseCode = ctx.caseCode?.trim() || "غير محدد";
    const lawyer = ctx.lawyer?.trim() || "المحامي المتابع";
    if (diff > 3) {
      return { ok: true, skipped: true, detail: "الميعاد بعيد (> 3 أيام) — لا تذكير الآن" };
    }
    const notified = await browserNotify(
      "تذكير ميعاد قانوني — CRIM-SYS",
      `${ctx.caseTitle ?? "ميعاد"} يستحق ${due} (متبقٍ ${Math.max(diff, 0)} يوم).`,
    );
    await pushLawyerTask({
      caseCode,
      title: `تذكير: ${ctx.caseTitle ?? "ميعاد قانوني"} (${due})`,
      dueDays: 0,
      assignee: lawyer,
    });
    return { ok: true, detail: `تذكير أُنشئ${notified ? " + إشعار متصفح" : ""} لميعاد ${due}` };
  },

  async escalate(ctx) {
    const due = ctx.deadlineDate?.trim() || todayISO();
    const diff = daysUntil(due);
    const caseCode = ctx.caseCode?.trim() || "غير محدد";
    if (diff >= 0) {
      return { ok: true, skipped: true, detail: "الميعاد لم يتجاوز بعد — لا تصعيد" };
    }
    await pushLawyerTask({
      caseCode,
      title: `تصعيد ميعاد متجاوز: ${ctx.caseTitle ?? "ميعاد"} (متأخر ${-diff} يوم)`,
      dueDays: 0,
      assignee: "المحامي الأول (تصعيد)",
    });
    return { ok: true, detail: `تصعيد فوري للمحامي الأول — تجاوز الميعاد ${-diff} يوماً` };
  },

  // ---- court-session-prep ---------------------------------------
  async gather_case_files(ctx) {
    const code = ctx.caseCode?.trim() ?? "";
    if (!code) return { ok: true, skipped: true, detail: "لا يوجد رقم قضية للبحث في الخزينة" };
    const all = (await getCachedData("attachments")) as Array<Record<string, unknown>>;
    const related = all.filter((r) =>
      ["session_transcript", "arkcase_synced_case", "workflow_document"].includes(r.type as string) &&
      String(r.case_code ?? r.caseCode ?? "").includes(code),
    );
    return { ok: true, detail: `وجد ${related.length} ملفاً مرتبطاً بالقضية في الخزينة المحلية (جلسات مسجلة / قضايا متزامنة / مستندات)` };
  },

  async extract_key_precedents(ctx) {
    const retriever = new RAGRetriever({ topK: 3, typeFilter: "precedent" });
    const query = `${ctx.caseCode ?? ""} ${ctx.sessionType ?? ""} طعن نقض`.trim();
    const hits = await retriever.retrieve(query);
    if (hits.length === 0) {
      return { ok: true, skipped: true, detail: "لا أحكام مرشدة مطابقة — راجع دفاعك من قاعدة الأحكام يدوياً" };
    }
    const lines = hits.map(
      (h, i) =>
        `${i + 1}. ${h.content.slice(0, 110)}${h.content.length > 110 ? "…" : ""} (${h.metadata.court}${h.metadata.date ? `، ${h.metadata.date}` : ""})`,
    );
    return { ok: true, detail: lines.join("\n") };
  },

  async generate_brief(ctx) {
    const retriever = new RAGRetriever({ topK: 3, typeFilter: "precedent" });
    const hits = await retriever.retrieve(`${ctx.caseCode ?? ""} ${ctx.sessionType ?? ""}`.trim());
    const articles = [...new Set(hits.map((h) => h.metadata.articleRef).filter(Boolean))];
    const body =
      hits.length > 0
        ? `بالاستناد إلى ما استقرت عليه محكمة النقض (الأحكام المرشدة أعلاه)${articles.length ? `، وإلى ${articles.join("، ")}` : ""}، يلتمس الدفع بجلسة ${ctx.sessionType ?? "النظر"} المنعقدة في ${ctx.sessionDate ?? "—"}.`
        : "مسودة مبدئية: تُستكمل بعد استرجاع الأحكام المرشدة من قاعدة السوابق المحلية.";
    return { ok: true, detail: body };
  },

  async create_session_checklist() {
    return { ok: true, detail: SESSION_CHECKLIST.map((i) => `• ${i}`).join("\n") };
  },
};

// ============================================================
// Engine
// ============================================================

function labelFor(workflowId: WorkflowId): string {
  return (DEFINITIONS.find((d) => d.id === workflowId)?.labelAr) ?? workflowId;
}

function stepLabel(stepId: string): string {
  const map: Record<string, string> = {
    classify_case_type: "تصنيف نوع القضية",
    assign_specialist_agent: "إسناد الوكيل المتخصص",
    calculate_deadlines: "احتساب المواعيد القانونية",
    generate_checklist: "توليد قائمة المهام",
    notify_lawyer: "إشعار المحامي",
    ocr_scan: "المسح الضوئي OCR",
    classify_document: "تصنيف المستند",
    check_compliance: "فحص الالتزام",
    store_securely: "حفظ آمن محلياً",
    check_status: "فحص حالة الميعاد",
    send_reminder: "إرسال تذكير",
    escalate: "تصعيد عند التجاوز",
    gather_case_files: "جمع ملف القضية",
    extract_key_precedents: "استرجاع الأحكام المرشدة",
    generate_brief: "توليد مسودة المذكرة",
    create_session_checklist: "قائمة تجهيزات الجلسة",
  };
  return map[stepId] ?? stepId;
}

const STEP_ORDER: Record<WorkflowId, string[]> = {
  "new-case-intake": ["classify_case_type", "assign_specialist_agent", "calculate_deadlines", "generate_checklist", "notify_lawyer"],
  "document-review": ["ocr_scan", "classify_document", "check_compliance", "store_securely"],
  "deadline-monitoring": ["check_status", "send_reminder", "escalate"],
  "court-session-prep": ["gather_case_files", "extract_key_precedents", "generate_brief", "create_session_checklist"],
};

export class LegalWorkflowAutomation {
  /**
   * The sketch's `registerWorkflow` — definitions are declared above
   * and looked up by name (registration is idempotent).
   */
  registerWorkflow(id: WorkflowId): WorkflowDefinition {
    const def = DEFINITIONS.find((d) => d.id === id);
    if (!def) throw new Error(`Workflow غير معروف: ${id}`);
    return def;
  }

  listWorkflows(): WorkflowDefinition[] {
    return DEFINITIONS;
  }

  /** The sketch's `executeWorkflow(name, context)`. */
  async executeWorkflow(
    workflowName: string,
    context: WorkflowContext,
    file?: File | null,
  ): Promise<WorkflowRunSummary> {
    const def = DEFINITIONS.find((d) => d.id === workflowName);
    if (!def) {
      return {
        workflowId: workflowName as WorkflowId,
        workflowLabel: workflowName,
        startedAt: new Date().toISOString(),
        finishedAt: new Date().toISOString(),
        status: "failed",
        steps: [{
          id: "unknown",
          labelAr: "تدفق غير معروف",
          ok: false,
          skipped: false,
          detail: `لا يوجد تدفق باسم ${workflowName}`,
          durationMs: 0,
        }],
      };
    }

    const startedAt = new Date().toISOString();
    const outcomes: WorkflowStepOutcome[] = [];
    const stepIds = STEP_ORDER[def.id] ?? [];

    for (const stepId of stepIds) {
      const runner = RUNNERS[stepId];
      const started = performance.now();
      try {
        const result = runner ? await runner(context, file) : { ok: false, detail: `لا منفذ لخطوة ${stepId}` };
        outcomes.push({
          id: stepId,
          labelAr: stepLabel(stepId),
          ok: result.ok,
          skipped: Boolean(result.skipped),
          detail: result.detail,
          durationMs: Math.max(1, Math.round(performance.now() - started)),
        });
      } catch (error) {
        outcomes.push({
          id: stepId,
          labelAr: stepLabel(stepId),
          ok: false,
          skipped: false,
          detail: error instanceof Error ? error.message : "خطأ غير معروف",
          durationMs: Math.max(1, Math.round(performance.now() - started)),
        });
      }
      await tick(120); // pace steps so the UI can render each outcome
    }

    const finishedAt = new Date().toISOString();
    const failed = outcomes.some((s) => !s.ok && !s.skipped);
    const skipped = outcomes.some((s) => s.skipped);
    const summary: WorkflowRunSummary = {
      workflowId: def.id,
      workflowLabel: def.labelAr,
      startedAt,
      finishedAt,
      status: failed ? "failed" : skipped ? "completed-with-notes" : "completed",
      steps: outcomes,
    };

    const safeContext: WorkflowContext = {};
    for (const [key, value] of Object.entries(context)) {
      if (typeof value === "string") safeContext[key] = value.slice(0, 200);
    }
    const record: WorkflowRunRecord = {
      ...summary,
      id: newRunId(),
      type: "workflow_run",
      context: safeContext,
    };
    await cacheData("attachments", record);

    return summary;
  }
}

export function getWorkflowAutomation(): LegalWorkflowAutomation {
  return new LegalWorkflowAutomation();
}

// ============================================================
// Run log helpers (offline `attachments` store)
// ============================================================

export async function listWorkflowRuns(): Promise<WorkflowRunRecord[]> {
  const all = (await getCachedData("attachments")) as WorkflowRunRecord[];
  return all
    .filter((r) => r.type === "workflow_run")
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}

export async function deleteWorkflowRun(id: string): Promise<void> {
  await deleteCachedData("attachments", id);
}
