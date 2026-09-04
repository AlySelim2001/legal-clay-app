/**
 * Knowledge-Graph Diagram PDF — CRIM-SYS 2026
 *
 * Renders the selected node's legal relationships (law ⇄ article ⇄
 * precedent ⇄ concept) as a printable hierarchical diagram for a case
 * file. Drawn on a <canvas> (browser Arabic shaping) and embedded into
 * a PDF via pdf-lib — same pipeline as the e-signature certificate and
 * the success-rate report.
 *
 * Layout: focus node as root card → direct neighbors (level 1) across
 * a row with edges → up to three second-level nodes stacked under each
 * parent, then a "+N" note for anything left out so large subgraphs
 * (e.g. a law with dozens of articles) stay readable.
 */

import { PDFDocument } from "pdf-lib";
import type { GraphTraversal, KnowledgeNode, KnowledgeNodeType } from "@/lib/knowledge-graph";

// ============================================================
// Types + constants
// ============================================================

export interface KnowledgeGraphDiagramInput {
  /** The traversal around the focus node (usually depth 2). */
  traversal: GraphTraversal;
  /** The node the diagram centres on (must be in traversal.nodes). */
  focus: KnowledgeNode;
  /** Optional case reference to stamp on the report (e.g. كود القضية). */
  caseRef?: string;
}

const A4_PT: [number, number] = [595.28, 841.89];
const SCALE = 2;

const CLAY_PURPLE = "#6d4c8f";
const INK = "#2b2620";
const MUTED = "#7a6f5e";
const PAPER = "#faf6ef";
const EDGE_COLOR = "#b7a98f";

const FONT = '"Cairo", "Noto Kufi Arabic", "Segoe UI", Tahoma, sans-serif';

const TYPE_META: Record<KnowledgeNodeType, { color: string; labelAr: string }> = {
  law: { color: "#6d4c8f", labelAr: "قانون" },
  article: { color: "#2563eb", labelAr: "مادة" },
  precedent: { color: "#1e8a4f", labelAr: "سابقة قضائية" },
  concept: { color: "#b3405e", labelAr: "مفهوم" },
  deadline: { color: "#b07f0e", labelAr: "ميعاد" },
};

const TYPE_RANK: Record<KnowledgeNodeType, number> = {
  law: 0,
  article: 1,
  precedent: 2,
  concept: 3,
  deadline: 4,
};

const MAX_LEVEL_1 = 6;
const MAX_CHILDREN_PER_PARENT = 3;

