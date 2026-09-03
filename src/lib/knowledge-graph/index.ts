/**
 * Knowledge Graph Module — CRIM-SYS 2026
 *
 * A lightweight, in-memory knowledge graph for Egyptian law.
 * Nodes are laws, articles, court precedents, and procedural concepts;
 * edges model relationships (references, derived-from, applies-to).
 *
 * The design mirrors Neo4j's labeled-property graph model so it can be
 * lifted onto a real graph database (Neo4j Community Edition) later
 * without changing the consuming code.
 */

import { ALL_CODES, COURT_PRECEDENTS, type LegalArticle, type LegalCategory } from '../../legal-db/egyptian-codes';

// ============================================================
// Types
// ============================================================

export type KnowledgeNodeType =
  | 'law'
  | 'article'
  | 'precedent'
  | 'concept'
  | 'deadline';

export type KnowledgeEdgeType =
  | 'references' // article → law, precedent → article
  | 'derived_from' // concept → article
  | 'enforced_by' // law → authority
  | 'related_to'; // generic link

export interface KnowledgeNode {
  id: string;
  type: KnowledgeNodeType;
  label: string; // Arabic label
  category?: LegalCategory;
  properties: Record<string, string>;
}

export interface KnowledgeEdge {
  source: string;
  target: string;
  type: KnowledgeEdgeType;
  label?: string;
}

export interface GraphQuery {
  nodeId: string;
  maxDepth?: number; // default 2
}

export interface GraphTraversal {
  nodes: KnowledgeNode[];
  edges: KnowledgeEdge[];
  depth: number;
}

// ============================================================
// Graph Construction from the Egyptian legal database
// ============================================================

export class EgyptianKnowledgeGraph {
  private nodes = new Map<string, KnowledgeNode>();
  private adjacency = new Map<string, KnowledgeEdge[]>();

  constructor() {
    this.build();
  }

  private addNode(node: KnowledgeNode): void {
    if (!this.nodes.has(node.id)) {
      this.nodes.set(node.id, node);
      this.adjacency.set(node.id, []);
    }
  }

  private addEdge(edge: KnowledgeEdge): void {
    if (!this.nodes.has(edge.source) || !this.nodes.has(edge.target)) return;
    const existing = this.adjacency.get(edge.source) ?? [];
    if (!existing.some((e) => e.source === edge.source && e.target === edge.target && e.type === edge.type)) {
      existing.push(edge);
      this.adjacency.set(edge.source, existing);
    }
    // Bidirectional traversal convenience: also register the reverse.
    const reverse = this.adjacency.get(edge.target) ?? [];
    if (!reverse.some((e) => e.source === edge.target && e.target === edge.source)) {
      reverse.push({ ...edge, source: edge.target, target: edge.source });
      this.adjacency.set(edge.target, reverse);
    }
  }

  private build(): void {
    // 1) Laws
    for (const code of ALL_CODES) {
      this.addNode({
        id: `law:${code.id}`,
        type: 'law',
        label: code.nameAr,
        category: code.category,
        properties: { number: code.number, year: String(code.year), nameEn: code.nameEn },
      });
    }

    // 2) Articles, linked to their law
    for (const code of ALL_CODES) {
      for (const article of code.articles) {
        const articleId = `article:${code.id}:${article.number}`;
        this.addNode({
          id: articleId,
          type: 'article',
          label: `${code.nameAr} — مادة ${article.number}`,
          category: code.category,
          properties: { title: article.titleAr, reference: article.reference ?? '' },
        });
        this.addEdge({
          source: articleId,
          target: `law:${code.id}`,
          type: 'references',
          label: `مادة ${article.number} من ${code.nameAr}`,
        });
      }
    }

    // 3) Court precedents, linked to the articles they apply
    for (const prec of COURT_PRECEDENTS) {
      const precedentId = `precedent:${prec.id}`;
      this.addNode({
        id: precedentId,
        type: 'precedent',
        label: prec.principle,
        category: prec.category,
        properties: { court: prec.court, date: prec.date, caseNumber: prec.caseNumber },
      });
      if (prec.articleRef) {
        const refKey = prec.articleRef.toLowerCase();
        for (const code of ALL_CODES) {
          for (const article of code.articles) {
            if (
              String(article.number) === prec.articleRef ||
              (article.reference ?? '').toLowerCase().includes(refKey)
            ) {
              this.addEdge({
                source: precedentId,
                target: `article:${code.id}:${article.number}`,
                type: 'applies_to' as KnowledgeEdgeType,
                label: `يطبق المادة ${article.number}`,
              });
            }
          }
        }
      }
    }

    // 4) Common procedural concepts, linked to related articles
    const concepts: Array<{ id: string; label: string; category: LegalCategory; articleMatch: (a: LegalArticle) => boolean }> = [
      {
        id: 'concept:prescription',
        label: 'التقادم (Prescription)',
        category: 'criminal',
        articleMatch: (a) => /تقادم|التقادم/.test(`${a.titleAr} ${a.content}`),
      },
      {
        id: 'concept:appeal',
        label: 'الاستئناف والنقض (Appeals)',
        category: 'criminal',
        articleMatch: (a) => /استئناف|نقض|معارضة/.test(`${a.titleAr} ${a.content}`),
      },
      {
        id: 'concept:detention',
        label: 'الحبس الاحتياطي (Pre-trial Detention)',
        category: 'criminal',
        articleMatch: (a) => /حبس احتياطي|حبس احتياطى|إفراج/.test(`${a.titleAr} ${a.content}`),
      },
      {
        id: 'concept:contracts',
        label: 'العقود والالتزامات (Contracts)',
        category: 'civil',
        articleMatch: (a) => /عقد|التزام|إخلال/.test(`${a.titleAr} ${a.content}`),
      },
      {
        id: 'concept:inheritance',
        label: 'المواريث الشرعية (Inheritance)',
        category: 'family',
        articleMatch: (a) => /ميراث|إرث|تركة|وصية/.test(`${a.titleAr} ${a.content}`),
      },
    ];

    for (const concept of concepts) {
      this.addNode({
        id: concept.id,
        type: 'concept',
        label: concept.label,
        category: concept.category,
        properties: {},
      });
      for (const code of ALL_CODES) {
        for (const article of code.articles) {
          if (concept.articleMatch(article)) {
            this.addEdge({
              source: concept.id,
              target: `article:${code.id}:${article.number}`,
              type: 'derived_from',
              label: `مشتق من المادة ${article.number}`,
            });
          }
        }
      }
    }
  }

