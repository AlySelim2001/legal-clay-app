import { internalMutation, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";
import {
  normalizeArabic,
  scanInjection,
  splitSentences,
  tokenOverlap,
  tokenize,
} from "./lib/text";

// ============================================================
// Personal case workspace — user-owned, IDOR-proof (T-012)
// ============================================================

export const listCases = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    return await ctx.db
      .query("cases")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();
  },
});

export const createCase = mutation({
  args: {
    title: v.string(),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("UNAUTHENTICATED");
    const now = Date.now();
    const caseId = await ctx.db.insert("cases", {
      userId,
      title: args.title.trim().slice(0, 200),
      description: args.description?.trim().slice(0, 2000),
      status: "active",
      createdAt: now,
      updatedAt: now,
    });
    await ctx.runMutation(internal.knowledge.insertAudit, {
      action: "case_created",
      userId,
      targetType: "case",
      targetId: caseId,
    });
    return caseId;
  },
});

export const caseDetail = query({
  args: { caseId: v.id("cases") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const kase = await ctx.db.get(args.caseId);
    if (!kase || kase.userId !== userId) return null; // ownership check
    const [events, notes, tasks] = await Promise.all([
      ctx.db
        .query("caseEvents")
        .withIndex("by_case", (q) => q.eq("caseId", args.caseId))
        .order("desc")
        .collect(),
      ctx.db
        .query("caseNotes")
        .withIndex("by_case", (q) => q.eq("caseId", args.caseId))
        .order("desc")
        .collect(),
      ctx.db
        .query("caseTasks")
        .withIndex("by_case", (q) => q.eq("caseId", args.caseId))
        .collect(),
    ]);
    const docLinks = await ctx.db
      .query("caseDocuments")
      .withIndex("by_case", (q) => q.eq("caseId", args.caseId))
      .collect();
    const documents = [];
    for (const link of docLinks) {
      const doc = await ctx.db.get(link.documentId);
      if (doc) {
        documents.push({
          _id: doc._id,
          name: doc.name,
          mimeType: doc.mimeType,
          sizeBytes: doc.sizeBytes,
          sha256: doc.sha256,
          createdAt: doc.createdAt,
          analyzed: Boolean(doc.analysis),
        });
      }
    }
    return { case: kase, events, notes, tasks, documents };
  },
});

export const addCaseEvent = mutation({
  args: {
    caseId: v.id("cases"),
    date: v.number(),
    description: v.string(),
    kind: v.union(v.literal("user_claim"), v.literal("verified_fact"), v.literal("document_event")),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("UNAUTHENTICATED");
    const kase = await ctx.db.get(args.caseId);
    if (!kase || kase.userId !== userId) throw new Error("NOT_FOUND");
    const id = await ctx.db.insert("caseEvents", {
      caseId: args.caseId,
      date: args.date,
      description: args.description.trim().slice(0, 1000),
      kind: args.kind,
      status: "open",
      createdAt: Date.now(),
    });
    await ctx.db.patch(args.caseId, { updatedAt: Date.now() });
    return id;
  },
});

export const addCaseNote = mutation({
  args: { caseId: v.id("cases"), body: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("UNAUTHENTICATED");
    const kase = await ctx.db.get(args.caseId);
    if (!kase || kase.userId !== userId) throw new Error("NOT_FOUND");
    const id = await ctx.db.insert("caseNotes", {
      caseId: args.caseId,
      body: args.body.trim().slice(0, 4000),
      createdAt: Date.now(),
    });
    await ctx.db.patch(args.caseId, { updatedAt: Date.now() });
    return id;
  },
});

export const addCaseTask = mutation({
  args: { caseId: v.id("cases"), title: v.string(), dueAt: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("UNAUTHENTICATED");
    const kase = await ctx.db.get(args.caseId);
    if (!kase || kase.userId !== userId) throw new Error("NOT_FOUND");
    const id = await ctx.db.insert("caseTasks", {
      caseId: args.caseId,
      title: args.title.trim().slice(0, 300),
      dueAt: args.dueAt,
      status: "open",
      createdAt: Date.now(),
    });
    await ctx.db.patch(args.caseId, { updatedAt: Date.now() });
    return id;
  },
});

export const toggleTask = mutation({
  args: { taskId: v.id("caseTasks"), done: v.boolean() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("UNAUTHENTICATED");
    const task = await ctx.db.get(args.taskId);
    if (!task) throw new Error("NOT_FOUND");
    const kase = await ctx.db.get(task.caseId);
    if (!kase || kase.userId !== userId) throw new Error("NOT_FOUND");
    await ctx.db.patch(args.taskId, { status: args.done ? "done" : "open" });
  },
});

