import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";

// ============================================================
// Role model — maps the auth template's users.role onto platform roles
// ============================================================

type PlatformRole = "user" | "researcher" | "reviewer" | "admin" | "super_admin";

const REVIEWER_ROLES: PlatformRole[] = ["reviewer", "admin", "super_admin"];

export const getPlatformRole = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args): Promise<string> => {
    const user = await ctx.db.get(args.userId);
    const raw = (user?.role as string | undefined) ?? "user";
    if (raw === "admin") return "admin";
    if (raw === "member") return "reviewer";
    return REVIEWER_ROLES.includes(raw as PlatformRole) ? raw : "user";
  },
});

/**
 * Reviewer gate for read-only queries. Convex queries cannot write, so
 * permission_denied events for admin reads are surfaced by throwing — the
 * client shows a role error, and mutations log the denial properly.
 */
async function requireReviewerQuery(
  ctx: { db: unknown; auth: unknown },
): Promise<string> {
  const userId = await getAuthUserId(ctx as never);
  if (!userId) throw new Error("UNAUTHENTICATED");
  const user = await (ctx.db as { get: (id: string) => Promise<{ role?: string } | null> }).get(
    userId,
  );
  const raw = (user?.role as string | undefined) ?? "user";
  const role: PlatformRole =
    raw === "member" ? "reviewer" : (raw as PlatformRole);
  if (!REVIEWER_ROLES.includes(role)) throw new Error("FORBIDDEN");
  return userId;
}

/** Reviewer gate for mutations — logs the denial to the audit trail. */
async function requireReviewerMutation(
  ctx: {
    db: { get(id: string): Promise<{ role?: string } | null> };
    runMutation: (ref: typeof internal.knowledge.insertAudit, args_: unknown) => Promise<unknown>;
  },
  actionName: string,
): Promise<string> {
  const userId = await getAuthUserId(ctx as never);
  if (!userId) throw new Error("UNAUTHENTICATED");
  const user = await ctx.db.get(userId);
  const raw = (user?.role as string | undefined) ?? "user";
  const role: PlatformRole = raw === "member" ? "reviewer" : (raw as PlatformRole);
  if (!REVIEWER_ROLES.includes(role)) {
    await ctx.runMutation(internal.knowledge.insertAudit, {
      action: "permission_denied",
      userId,
      details: `role=${role} action=${actionName}`,
    });
    throw new Error("FORBIDDEN");
  }
  return userId;
}

// ============================================================
// Source registry — human review workflow (never AI-published)
// ============================================================

export const adminListSources = query({
  args: { status: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireReviewerQuery(ctx);
    return args.status
      ? await ctx.db
          .query("legalSources")
          .withIndex("by_status", (q) => q.eq("status", args.status as never))
          .collect()
      : await ctx.db.query("legalSources").collect();
  },
});

export const submitSource = mutation({
  args: {
    title: v.string(),
    sourceType: v.string(),
    publisher: v.optional(v.string()),
    officialUrl: v.optional(v.string()),
    version: v.string(),
    effectiveFrom: v.optional(v.number()),
    effectiveTo: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("UNAUTHENTICATED");
    // Any authenticated user may submit; only reviewers approve/publish.
    const now = Date.now();
    const sourceId = await ctx.db.insert("legalSources", {
      title: args.title.trim().slice(0, 300),
      sourceType: args.sourceType,
      publisher: args.publisher?.trim().slice(0, 200),
      officialUrl: args.officialUrl?.trim(),
      language: "ar",
      jurisdiction: "EG",
      version: args.version.trim().slice(0, 60),
      effectiveFrom: args.effectiveFrom,
      effectiveTo: args.effectiveTo,
      status: "REVIEW_PENDING",
      verificationStatus: "UNREVIEWED",
      retrievedAt: now,
      createdAt: now,
      updatedAt: now,
    });
    await ctx.runMutation(internal.knowledge.insertAudit, {
      action: "source_created",
      userId,
      targetType: "legalSource",
      targetId: sourceId,
      details: `status=REVIEW_PENDING type=${args.sourceType}`,
    });
    return sourceId;
  },
});

