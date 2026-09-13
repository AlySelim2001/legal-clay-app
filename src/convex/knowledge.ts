import { internalMutation, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

/** Insert an audit entry. Content is never stored — ids/codes/enums only. */
export const insertAudit = internalMutation({
  args: {
    action: v.string(),
    userId: v.optional(v.id("users")),
    targetType: v.optional(v.string()),
    targetId: v.optional(v.string()),
    details: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("auditLogs", { ...args, createdAt: Date.now() });
  },
});

/** Consume one unit from a fixed-window rate limit bucket. */
export const consumeRateLimit = internalMutation({
  args: { key: v.string(), limit: v.number(), windowMs: v.number() },
  handler: async (ctx, { key, limit, windowMs }) => {
    const now = Date.now();
    const bucket = await ctx.db
      .query("rateLimits")
      .withIndex("by_key", (q) => q.eq("key", key))
      .unique();
    if (!bucket || now - bucket.windowStart > windowMs) {
      if (bucket) await ctx.db.delete(bucket._id);
      await ctx.db.insert("rateLimits", { key, windowStart: now, count: 1 });
      return true;
    }
    if (bucket.count >= limit) return false;
    await ctx.db.patch(bucket._id, { count: bucket.count + 1 });
    return true;
  },
});

/** Who is asking? Returns userId or null (anonymous exploration allowed). */
export const currentUserId = query({
  args: {},
  handler: async (ctx) => {
    return await getAuthUserId(ctx);
  },
});

/**
 * Public bootstrap: idempotently ingest the curated seed knowledge and
 * evaluation suite. Guarded by a systemSettings flag so it runs once.
 *
 * NOTE ON THE REVIEW WORKFLOW: this seed is a human-curated import shipped
 * with the repository (figures cross-checked against the audited deadline
 * engine in android/). It lands at PUBLISHED/VERIFIED with an explicit
 * provenance note. Any source added later through the admin UI enters the
 * full DISCOVERED→…→PUBLISHED workflow and requires human approval — the
 * AI never publishes legal authority autonomously.
 */
export const seedKnowledge = mutation({
  args: {},
  handler: async (ctx) => {
    const flag = await ctx.db
      .query("systemSettings")
      .withIndex("by_key", (q) => q.eq("key", "seed_v1"))
      .unique();
    if (flag) return { seeded: false as const };

    const { SEED_SOURCES, SEED_ARTICLES, SEED_AUTHORITIES, SEED_PROCEDURES, SEED_RIGHTS, SEED_EVAL_CASES } =
      await import("./lib/seed_knowledge");
    const { embed, tokenize, normalizeArabic, contentFingerprint } = await import("./lib/text");

    const now = Date.now();
    const PROVENANCE = "استيراد مُرحَّل (seed-curated) — بيانات مُراجعة مرفقة مع المستودع";

    // ---- Sources ----
    const sourceIds = new Map<string, typeof SEED_SOURCES[number]["key"] & string>();
    const idByKey = new Map<string, string>();
    for (const s of SEED_SOURCES) {
      const id = await ctx.db.insert("legalSources", {
        title: s.title,
        sourceType: s.sourceType,
        publisher: s.publisher,
        officialUrl: s.officialUrl,
        language: "ar",
        jurisdiction: "EG",
        publicationDate: s.publicationDate ? Date.parse(s.publicationDate) : undefined,
        version: s.version,
        status: "PUBLISHED",
        verificationStatus: "VERIFIED",
        reviewNotes: PROVENANCE,
        contentHash: contentFingerprint(s.title + s.version),
        retrievedAt: now,
        createdAt: now,
        updatedAt: now,
      });
      idByKey.set(s.key, id);
    }

    // ---- Articles + chunks ----
    let articleCount = 0;
    let chunkCount = 0;
    for (const a of SEED_ARTICLES) {
      const sourceId = idByKey.get(a.sourceKey);
      if (!sourceId) continue;
      const source = (await ctx.db.get(sourceId))!;
      const articleId = await ctx.db.insert("legalArticles", {
        sourceId,
        number: a.number,
        title: a.title,
        body: a.body,
        category: a.category,
        validity: "CURRENT",
        status: "PUBLISHED",
        verificationStatus: "VERIFIED",
        createdAt: now,
        updatedAt: now,
      });
      articleCount++;
      const text = `المادة ${a.number} — ${a.title}. ${a.body}${a.deadline ? ` المدّة: ${a.deadline}.` : ""}`;
      await ctx.db.insert("documentChunks", {
        refType: "legalArticles",
        refId: sourceId,
        articleId,
        text,
        tokens: tokenize(text),
        embedding: embed(text),
        provenance: `المادة ${a.number}${a.deadline ? " — المدة القانونية" : ""}`,
        validity: "CURRENT",
        status: "PUBLISHED",
        verificationStatus: "VERIFIED",
        createdAt: now,
      });
      chunkCount++;
      void source;
    }

    // ---- Authorities + services ----
    const authorityIdByKey = new Map<string, string>();
    for (const au of SEED_AUTHORITIES) {
      const authorityId = await ctx.db.insert("authorities", {
        name: au.name,
        authorityType: au.authorityType,
        jurisdiction: au.jurisdiction,
        website: au.website,
        verificationStatus: "VERIFIED",
        lastVerifiedAt: now,
        sourceId: idByKey.get("pp-portal"),
        createdAt: now,
        updatedAt: now,
      });
      authorityIdByKey.set(au.key, authorityId);
      for (const svc of au.services) {
        await ctx.db.insert("authorityServices", {
          authorityId,
          name: svc.name,
          description: svc.description,
          officialUrl: svc.officialUrl,
          steps: svc.steps,
          verificationStatus: "VERIFIED",
          createdAt: now,
        });
      }
    }

    // ---- Procedure guides ----
    for (const p of SEED_PROCEDURES) {
      const sourceId = idByKey.get(p.sourceKey);
      if (!sourceId) continue;
      await ctx.db.insert("procedureGuides", {
        slug: p.slug,
        title: p.title,
        keywords: p.keywords.map((k) => normalizeArabic(k)),
        summary: p.summary,
        steps: p.steps,
        documentsNeeded: p.documentsNeeded,
        authorityIds: p.authorityKeys
          .map((k) => authorityIdByKey.get(k))
          .filter((x): x is string => Boolean(x)),
        warnings: p.warnings,
        sourceId,
        status: "PUBLISHED",
        verificationStatus: "VERIFIED",
        createdAt: now,
        updatedAt: now,
      });
    }

    // ---- Rights topics ----
    for (const r of SEED_RIGHTS) {
      const sourceId = idByKey.get(r.sourceKey);
      if (!sourceId) continue;
      const chunkIds: string[] = [];
      for (const point of r.points) {
        const chunkId = await ctx.db.insert("documentChunks", {
          refType: "legalSources",
          refId: sourceId,
          text: point,
          tokens: tokenize(point),
          embedding: embed(point),
          provenance: r.title,
          validity: "CURRENT",
          status: "PUBLISHED",
          verificationStatus: "VERIFIED",
          createdAt: now,
        });
        chunkIds.push(chunkId);
        chunkCount++;
      }
      await ctx.db.insert("rightsTopics", {
        slug: r.slug,
        title: r.title,
        category: r.category,
        keywords: r.keywords.map((k) => normalizeArabic(k)),
        summary: r.summary,
        points: r.points.map((text, i) => ({ text, chunkIds: [chunkIds[i]!] })),
        sourceId,
        status: "PUBLISHED",
        verificationStatus: "VERIFIED",
        createdAt: now,
        updatedAt: now,
      });
    }

    // ---- Evaluation suite ----
    for (const e of SEED_EVAL_CASES) {
      await ctx.db.insert("evaluationCases", {
        code: e.code,
        question: e.question,
        domain: e.domain,
        expectedEvidenceStatus: e.expectedEvidenceStatus,
        expectAbstain: e.expectAbstain,
        expectedSourceTitle: e.expectedSourceTitle,
        notes: e.notes,
        createdAt: now,
      });
    }

    // ---- Knowledge version ----
    await ctx.db.insert("knowledgeVersions", {
      version: "kb-2026.09-seed1",
      active: true,
      sourceCount: SEED_SOURCES.length,
      articleCount,
      chunkCount,
      approvedAt: now,
      createdAt: now,
    });
    await ctx.db.insert("systemSettings", {
      key: "seed_v1",
      value: now.toString(),
      updatedAt: now,
    });

    void sourceIds;
    return { seeded: true as const, sources: SEED_SOURCES.length, articles: articleCount, chunks: chunkCount };
  },
});

/** Knowledge-base status for the home screen + admin dashboard. */
export const knowledgeStatus = query({
  args: {},
  handler: async (ctx) => {
    const active = await ctx.db
      .query("knowledgeVersions")
      .withIndex("by_active", (q) => q.eq("active", true))
      .unique();
    const sources = await ctx.db.query("legalSources").collect();
    const pending = sources.filter(
      (s) => s.status === "REVIEW_PENDING" || s.status === "APPROVED",
    ).length;
    const published = sources.filter((s) => s.status === "PUBLISHED").length;
    return {
      activeVersion: active?.version ?? null,
      chunkCount: active?.chunkCount ?? 0,
      articleCount: active?.articleCount ?? 0,
      sourceCount: active?.sourceCount ?? 0,
      pendingReviews: pending,
      publishedSources: published,
      updatedAt: active?.createdAt ?? null,
    };
  },
});
