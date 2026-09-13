import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { Infer, v } from "convex/values";

// default user roles. can add / remove based on the project as needed
export const ROLES = {
  ADMIN: "admin",
  USER: "user",
  MEMBER: "member",
} as const;

export const roleValidator = v.union(
  v.literal(ROLES.ADMIN),
  v.literal(ROLES.USER),
  v.literal(ROLES.MEMBER),
);
export type Role = Infer<typeof roleValidator>;

// ============================================================
// Evidence-First Legal Knowledge Platform — domain types
// ============================================================

/** Source registry workflow: DISCOVERED → … → PUBLISHED → ARCHIVED */
export const SOURCE_STATUSES = [
  "DISCOVERED",
  "IMPORTED",
  "PARSED",
  "VALIDATED",
  "REVIEW_PENDING",
  "APPROVED",
  "PUBLISHED",
  "SUPERSEDED",
  "ARCHIVED",
  "REJECTED",
] as const;
export const sourceStatusValidator = v.union(
  ...SOURCE_STATUSES.map((s) => v.literal(s)),
);

/** Temporal validity of a legal document/article version. */
export const VALIDITY_STATUSES = [
  "CURRENT",
  "HISTORICAL",
  "FUTURE",
  "SUPERSEDED",
  "UNKNOWN",
] as const;
export const validityValidator = v.union(
  ...VALIDITY_STATUSES.map((s) => v.literal(s)),
);

export const VERIFICATION_STATUSES = [
  "VERIFIED",
  "UNREVIEWED",
  "DISPUTED",
] as const;
export const verificationValidator = v.union(
  ...VERIFICATION_STATUSES.map((s) => v.literal(s)),
);

/** Evidence pack status used by the answer pipeline. */
export const EVIDENCE_STATUSES = [
  "SUPPORTED",
  "PARTIALLY_SUPPORTED",
  "INSUFFICIENT_EVIDENCE",
  "CONFLICTING",
  "OUTDATED",
  "UNVERIFIED",
] as const;
export const evidenceStatusValidator = v.union(
  ...EVIDENCE_STATUSES.map((s) => v.literal(s)),
);

/** Query classifier output — processing strategy only, never guilt. */
export const QUERY_TYPES = [
  "LEGAL_DEFINITION",
  "LEGAL_ARTICLE",
  "PROCEDURE",
  "AUTHORITY",
  "DOCUMENT",
  "COMPARISON",
  "EDUCATION",
  "GENERAL",
  "HIGH_RISK",
  "TEMPORAL",
  "CONFLICTING",
  "INSUFFICIENT_EVIDENCE",
] as const;
export const queryTypeValidator = v.union(
  ...QUERY_TYPES.map((t) => v.literal(t)),
);

const effectiveRange = {
  effectiveFrom: v.optional(v.number()), // epoch ms
  effectiveTo: v.optional(v.number()), // epoch ms — absent while in force
};

