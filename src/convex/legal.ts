import { action, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";
import {
  runEvidencePipeline,
  RETRIEVAL_VERSION,
  PIPELINE_NAME,
  type IndexedChunk,
  type PipelineResult,
} from "./lib/evidence";

/** Build the retrieval index from published chunks only. */
export const publishedIndex = internalQuery({
  args: {},
  handler: async (ctx): Promise<IndexedChunk[]> => {
    const chunks = await ctx.db
      .query("documentChunks")
      .withIndex("by_status", (q) => q.eq("status", "PUBLISHED"))
      .collect();
    const index: IndexedChunk[] = [];
    for (const c of chunks) {
      const source = await ctx.db.get(c.refId);
      if (!source) continue;
      index.push({
        _id: c._id,
        refType: c.refType,
        refId: c.refId,
        articleId: c.articleId,
        text: c.text,
        tokens: c.tokens,
        embedding: c.embedding,
        provenance: c.provenance,
        text: source.body ?? c.provenance,
        validity: c.validity,
        effectiveFrom: c.effectiveFrom,
        effectiveTo: c.effectiveTo,
        verificationStatus: c.verificationStatus,
        status: c.status,
        sourceTitle: source.title ?? source.name ?? "",
        sourceType: source.sourceType ?? "unknown",
        officialUrl: source.officialUrl,
      });
    }
    return index;
  },
});

/** The full pipeline in one action — compose answer from evidence only. */
export const askLegal = action({
  args: {
    question: v.string(),
    queryDate: v.optional(v.number()),
    eventDate: v.optional(v.number()),
    caseId: v.optional(v.id("cases")),
  },
  handler: async (ctx, args): Promise<PipelineResult & { answerId?: string }> => {
    const userId = await getAuthUserId(ctx);
    const question = args.question.trim().slice(0, 2000);
    if (question.length < 5) {
      throw new Error("QUESTION_TOO_SHORT");
    }

    // Rate limit: 20 questions / 5 min per user (T-019, T-020)
    const rlKey = `ask:${userId ?? "anon"}`;
    const allowed = await ctx.runMutation(internal.knowledge.consumeRateLimit, {
      key: rlKey,
      limit: 20,
      windowMs: 5 * 60 * 1000,
    });
    if (!allowed) throw new Error("RATE_LIMITED");

    const index = await ctx.runQuery(internal.legal.publishedIndex, {});
    const queryDate = args.queryDate ?? Date.now();
    const result = runEvidencePipeline(question, index, {
      queryDate,
      eventDate: args.eventDate,
    });

    const answerId = await ctx.runMutation(internal.legal.saveAnswer, {
      userId: userId ?? undefined,
      question,
      queryType: result.queryType,
      answer: result.answer,
      claims: result.claims.map((c) => ({
        text: c.text,
        status: c.status,
        chunkIds: c.chunkIds,
      })),
      evidenceStatus: result.evidenceStatus,
      warnings: result.warnings,
      confidence: result.confidence,
      queryDate,
    });

    return { ...result, answerId };
  },
});

/** Persist an answer + citations, and record the audit trail. */
export const saveAnswer = internalMutation({
  args: {
    userId: v.optional(v.id("users")),
    question: v.string(),
    queryType: v.string(),
    answer: v.string(),
    claims: v.array(
      v.object({
        text: v.string(),
        status: v.string(),
        chunkIds: v.array(v.id("documentChunks")),
      }),
    ),
    evidenceStatus: v.string(),
    warnings: v.array(v.string()),
    confidence: v.object({
      retrievalQuality: v.number(),
      evidenceQuality: v.number(),
      citationQuality: v.number(),
      temporalValidity: v.number(),
      answerSupport: v.number(),
      overall: v.number(),
    }),
    queryDate: v.number(),
  },
  handler: async (ctx, args) => {
    const answerId = await ctx.db.insert("answers", {
      ...args,
      queryType: args.queryType as any,
      evidenceStatus: args.evidenceStatus as any,
      claims: args.claims.map((c) => ({
        text: c.text,
        status: c.status as any,
        chunkIds: c.chunkIds,
      })),
      knowledgeVersion: "kb-2026.09-seed1",
      retrievalVersion: RETRIEVAL_VERSION,
      modelName: PIPELINE_MODEL_NAME,
      createdAt: Date.now(),
    });
    for (const [i, claim] of args.claims.entries()) {
      for (const chunkId of claim.chunkIds) {
        await ctx.db.insert("citations", {
          answerId,
          refId: chunkId,
          claimIndex: i,
          status: claim.status as any,
          excerpt: claim.text.slice(0, 300),
          createdAt: Date.now(),
        });
      }
    }
    await ctx.runMutation(internal.knowledge.insertAudit, {
      action: "ai_query",
      userId: args.userId,
      targetType: "answer",
      targetId: answerId,
      details: `type=${args.queryType} status=${args.evidenceStatus}`,
    });
    return answerId;
  },
});

const PIPELINE_MODEL_NAME = `deterministic-evidence-composer (no LLM in the answer path) — ${PIPELINE_NAME}`;

/** History of the signed-in user's questions. */
export const answerHistory = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    return await ctx.db
      .query("answers")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(args.limit ?? 30);
  },
});