// ============================================================
// Documents — text metadata only, injection-screened (T-002, T-007)
// ============================================================

const MAX_DOC_CHARS = 20000;

/** Analyze extracted text server-side: structure, dates, entities, references. */
function analyzeText(text: string) {
  const normalized = normalizeArabic(text);

  const dateMatches = [
    ...text.matchAll(/(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/g),
    ...text.matchAll(/(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})/g),
  ].map((m) => m[0]);

  const moneyMatches = [...text.matchAll(/(\d[\d,\.]*)\s*(جنيه|مصرى|مصري|EGP)/g)].map((m) => m[0]);

  const entityCandidates = new Set<string>();
  for (const m of text.matchAll(/(?:السيد|السيدة|السادس|الأستاذ|الاستاذ)\s+([\u0600-\u06FF]{2,}(?:\s+[\u0600-\u06FF]{2,}){1,3})/g)) {
    entityCandidates.add(m[1]!.trim());
  }

  const legalRefs = new Set<string>();
  for (const m of text.matchAll(/المادة\s*(?:رقم\s*)?(\d{1,3})/g)) legalRefs.add(m[1]!);
  for (const m of text.matchAll(/قانون\s*(?:رقم\s*)?(\d{1,3})\s*لسنة\s*(\d{4})/g)) {
    legalRefs.add(`قانون ${m[1]}/${m[2]}`);
  }

  const kinds: Array<{ key: string; label: string; re: RegExp }> = [
    { key: "promissory_note", label: "إيصال/سند لأمر", re: /(ايصال|إيصال|سند).*امانه|إيصال أمانة/ },
    { key: "police_report", label: "محضر شرطة", re: /محضر.*(قسم|شرطة)|محرر ضبط/ },
    { key: "contract", label: "عقد", re: /عقد|اتفاق/ },
    { key: "powers_of_attorney", label: "توكيل", re: /توكيل رسمي|توكييل/ },
    { key: "court_ruling", label: "حكم قضائي", re: /حكم|باسم الشعب/ },
    { key: "bank_statement", label: "كشف حساب", re: /كشف حساب|البنك/ },
  ];
  const detectedKinds = kinds.filter((k) => k.re.test(normalized)).map((k) => k.label);

  const sentences = splitSentences(text);
  const keyFacts = sentences.filter((s) => /\d|مبلغ|تاريخ|وقعت|بتاريخ/.test(s)).slice(0, 6);

  return {
    detectedKinds: detectedKinds.length > 0 ? detectedKinds : ["غير محدد"],
    dates: [...new Set(dateMatches)].slice(0, 10),
    amounts: [...new Set(moneyMatches)].slice(0, 10),
    entities: [...entityCandidates].slice(0, 10),
    legalReferences: [...legalRefs].slice(0, 10),
    keyFacts,
    sentenceCount: sentences.length,
    wordCount: tokenize(text).length,
  };
}

/**
 * Store a user document (text + metadata only). The caller (client) extracted
 * the text; the server re-validates size and screens prompt injection. The
 * document is DATA — its text never enters any prompt or system path (T-002).
 */
export const uploadDocument = mutation({
  args: {
    name: v.string(),
    mimeType: v.string(),
    sizeBytes: v.number(),
    sha256: v.string(),
    text: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("UNAUTHENTICATED");

    // MIME + size validation
    const ALLOWED_MIME = ["text/plain", "application/pdf", "image/jpeg", "image/png", "image/webp"];
    if (!ALLOWED_MIME.includes(args.mimeType)) throw new Error("UNSUPPORTED_TYPE");
    if (args.sizeBytes > 10 * 1024 * 1024) throw new Error("FILE_TOO_LARGE");
    if (!/^[a-f0-9]{64}$/.test(args.sha256)) throw new Error("INVALID_HASH");

    const text = args.text.slice(0, MAX_DOC_CHARS);
    const injectionFlags = scanInjection(text);

    const docId = await ctx.db.insert("userDocuments", {
      userId,
      name: args.name.trim().slice(0, 200),
      mimeType: args.mimeType,
      sizeBytes: args.sizeBytes,
      sha256: args.sha256,
      text,
      analysis: null,
      createdAt: Date.now(),
    });

    await ctx.runMutation(internal.knowledge.insertAudit, {
      action: "document_uploaded",
      userId,
      targetType: "userDocument",
      targetId: docId,
      details: `injection_flags=${injectionFlags.join("|") || "none"}`,
    });
    return { documentId: docId, injectionFlags };
  },
});