export const legalSources = defineTable({
  title: v.string(),
  /** statute | regulation | constitution | precedent | official_guidance */
  sourceType: v.string(),
  publisher: v.optional(v.string()),
  officialUrl: v.optional(v.string()),
  language: v.string(),
  jurisdiction: v.string(),
  publicationDate: v.optional(v.number()),
  ...effectiveRange,
  version: v.string(),
  status: sourceStatusValidator,
  verificationStatus: verificationValidator,
  reviewerId: v.optional(v.id("users")),
  reviewedAt: v.optional(v.number()),
  reviewNotes: v.optional(v.string()),
  contentHash: v.optional(v.string()),
  retrievedAt: v.optional(v.number()),
  verifiedAt: v.optional(v.number()),
  lastCheckedAt: v.optional(v.number()),
  supersedes: v.optional(v.id("legalSources")),
  supersededBy: v.optional(v.id("legalSources")),
  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_status", ["status", "createdAt"])
  .index("by_verification", ["verificationStatus"]);

export const legalArticles = defineTable({
  sourceId: v.id("legalSources"),
  number: v.string(),
  title: v.string(),
  body: v.string(),
  /** Category key from legalCategories. */
  category: v.optional(v.string()),
  ...effectiveRange,
  validity: validityValidator,
  status: sourceStatusValidator,
  verificationStatus: verificationValidator,
  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_source", ["sourceId"])
  .index("by_status", ["status"])
  .index("by_category", ["category"]);

export const documentChunks = defineTable({
  /** legalArticles | legalSources | userDocuments */
  refType: v.string(),
  refId: v.id("legalSources"),
  articleId: v.optional(v.id("legalArticles")),
  /** Lexical index: normalized token set kept small for filtering. */
  tokens: v.array(v.string()),
  /** 256-dim normalized embedding (hashing embedder; vectorIndex-ready). */
  embedding: v.array(v.number()),
  /** Verbatim chunk text — the retrieval index serves this, never generated. */
  text: v.string(),
  provenance: v.string(), // e.g. "المادة 215 — فقرة 2"
  ...effectiveRange,
  validity: validityValidator,
  status: sourceStatusValidator,
  verificationStatus: verificationValidator,
  createdAt: v.number(),
})
  .index("by_ref", ["refId"])
  .index("by_status", ["status"])
  .index("by_validity", ["validity"]);

export const citations = defineTable({
  answerId: v.id("answers"),
  /** Reference into the retrieval pipeline output; application-generated. */
  refId: v.id("documentChunks"),
  claimIndex: v.number(),
  status: evidenceStatusValidator,
  excerpt: v.string(),
  createdAt: v.number(),
}).index("by_answer", ["answerId"]);

export const answers = defineTable({
  userId: v.optional(v.id("users")),
  question: v.string(),
  queryType: queryTypeValidator,
  answer: v.string(),
  claims: v.array(
    v.object({
      text: v.string(),
      status: evidenceStatusValidator,
      chunkIds: v.array(v.id("documentChunks")),
    }),
  ),
  evidenceStatus: evidenceStatusValidator,
  warnings: v.array(v.string()),
  confidence: v.object({
    retrievalQuality: v.number(),
    evidenceQuality: v.number(),
    citationQuality: v.number(),
    temporalValidity: v.number(),
    answerSupport: v.number(),
    overall: v.number(),
  }),
  knowledgeVersion: v.string(),
  retrievalVersion: v.string(),
  modelName: v.string(),
  queryDate: v.number(),
  createdAt: v.number(),
})
  .index("by_user", ["userId", "createdAt"])
  .index("by_created", ["createdAt"]);

export const knowledgeVersions = defineTable({
  version: v.string(),
  /** Published is the only version the Q&A pipeline serves. */
  active: v.boolean(),
  sourceCount: v.number(),
  articleCount: v.number(),
  chunkCount: v.number(),
  approvedBy: v.optional(v.id("users")),
  approvedAt: v.optional(v.number()),
  createdAt: v.number(),
}).index("by_active", ["active"]);

export const authorities = defineTable({
  name: v.string(),
  /** prosecution | police | court | ministry | notary | digital_portal */
  authorityType: v.string(),
  jurisdiction: v.optional(v.string()),
  address: v.optional(v.string()),
  phone: v.optional(v.string()),
  website: v.optional(v.string()),
  workingHours: v.optional(v.string()),
  lat: v.optional(v.number()),
  lng: v.optional(v.number()),
  sourceId: v.optional(v.id("legalSources")),
  verificationStatus: verificationValidator,
  lastVerifiedAt: v.optional(v.number()),
  createdAt: v.number(),
  updatedAt: v.number(),
}).index("by_type", ["authorityType"]);

export const authorityServices = defineTable({
  authorityId: v.id("authorities"),
  name: v.string(),
  description: v.optional(v.string()),
  officialUrl: v.optional(v.string()),
  /** Free-text path steps in Arabic — must mirror a verified source. */
  steps: v.array(v.string()),
  sourceId: v.optional(v.id("legalSources")),
  verificationStatus: verificationValidator,
  createdAt: v.number(),
}).index("by_authority", ["authorityId"]);

export const procedureGuides = defineTable({
  slug: v.string(),
  title: v.string(),
  /** Matching keywords (normalized) that route a question here. */
  keywords: v.array(v.string()),
  /** Ammiya summary shown first. */
  summary: v.string(),
  steps: v.array(v.string()),
  documentsNeeded: v.array(v.string()),
  authorityIds: v.array(v.id("authorities")),
  warnings: v.array(v.string()),
  sourceId: v.id("legalSources"),
  status: sourceStatusValidator,
  verificationStatus: verificationValidator,
  createdAt: v.number(),
  updatedAt: v.number(),
}).index("by_status", ["status"]);

export const rightsTopics = defineTable({
  slug: v.string(),
  title: v.string(),
  category: v.string(),
  keywords: v.array(v.string()),
  summary: v.string(),
  /** Each right/duty grounded in one or more published chunks. */
  points: v.array(
    v.object({
      text: v.string(),
      chunkIds: v.array(v.id("documentChunks")),
    }),
  ),
  sourceId: v.id("legalSources"),
  status: sourceStatusValidator,
  verificationStatus: verificationValidator,
  createdAt: v.number(),
  updatedAt: v.number(),
}).index("by_category", ["category"]);

export const cases = defineTable({
  userId: v.id("users"),
  title: v.string(),
  description: v.optional(v.string()),
  status: v.string(),
  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_user", ["userId", "updatedAt"])
  .index("by_user_created", ["userId", "createdAt"]);

export const caseEvents = defineTable({
  caseId: v.id("cases"),
  date: v.number(),
  description: v.string(),
  /** user_claim | verified_fact | document_event */
  kind: v.string(),
  status: v.string(),
  createdAt: v.number(),
}).index("by_case", ["caseId", "date"]);

export const caseNotes = defineTable({
  caseId: v.id("cases"),
  body: v.string(),
  createdAt: v.number(),
}).index("by_case", ["caseId", "createdAt"]);

export const caseTasks = defineTable({
  caseId: v.id("cases"),
  title: v.string(),
  dueAt: v.optional(v.number()),
  status: v.string(),
  createdAt: v.number(),
}).index("by_case", ["caseId"]);

export const caseDocuments = defineTable({
  caseId: v.id("cases"),
  userId: v.id("users"),
  /** userDocuments.id */
  documentId: v.id("userDocuments"),
  createdAt: v.number(),
}).index("by_case", ["caseId"]);

/** User-uploaded documents: text/metadata only. Binary never persisted. */
export const userDocuments = defineTable({
  userId: v.id("users"),
  name: v.string(),
  mimeType: v.string(),
  sizeBytes: v.number(),
  sha256: v.string(),
  /** Extracted, normalized text (truncated at a hard cap). */
  text: v.string(),
  analysis: v.optional(v.any()),
  createdAt: v.number(),
}).index("by_user", ["userId", "createdAt"]);

export const notifications = defineTable({
  userId: v.id("users"),
  title: v.string(),
  body: v.string(),
  read: v.boolean(),
  /** knowledge | system | review | deadline */
  kind: v.string(),
  createdAt: v.number(),
})
  .index("by_user", ["userId", "createdAt"])
  .index("by_unread", ["userId", "read"]);

export const auditLogs = defineTable({
  /** login | logout | ai_query | source_* | document_* | case_* | security_event | permission_denied … */
  action: v.string(),
  userId: v.optional(v.id("users")),
  /** Never store sensitive content: ids, codes and enums only. */
  targetType: v.optional(v.string()),
  targetId: v.optional(v.string()),
  details: v.optional(v.string()),
  createdAt: v.number(),
})
  .index("by_action", ["action", "createdAt"])
  .index("by_time", ["createdAt"]);

export const rateLimits = defineTable({
  key: v.string(),
  windowStart: v.number(),
  count: v.number(),
}).index("by_key", ["key"]);

export const evaluationCases = defineTable({
  code: v.string(),
  question: v.string(),
  domain: v.string(),
  expectedEvidenceStatus: evidenceStatusValidator,
  expectedQueryType: v.optional(queryTypeValidator),
  expectAbstain: v.boolean(),
  expectedSourceTitle: v.optional(v.string()),
  notes: v.optional(v.string()),
  createdAt: v.number(),
}).index("by_code", ["code"]);

export const evaluationRuns = defineTable({
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
  createdAt: v.number(),
}).index("by_time", ["createdAt"]);

export const systemSettings = defineTable({
  key: v.string(),
  value: v.string(),
  updatedAt: v.number(),
}).index("by_key", ["key"]);

const schema = defineSchema(
  {
    // default auth tables using convex auth.
    ...authTables, // do not remove or modify

    // the users table is the default users table that is brought in by the authTables
    users: defineTable({
      name: v.optional(v.string()), // name of the user. do not remove
      image: v.optional(v.string()), // image of the user. do not remove
      email: v.optional(v.string()), // email of the user. do not remove
      emailVerificationTime: v.optional(v.number()), // email verification time. do not remove
      isAnonymous: v.optional(v.boolean()), // is the user anonymous. do not remove

      role: v.optional(roleValidator), // role of the user. do not remove
    }).index("email", ["email"]), // index for the email. do not remove or modify

    // add other tables here

    // tableName: defineTable({
    //   ...
    //   // table fields
    // }).index("by_field", ["field"])
  },
  {
    schemaValidation: false,
  },
);

export default schema;