// ============================================================
// Canvas helpers
// ============================================================

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/)) {
    const candidate = line ? `${line} ${word}` : word;
    if (ctx.measureText(candidate).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function shortId(id: string, max = 46): string {
  return id.length > max ? `${id.slice(0, max)}…` : id;
}

// ============================================================
// Tree extraction from a traversal
// ============================================================

function undirectedNeighbors(
  traversal: GraphTraversal,
  nodeId: string,
): Set<string> {
  const seen = new Set<string>();
  for (const edge of traversal.edges) {
    if (edge.source === nodeId && edge.target !== nodeId) seen.add(edge.target);
    if (edge.target === nodeId && edge.source !== nodeId) seen.add(edge.source);
  }
  return seen;
}

function orderNodes(
  traversal: GraphTraversal,
  ids: Iterable<string>,
): KnowledgeNode[] {
  return Array.from(ids)
    .map((id) => traversal.nodes.find((n) => n.id === id))
    .filter((n): n is KnowledgeNode => Boolean(n))
    .sort((a, b) => {
      const rankDiff = (TYPE_RANK[a.type] ?? 5) - (TYPE_RANK[b.type] ?? 5);
      if (rankDiff !== 0) return rankDiff;
      return a.label.localeCompare(b.label, "ar");
    });
}

// ============================================================
// Drawing
// ============================================================

function drawNodeBox(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  node: KnowledgeNode,
): void {
  const meta = TYPE_META[node.type] ?? { color: MUTED, labelAr: node.type };
  roundedRect(ctx, x, y, w, h, 16);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.strokeStyle = meta.color;
  ctx.lineWidth = 2.5;
  ctx.stroke();

  ctx.direction = "rtl";
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";

  // Type chip (top, inside the box)
  ctx.font = `700 ${16}px ${FONT}`;
  ctx.fillStyle = meta.color;
  ctx.fillText(meta.labelAr, x + w - 14, y + 22);

  // Label, wrapped, two lines max
  ctx.font = `600 ${21}px ${FONT}`;
  ctx.fillStyle = INK;
  const lines = wrapText(ctx, node.label, w - 28).slice(0, 2);
  lines.forEach((line, i) => {
    ctx.fillText(line, x + w - 14, y + 44 + i * 26);
  });

  // Node id (bottom, latin, LTR)
  ctx.direction = "ltr";
  ctx.textAlign = "left";
  ctx.font = `500 ${13}px "JetBrains Mono", Consolas, monospace`;
  ctx.fillStyle = MUTED;
  ctx.fillText(shortId(node.id), x + 14, y + h - 20);
}

function drawDiagramPage(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  traversal: GraphTraversal,
  focus: KnowledgeNode,
  caseRef: string | undefined,
  generatedAt: string,
): void {
  const margin = Math.round(w * 0.08);
  const innerW = w - margin * 2;
  const cx = w / 2;
  ctx.direction = "rtl";

  // Paper
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, w, h);

  // Header band
  ctx.fillStyle = CLAY_PURPLE;
  ctx.fillRect(0, 0, w, Math.round(h * 0.115));
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#ffffff";
  ctx.font = `700 ${Math.round(w * 0.03)}px ${FONT}`;
  ctx.fillText("مخطط العلاقات القانونية", w / 2, Math.round(h * 0.042));
  ctx.font = `500 ${Math.round(w * 0.015)}px ${FONT}`;
  ctx.fillStyle = "#efe6f9";
  ctx.fillText("رسم بياني معرفي للقانون المصري · CRIM-SYS 2026", w / 2, Math.round(h * 0.084));

  ctx.textAlign = "right";

  // Meta lines
  let y = Math.round(h * 0.14);
  const metaLine = (label: string, value: string, mono = false): void => {
    ctx.font = `600 ${Math.round(w * 0.015)}px ${FONT}`;
    ctx.fillStyle = CLAY_PURPLE;
    ctx.fillText(label, w - margin, y);
    const labelW = ctx.measureText(label).width;
    ctx.font = mono
      ? `500 ${Math.round(w * 0.015)}px "JetBrains Mono", Consolas, monospace`
      : `500 ${Math.round(w * 0.015)}px ${FONT}`;
    ctx.fillStyle = INK;
    ctx.fillText(
      wrapText(ctx, value, innerW - labelW - Math.round(w * 0.05))[0] ?? "",
      w - margin - labelW - Math.round(w * 0.03),
      y,
    );
    y += Math.round(h * 0.027);
  };
  if (caseRef) metaLine("مرجع الملف:", caseRef, true);
  metaLine("تاريخ الإصدار:", generatedAt);
  y += Math.round(h * 0.01);

  // Separator
  ctx.strokeStyle = "#c8b38a";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(margin, y);
  ctx.lineTo(w - margin, y);
  ctx.stroke();

  // ---- Root (focus) card ----
  const rootTop = y + Math.round(h * 0.035);
  const rootH = Math.round(h * 0.08);
  const rootW = Math.round(innerW * 0.78);
  drawNodeBox(ctx, cx - rootW / 2, rootTop, rootW, rootH, focus);
  const rootBottom = rootTop + rootH;

  // ---- Level 1 row ----
  const level1 = orderNodes(traversal, undirectedNeighbors(traversal, focus.id)).slice(0, MAX_LEVEL_1);
  const l1Top = rootBottom + Math.round(h * 0.045);
  const l1H = Math.round(h * 0.08);
  const spacing = innerW / (level1.length + 1);
  const boxW = Math.min(360, Math.max(120, Math.round(spacing - 20)));

  const l1Centers = level1.map((node) => {
    const total = level1.length + 1;
    return { node, x: (innerW / total) * (level1.indexOf(node) + 1) + margin };
  });

  // Caption
  ctx.font = `500 ${Math.round(w * 0.013)}px ${FONT}`;
  ctx.fillStyle = MUTED;
  ctx.textAlign = "center";
  ctx.fillText(`علاقات مباشرة حول العقدة المرجعية (${level1.length})`, w / 2, l1Top - Math.round(h * 0.016));
  ctx.textAlign = "right";

  // Edges root → level 1
  ctx.strokeStyle = EDGE_COLOR;
  ctx.lineWidth = 2;
  for (const item of l1Centers) {
    ctx.beginPath();
    ctx.moveTo(cx, rootBottom);
    ctx.lineTo(item.x, l1Top);
    ctx.stroke();
    drawNodeBox(ctx, item.x - boxW / 2, l1Top, boxW, l1H, item.node);
  }
  if (level1.length === 0) {
    ctx.textAlign = "center";
    ctx.fillStyle = MUTED;
    ctx.font = `500 ${Math.round(w * 0.014)}px ${FONT}`;
    ctx.fillText("لا توجد علاقات مسجلة لهذه العقدة", w / 2, l1Top + Math.round(h * 0.02));
    ctx.textAlign = "right";
  }

  // ---- Level 2 stacks under each level-1 parent ----
  const l2Top = l1Top + l1H + Math.round(h * 0.05);
  const childH = Math.round(h * 0.08);
  const childGap = Math.round(h * 0.02);
  const childW = boxW;

  for (const item of l1Centers) {
    const children = orderNodes(traversal, undirectedNeighbors(traversal, item.node.id)).filter(
      (n) => n.id !== focus.id && !level1.some((l1) => l1.id === n.id),
    );
    if (children.length === 0) continue;
    const visible = children.slice(0, MAX_CHILDREN_PER_PARENT);
    const hidden = children.length - visible.length;

    // Edge parent → each child
    for (const [i, child] of visible.entries()) {
      const childY = l2Top + i * (childH + childGap);
      ctx.beginPath();
      ctx.moveTo(item.x, l1Top + l1H);
      ctx.lineTo(item.x, childY);
      ctx.stroke();
      drawNodeBox(ctx, item.x - childW / 2, childY, childW, childH, child);
    }
    if (hidden > 0) {
      const noteY = l2Top + visible.length * (childH + childGap) - childGap + Math.round(h * 0.02);
      ctx.textAlign = "center";
      ctx.fillStyle = MUTED;
      ctx.font = `500 ${Math.round(w * 0.012)}px ${FONT}`;
      ctx.fillText(`+ ${hidden} عقدة أخرى ضمن العمق الثاني`, item.x, noteY);
      ctx.textAlign = "right";
    }
  }

  // ---- Footer ----
  const footerY = h - Math.round(h * 0.07);
  ctx.strokeStyle = "#c8b38a";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(margin, footerY);
  ctx.lineTo(w - margin, footerY);
  ctx.stroke();

  ctx.textAlign = "center";
  ctx.fillStyle = MUTED;
  ctx.font = `500 ${Math.round(w * 0.0125)}px ${FONT}`;
  const disclaimer = wrapText(
    ctx,
    "مخطط استرشادي مبني على قاعدة المعرفة القانونية داخل التطبيق — راجع المادة الأصلية والحكم الكامل قبل الاعتماد في أي إجراء.",
    innerW,
  );
  disclaimer.forEach((line, i) => {
    ctx.fillText(line, w / 2, footerY + Math.round(h * 0.016) + i * Math.round(h * 0.022));
  });
  ctx.fillStyle = "#9a8b76";
  ctx.font = `500 ${Math.round(w * 0.011)}px ${FONT}`;
  ctx.fillText(
    `صدر من CRIM-SYS 2026 · ${generatedAt}`,
    w / 2,
    footerY + Math.round(h * 0.016) + disclaimer.length * Math.round(h * 0.022) + Math.round(h * 0.02),
  );
}

// ============================================================
// Public API
// ============================================================

/** Build the diagram PDF bytes for a focus node + its traversal. */
export async function buildKnowledgeGraphDiagramPdf(
  input: KnowledgeGraphDiagramInput,
  generatedAt: Date = new Date(),
): Promise<Uint8Array> {
  const w = Math.round(A4_PT[0] * SCALE);
  const h = Math.round(A4_PT[1] * SCALE);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("تعذر تجهيز صفحة المخطط");

  drawDiagramPage(
    ctx,
    w,
    h,
    input.traversal,
    input.focus,
    input.caseRef,
    generatedAt.toLocaleString("ar-EG", { dateStyle: "full", timeStyle: "short" }),
  );

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/png"),
  );
  if (!blob) throw new Error("تعذر إنشاء المخطط");

  const pdf = await PDFDocument.create();
  const page = pdf.addPage([A4_PT[0], A4_PT[1]]);
  const image = await pdf.embedPng(new Uint8Array(await blob.arrayBuffer()));
  page.drawImage(image, { x: 0, y: 0, width: A4_PT[0], height: A4_PT[1] });
  return pdf.save();
}

/** Download the generated diagram PDF. */
export function downloadKnowledgeGraphDiagram(
  bytes: Uint8Array,
  filename: string = `legal-relations-${new Date().toISOString().slice(0, 10)}.pdf`,
): void {
  const url = URL.createObjectURL(
    new Blob([bytes as unknown as BlobPart], { type: "application/pdf" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Build a safe file name from a focus-node id (e.g. article:penal:234). */
export function diagramFileName(focusId: string): string {
  const tail = focusId.split(":").filter(Boolean).slice(-2).join("-");
  return `legal-relations-${tail || "diagram"}-${new Date().toISOString().slice(0, 10)}.pdf`;
}