/** Run the document analyzer (server-side, structured, evidence-first). */
export const analyzeDocument = mutation({
  args: { documentId: v.id("userDocuments") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("UNAUTHENTICATED");
    const doc = await ctx.db.get(args.documentId);
    if (!doc || doc.userId !== userId) throw new Error("NOT_FOUND");
    const analysis = analyzeText(doc.text);
    await ctx.db.patch(args.documentId, { analysis });
    await ctx.runMutation(internal.knowledge.insertAudit, {
      action: "document_analyzed",
      userId,
      targetType: "userDocument",
      targetId: args.documentId,
    });
    return analysis;
  },
});

/** Compare two user documents and report overlaps/contradictions. */
export const compareDocuments = mutation({
  args: { a: v.id("userDocuments"), b: v.id("userDocuments") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("UNAUTHENTICATED");
    const [da, db] = await Promise.all([ctx.db.get(args.a), ctx.db.get(args.b)]);
    if (!da || !db || da.userId !== userId || db.userId !== userId) {
      throw new Error("NOT_FOUND");
    }
    const sim = tokenOverlap(tokenize(da.text), tokenize(db.text));
    const datesA = analyzeText(da.text).dates;
    const datesB = analyzeText(db.text).dates;
    const conflictingDates = datesA.filter((d) => !datesB.includes(d) && datesB.length > 0);
    return {
      similarity: Math.round(sim * 100) / 100,
      sameDay: datesA.some((d) => datesB.includes(d)),
      conflictingDates,
      note:
        conflictingDates.length > 0
          ? "توجد اختلافات في التواريخ بين المستندين — يلزم مراجعة بشرية."
          : "لم يتم رصد تعارض واضح في التواريخ المذكورة.",
    };
  },
});

/** List the signed-in user's documents (metadata + analysis preview). */
export const listMyDocuments = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const docs = await ctx.db
      .query("userDocuments")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(50);
    return docs.map((d) => ({
      _id: d._id,
      name: d.name,
      mimeType: d.mimeType,
      sizeBytes: d.sizeBytes,
      sha256: d.sha256,
      createdAt: d.createdAt,
      analyzed: Boolean(d.analysis),
      preview: d.text.slice(0, 160),
    }));
  },
});

/** Delete a document — with audit (privacy: deletion workflows P-07). */
export const deleteDocument = mutation({
  args: { documentId: v.id("userDocuments") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("UNAUTHENTICATED");
    const doc = await ctx.db.get(args.documentId);
    if (!doc || doc.userId !== userId) throw new Error("NOT_FOUND");
    await ctx.db.delete(args.documentId);
    await ctx.runMutation(internal.knowledge.insertAudit, {
      action: "document_deleted",
      userId,
      targetType: "userDocument",
      targetId: args.documentId,
    });
  },
});

// ============================================================
// Notifications
// ============================================================

export const myNotifications = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    return await ctx.db
      .query("notifications")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(30);
  },
});

export const markNotificationRead = mutation({
  args: { notificationId: v.id("notifications") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("UNAUTHENTICATED");
    const n = await ctx.db.get(args.notificationId);
    if (!n || n.userId !== userId) throw new Error("NOT_FOUND");
    await ctx.db.patch(args.notificationId, { read: true });
  },
});

/** Internal helper used when the system notifies users (e.g. after review). */
export const pushNotificationInternal = internalMutation({
  args: {
    userId: v.id("users"),
    title: v.string(),
    body: v.string(),
    kind: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("notifications", { ...args, read: false, createdAt: Date.now() });
  },
});

/** Seed a welcome notification on first use (idempotent per user). */
export const ensureWelcome = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("UNAUTHENTICATED");
    const existing = await ctx.db
      .query("notifications")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    if (existing) return;
    await ctx.db.insert("notifications", {
      userId,
      title: "أهلاً بك في منصة القانون المصري",
      body: "اسأل عن حقك، وابحث في المصادر الرسمية، وتابع قضيتك خطوة بخطوة. كل إجابة مبنية على مصادر منشورة وقابلة للعرض.",
      kind: "system",
      read: false,
      createdAt: Date.now(),
    });
  },
});