export const reviewSource = mutation({
  args: {
    sourceId: v.id("legalSources"),
    decision: v.union(v.literal("approve"), v.literal("reject")),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const reviewerId = await requireReviewerMutation(ctx, "review_source");
    const source = await ctx.db.get(args.sourceId);
    if (!source) throw new Error("NOT_FOUND");
    if (source.status !== "REVIEW_PENDING") throw new Error("INVALID_STATE");

    const now = Date.now();
    await ctx.db.patch(args.sourceId, {
      status: args.decision === "approve" ? "APPROVED" : "REJECTED",
      verificationStatus: args.decision === "approve" ? "VERIFIED" : "DISPUTED",
      reviewerId,
      reviewedAt: now,
      reviewNotes: args.notes?.slice(0, 1000),
      updatedAt: now,
    });
    await ctx.runMutation(internal.knowledge.insertAudit, {
      action: args.decision === "approve" ? "source_approved" : "source_rejected",
      userId: reviewerId,
      targetType: "legalSource",
      targetId: args.sourceId,
      details: args.notes ? "notes_present" : undefined,
    });
    await ctx.runMutation(internal.workspace.pushNotificationInternal, {
      userId: reviewerId,
      title: args.decision === "approve" ? "تمت الموافقة على مصدر" : "تم رفض مصدر",
      body:
        args.decision === "approve"
          ? "المصدر مؤهل الآن للنشر عبر إجراء النشر."
          : "لم يُنشر المصدر ويمكن تعديله وإعادة إرساله للمراجعة.",
      kind: "review",
    });
  },
});

export const publishSource = mutation({
  args: { sourceId: v.id("legalSources"), unpublish: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    const reviewerId = await requireReviewerMutation(ctx, "publish_source");
    const source = await ctx.db.get(args.sourceId);
    if (!source) throw new Error("NOT_FOUND");
    const now = Date.now();
    if (args.unpublish) {
      await ctx.db.patch(args.sourceId, { status: "APPROVED", updatedAt: now });
    } else {
      if (source.status !== "APPROVED") throw new Error("MUST_BE_APPROVED_FIRST");
      await ctx.db.patch(args.sourceId, {
        status: "PUBLISHED",
        verifiedAt: now,
        updatedAt: now,
      });
    }
    await ctx.runMutation(internal.knowledge.insertAudit, {
      action: args.unpublish ? "source_unpublished" : "source_published",
      userId: reviewerId,
      targetType: "legalSource",
      targetId: args.sourceId,
    });
  },
});

// ============================================================
// Audit log viewer
// ============================================================

export const adminAuditLogs = query({
  args: { limit: v.optional(v.number()), action: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireReviewerQuery(ctx);
    return args.action
      ? await ctx.db
          .query("auditLogs")
          .withIndex("by_action", (q) => q.eq("action", args.action as never))
          .order("desc")
          .take(args.limit ?? 100)
      : await ctx.db.query("auditLogs").order("desc").take(args.limit ?? 100);
  },
});

// ============================================================
// Evaluation runner — TEST-001..010 against the live pipeline
// ============================================================

const ABSTAIN =
  "لا تتوفر أدلة قانونية موثوقة وكافية في قاعدة المعرفة الحالية لإصدار إجابة مؤكدة.";