/** One answer with its citations joined to source metadata. */
export const answerWithCitations = query({
  args: { answerId: v.id("answers") },
  handler: async (ctx, args) => {
    const answer = await ctx.db.get(args.answerId);
    if (!answer) return null;
    const cites = await ctx.db
      .query("citations")
      .withIndex("by_answer", (q) => q.eq("answerId", args.answerId))
      .collect();
    const enriched = [];
    for (const c of cites) {
      const chunk = await ctx.db.get(c.refId);
      const source = chunk ? await ctx.db.get(chunk.refId) : null;
      enriched.push({
        claimIndex: c.claimIndex,
        status: c.status,
        excerpt: c.excerpt,
        provenance: chunk?.provenance ?? "",
        sourceTitle: source?.title ?? "",
        sourceType: source?.sourceType ?? "",
        officialUrl: source?.officialUrl,
        version: source?.version,
        effectiveFrom: source?.effectiveFrom,
        effectiveTo: source?.effectiveTo,
        verificationStatus: source?.verificationStatus ?? "UNREVIEWED",
      });
    }
    return { answer, citations: enriched };
  },
});

/** Public legal search over published chunks (always evidence-backed). */
export const searchLegal = action({
  args: { q: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await ctx.runMutation(internal.knowledge.consumeRateLimit, {
      key: `search:${(await getAuthUserId(ctx)) ?? "anon"}`,
      limit: 60,
      windowMs: 60 * 1000,
    });
    const index = await ctx.runQuery(internal.legal.publishedIndex, {});
    const { retrieveEvidence, MIN_BEST_SCORE } = await import("./lib/evidence");
    const pack = retrieveEvidence(args.q.trim().slice(0, 300), index, {
      queryDate: Date.now(),
      topK: args.limit ?? 10,
    });
    return {
      results: pack.chunks.map((c) => ({
        chunkId: c.chunkId,
        sourceTitle: c.sourceTitle,
        sourceType: c.sourceType,
        officialUrl: c.officialUrl,
        provenance: c.provenance,
        text: c.text.slice(0, 400),
        validity: c.validity,
        verificationStatus: c.verificationStatus,
        score: Math.round(c.score * 1000) / 1000,
      })),
      bestScore: pack.bestScore,
      sufficient: pack.bestScore >= MIN_BEST_SCORE,
    };
  },
});

/** Sources registry (published + review states visible to all, fields trimmed). */
export const listSources = query({
  args: { status: v.optional(v.string()), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const sources = args.status
      ? await ctx.db
          .query("legalSources")
          .withIndex("by_status", (q) => q.eq("status", args.status as never))
          .take(args.limit ?? 100)
      : await ctx.db.query("legalSources").take(args.limit ?? 100);
    return sources.map((s) => ({
      _id: s._id,
      title: s.title,
      sourceType: s.sourceType,
      publisher: s.publisher,
      officialUrl: s.officialUrl,
      version: s.version,
      status: s.status,
      verificationStatus: s.verificationStatus,
      effectiveFrom: s.effectiveFrom,
      effectiveTo: s.effectiveTo,
      retrievedAt: s.retrievedAt,
      reviewNotes: s.reviewNotes,
    }));
  },
});

/** One source with its articles. */
export const sourceDetail = query({
  args: { id: v.id("legalSources") },
  handler: async (ctx, args) => {
    const source = await ctx.db.get(args.id);
    if (!source) return null;
    const articles = await ctx.db
      .query("legalArticles")
      .withIndex("by_source", (q) => q.eq("sourceId", args.id))
      .collect();
    return { source, articles };
  },
});

/** Authority directory with services. */
export const listAuthorities = query({
  args: {},
  handler: async (ctx) => {
    const authorities = await ctx.db.query("authorities").collect();
    const out = [];
    for (const a of authorities) {
      const services = await ctx.db
        .query("authorityServices")
        .withIndex("by_authority", (q) => q.eq("authorityId", a._id))
        .collect();
      out.push({ ...a, services });
    }
    return out;
  },
});

/** Procedure guides ("ماذا أفعل الآن؟" / "تروح فين؟"). */
export const listProcedures = query({
  args: {},
  handler: async (ctx) => {
    const guides = await ctx.db
      .query("procedureGuides")
      .withIndex("by_status", (q) => q.eq("status", "PUBLISHED"))
      .collect();
    const out = [];
    for (const g of guides) {
      const authorities = [];
      for (const aid of g.authorityIds) {
        const a = await ctx.db.get(aid);
        if (a) authorities.push({ _id: a._id, name: a.name, website: a.website });
      }
      out.push({ ...g, authorities });
    }
    return out;
  },
});

/** Rights & duties topics ("اعرف حقك وواجباتك"). */
export const listRights = query({
  args: { category: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const topics = args.category
      ? await ctx.db
          .query("rightsTopics")
          .withIndex("by_category", (q) => q.eq("category", args.category as never))
          .collect()
      : await ctx.db.query("rightsTopics").collect();
    return topics.filter((t) => t.status === "PUBLISHED");
  },
});

// (imports at top of file)