  // ============================================================
  // Query API
  // ============================================================

  getNode(nodeId: string): KnowledgeNode | undefined {
    return this.nodes.get(nodeId);
  }

  getAllNodes(): KnowledgeNode[] {
    return Array.from(this.nodes.values());
  }

  getNodesByType(type: KnowledgeNodeType): KnowledgeNode[] {
    return this.getAllNodes().filter((n) => n.type === type);
  }

  getNodesByCategory(category: LegalCategory): KnowledgeNode[] {
    return this.getAllNodes().filter((n) => n.category === category);
  }

  search(query: string): KnowledgeNode[] {
    const q = query.toLowerCase();
    return this.getAllNodes().filter(
      (n) => n.label.toLowerCase().includes(q) || n.id.toLowerCase().includes(q),
    );
  }

  /**
   * Breadth-first traversal around a node, returning the subgraph
   * (nodes + edges) within `maxDepth` hops.
   */
  traverse(query: GraphQuery): GraphTraversal {
    const maxDepth = query.maxDepth ?? 2;
    const visitedNodes = new Set<string>([query.nodeId]);
    const collectedNodes: KnowledgeNode[] = [];
    const collectedEdges: KnowledgeEdge[] = [];
    let frontier: string[] = [query.nodeId];

    for (let depth = 0; depth < maxDepth && frontier.length > 0; depth++) {
      const nextFrontier: string[] = [];
      for (const nodeId of frontier) {
        const node = this.nodes.get(nodeId);
        if (node) collectedNodes.push(node);
        for (const edge of this.adjacency.get(nodeId) ?? []) {
          collectedEdges.push(edge);
          if (!visitedNodes.has(edge.target)) {
            visitedNodes.add(edge.target);
            nextFrontier.push(edge.target);
          }
        }
      }
      frontier = nextFrontier;
    }

    return { nodes: collectedNodes, edges: collectedEdges, depth: maxDepth };
  }

  /**
   * Find the shortest path between two nodes (BFS).
   */
  findPath(startId: string, targetId: string): string[] | null {
    if (startId === targetId) return [startId];
    const visited = new Set<string>([startId]);
    const queue: string[][] = [[startId]];

    while (queue.length > 0) {
      const path = queue.shift()!;
      const current = path[path.length - 1]!;
      for (const edge of this.adjacency.get(current) ?? []) {
        if (!visited.has(edge.target)) {
          const newPath = [...path, edge.target];
          if (edge.target === targetId) return newPath;
          visited.add(edge.target);
          queue.push(newPath);
        }
      }
    }
    return null;
  }
}

// ============================================================
// Singleton
// ============================================================

let graphInstance: EgyptianKnowledgeGraph | null = null;

export function getEgyptianKnowledgeGraph(): EgyptianKnowledgeGraph {
  if (!graphInstance) {
    graphInstance = new EgyptianKnowledgeGraph();
  }
  return graphInstance;
}