export const runEvaluation = action({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("UNAUTHENTICATED");
    const role = await ctx.runQuery(internal.admin.getPlatformRole, { userId });
    if (!REVIEWER_ROLES.includes(role as PlatformRole)) {
      await ctx.runMutation(internal.knowledge.insertAudit, {
        action: "permission_denied",
        userId,
        details: `run_evaluation role=${role}`,
      });
      throw new Error("FORBIDDEN");
    }

    const { runEvidencePipeline } = await import("./lib/evidence");
    const index = await ctx.runQuery(internal.legal.publishedIndex, {});
    const cases = await ctx.runQuery(internal.admin.getEvalCases, {});
    const results: Array<{
      code: string;
      passed: boolean;
      expected: string;
      actual: string;
      note?: string;
    }> = [];

    for (const tc of cases) {
      const result = runEvidencePipeline(tc.question, index, { queryDate: Date.now() });
      let passed: boolean;
      if (tc.expectAbstain) {
        passed =
          result.evidenceStatus === "INSUFFICIENT_EVIDENCE" &&
          result.answer === ABSTAIN &&
          result.claims.length === 0;
      } else if (tc.code === "TEST-005") {
        // No false conflict: both deadlines are 10 days — must NOT flag CONFLICTING.
        passed = result.evidenceStatus !== "CONFLICTING";
      } else if (tc.code === "TEST-010") {
        // Historical phrasing: honest treatment — outdated flag, abstention,
        // or an explicit temporal warning.
        passed =
          result.evidenceStatus === "OUTDATED" ||
          result.evidenceStatus === "INSUFFICIENT_EVIDENCE" ||
          result.warnings.some((w) => w.includes("تاريخية") || w.includes("غير محددة"));
      } else {
        passed = result.evidenceStatus === tc.expectedEvidenceStatus;
      }
      results.push({
        code: tc.code,
        passed,
        expected: tc.expectAbstain ? "abstain" : tc.expectedEvidenceStatus,
        actual: `${result.evidenceStatus}${result.answer === ABSTAIN ? " (abstain)" : ""}`,
        note: tc.notes,
      });
    }

    const passedCount = results.filter((r) => r.passed).length;
    const failed = results.length - passedCount;
    await ctx.runMutation(internal.admin.saveEvaluationRun, {
      knowledgeVersion: "kb-2026.09-seed1",
      total: results.length,
      passed: passedCount,
      failed,
      results,
    });
    return { total: results.length, passed: passedCount, failed, results };
  },
});

export const getEvalCases = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("evaluationCases").collect();
  },
});

export const saveEvaluationRun = internalMutation({
  args: {
    knowledgeVersion: v.string(),
    total: v.number(),
    passed: v.number(),
    failed: v.number(),
    results: v.array(
      v.object({
        code: v.string(),
        passed: v.boolean(),
        expected: v.string(),
        actual: v.string(),
        note: v.optional(v.string()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("evaluationRuns", { ...args, createdAt: Date.now() });
  },
});

export const latestEvaluationRuns = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await requireReviewerQuery(ctx);
    return await ctx.db.query("evaluationRuns").order("desc").take(args.limit ?? 10);
  },
});

// ============================================================
// System health + knowledge versions
// ============================================================

export const systemHealth = query({
  args: {},
  handler: async (ctx) => {
    await requireReviewerQuery(ctx);
    const [sources, chunks, answers, audits, runs] = await Promise.all([
      ctx.db.query("legalSources").collect(),
      ctx.db.query("documentChunks").collect(),
      ctx.db.query("answers").collect(),
      ctx.db.query("auditLogs").order("desc").take(50),
      ctx.db.query("evaluationRuns").order("desc").take(1),
    ]);
    const published = sources.filter((s) => s.status === "PUBLISHED").length;
    const pending = sources.filter((s) => s.status === "REVIEW_PENDING").length;
    const lastRun = runs[0] ?? null;
    return {
      knowledge: { publishedSources: published, pendingReviews: pending, chunks: chunks.length },
      activity: { answersStored: answers.length, recentAuditCount: audits.length },
      evaluation: lastRun
        ? { at: lastRun.createdAt, passed: lastRun.passed, total: lastRun.total }
        : null,
    };
  },
});

export const knowledgeVersionsList = query({
  args: {},
  handler: async (ctx) => {
    await requireReviewerQuery(ctx);
    return await ctx.db.query("knowledgeVersions").order("desc").collect();
  },
});
