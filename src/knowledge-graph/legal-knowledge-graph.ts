/**
 * Egyptian Legal Knowledge Graph — CRIM-SYS 2026
 *
 * Browser-safe adaptation of the sketch. The original opened a real
 * Neo4j Community Edition connection (`neo4j-driver`, `bolt://`), which
 * cannot run in this Vite browser app without a separately deployed
 * graph database. The existing `EgyptianKnowledgeGraph` module was
 * explicitly designed to mirror Neo4j's labeled-property model so it
 * can be lifted onto a real instance later — this facade exposes the
 * same Cypher-flavoured operations over that in-memory graph:
 *
 *   buildLegalGraph()              → graph statistics (async, mirrors the
 *                                    sketch's build step).
 *   findRelatedLaws(articleNumber) → the sketch's MATCH query: for an
 *                                    article number find its law, the
 *                                    precedents that interpret it, and
 *                                    the concepts / related articles.
 *   visualizeLegalRelationships()  → nodes + edges for rendering with a
 *                                    hierarchical layout.
 *
 * The graph is built once from the Egyptian legal database
 * (المواد / الأحكام / القوانين) and kept entirely client-side.
 */

import {
  EgyptianKnowledgeGraph,
  getEgyptianKnowledgeGraph,
  type KnowledgeEdge,
  type KnowledgeEdgeType,
  type KnowledgeNode,
} from "@/lib/knowledge-graph";

// The graph stores precedent→article edges under this runtime label,
// which is cast from the union in the core module.
const EDGE_APPLIES_TO = "applies_to" as unknown as KnowledgeEdgeType;

// ============================================================
// Types
// ============================================================

export interface GraphBuildStats {
  laws: number;
  articles: number;
  precedents: number;
  concepts: number;
  relationships: number;
  builtAt: string;
}

/** One article match in the `findRelatedLaws` result. */
export interface RelatedArticleRelation {
  article: KnowledgeNode;
  law: KnowledgeNode | undefined;
  lawName: string;
  /** Precedents that interpret the article (حكم يطبق المادة). */
  precedents: KnowledgeNode[];
  /** Procedural concepts derived from the article. */
  concepts: KnowledgeNode[];
  /** Other articles of the same law (تشريع واحد). */
  relatedArticles: KnowledgeNode[];
}

export interface RelatedLawsResult {
  /** The queried article number. */
  query: string;
  /** Every law containing an article with that number. */
  matches: RelatedArticleRelation[];
  totalMatches: number;
}

export interface GraphVisualization {
  seedId: string;
  nodes: KnowledgeNode[];
  edges: KnowledgeEdge[];
  layout: "hierarchical";
  depth: number;
}

// ============================================================
// Facade
// ============================================================

export class EgyptianLegalKnowledgeGraph {
  private graph: EgyptianKnowledgeGraph;

  constructor(graph: EgyptianKnowledgeGraph = getEgyptianKnowledgeGraph()) {
    this.graph = graph;
  }

  /**
   * Report graph statistics. The graph is already built from the legal
   * database at construction time (mirrors the sketch's build step in a
   * browser-safe way — no Cypher runner required).
   */
  async buildLegalGraph(): Promise<GraphBuildStats> {
    const nodes = this.graph.getAllNodes();
    const counts = {
      law: 0,
      article: 0,
      precedent: 0,
      concept: 0,
      deadline: 0,
    };
    for (const node of nodes) {
      counts[node.type] = (counts[node.type] ?? 0) + 1;
    }

    // Adjacency stores every edge twice (forward + reverse copy).
    const directed = new Set<string>();
    for (const node of nodes) {
      for (const edge of this.neighbors(node.id)) {
        directed.add(`${edge.source}|${edge.target}|${edge.type}`);
      }
    }

    return {
      laws: counts.law,
      articles: counts.article,
      precedents: counts.precedent,
      concepts: counts.concept,
      relationships: directed.size / 2,
      builtAt: new Date().toISOString(),
    };
  }

  /** Outgoing edges of a node (traversal of depth 1, source-only). */
  private neighbors(nodeId: string): KnowledgeEdge[] {
    const traversal = this.graph.traverse({ nodeId, maxDepth: 1 });
    return traversal.edges.filter((e) => e.source === nodeId);
  }

  /**
   * MATCH (a:Article {number: $number}) — find every law containing an
   * article with this number, plus the precedents interpreting it and
   * related concepts/articles of the same law.
   */
  findRelatedLaws(articleNumber: string): RelatedLawsResult {
    const number = articleNumber.trim();
    const articleNodes = this.graph
      .getNodesByType("article")
      .filter((n) => {
        const tail = n.id.substring(n.id.lastIndexOf(":") + 1);
        return tail === number || n.label.includes(`مادة ${number}`);
      });

    const matches: RelatedArticleRelation[] = articleNodes.map((article) => {
      const outgoing = this.neighbors(article.id);
      const lawId = outgoing.find(
        (e) => e.type === "references" && e.target.startsWith("law:"),
      )?.target;
      const law = lawId ? this.graph.getNode(lawId) : undefined;

      const precedents = outgoing
        .filter((e) => e.type === EDGE_APPLIES_TO && e.target.startsWith("precedent:"))
        .map((e) => this.graph.getNode(e.target))
        .filter((n): n is KnowledgeNode => Boolean(n));

      const concepts = outgoing
        .filter((e) => e.type === "derived_from" && e.target.startsWith("concept:"))
        .map((e) => this.graph.getNode(e.target))
        .filter((n): n is KnowledgeNode => Boolean(n));

      const relatedArticles = law
        ? this.neighbors(law.id)
            .filter((e) => e.type === "references" && e.target.startsWith("article:") && e.target !== article.id)
            .map((e) => this.graph.getNode(e.target))
            .filter((n): n is KnowledgeNode => Boolean(n))
            .slice(0, 12)
        : [];

      return {
        article,
        law,
        lawName: law?.label ?? "قانون غير محدد",
        precedents,
        concepts,
        relatedArticles,
      };
    });

    return {
      query: number,
      matches,
      totalMatches: matches.length,
    };
  }

  /**
   * Build a visualizable subgraph around a seed. Accepts a node id
   * (e.g. "article:penal:234") or an article number / free-text topic
   * which is resolved to the best matching node first.
   */
  visualizeLegalRelationships(seed: string): GraphVisualization {
    let seedId = seed.trim();
    if (!this.graph.getNode(seedId)) {
      const byNumber = this.findRelatedLaws(seedId);
      seedId = byNumber.matches[0]?.article.id ?? seedId;
    }
    if (!this.graph.getNode(seedId)) {
      const found = this.graph.search(seed)[0];
      if (found) seedId = found.id;
    }

    const traversal = this.graph.traverse({ nodeId: seedId, maxDepth: 2 });
    return {
      seedId,
      nodes: traversal.nodes,
      edges: traversal.edges.filter(
        (e) => traversal.nodes.some((n) => n.id === e.source) && traversal.nodes.some((n) => n.id === e.target),
      ),
      layout: "hierarchical",
      depth: traversal.depth,
    };
  }

  /** Search helper passthrough. */
  search(query: string): KnowledgeNode[] {
    return this.graph.search(query);
  }
}

// ============================================================
// Singleton
// ============================================================

let facadeInstance: EgyptianLegalKnowledgeGraph | null = null;

export function getEgyptianLegalKnowledgeGraph(): EgyptianLegalKnowledgeGraph {
  if (!facadeInstance) {
    facadeInstance = new EgyptianLegalKnowledgeGraph();
  }
  return facadeInstance;
}
