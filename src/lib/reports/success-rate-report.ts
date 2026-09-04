/**
 * Success-Rate PDF Report — CRIM-SYS 2026
 *
 * Renders the success-rate analysis as a polished Arabic A4 report for
 * client review. Arabic is drawn on a <canvas> (browser text shaping,
 * correct RTL) and embedded into the PDF with pdf-lib — the same
 * approach used by the e-signature certificate, because PDF text
 * engines in pure-JS libraries cannot shape Arabic.
 */

import { PDFDocument } from "pdf-lib";
import type { SuccessRateAnalysis } from "@/analytics/predictive-analytics";

// ============================================================
// Meta + page constants
// ============================================================

export interface SuccessRateReportMeta {
  /** Scope label, e.g. "كل المحامين" أو اسم المحامي. */
  lawyerLabel: string;
  /** Case-type scope label, e.g. "جميع أنواع القضايا". */
  caseTypeLabel: string;
}

const A4_PT: [number, number] = [595.28, 841.89];
const SCALE = 2;

const CLAY_PURPLE = "#6d4c8f";
const CLAY_TEAL = "#0f766e";
const INK = "#2b2620";
const MUTED = "#7a6f5e";
const PAPER = "#faf6ef";
const CARD = "#f3ead9";
const BORDER = "#c8b38a";
const GREEN = "#1e8a4f";
const AMBER = "#b07f0e";
const RED = "#b03a2e";

const FONT =
  '"Cairo", "Noto Kufi Arabic", "Segoe UI", Tahoma, sans-serif';

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

function rateColor(rate: number): string {
  return rate >= 60 ? GREEN : rate >= 40 ? AMBER : RED;
}

// ============================================================
// Page rendering
// ============================================================

function drawReportPage(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  analysis: SuccessRateAnalysis,
  meta: SuccessRateReportMeta,
  generatedAt: string,
): void {
  const margin = Math.round(w * 0.08);
  const innerW = w - margin * 2;

  // Paper background
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, w, h);

  // Header band
  ctx.fillStyle = CLAY_PURPLE;
  ctx.fillRect(0, 0, w, Math.round(h * 0.118));
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#ffffff";
  ctx.direction = "rtl";
  ctx.font = `700 ${Math.round(w * 0.032)}px ${FONT}`;
  ctx.fillText("تقرير تحليل معدل النجاح", w / 2, Math.round(h * 0.045));
  ctx.font = `500 ${Math.round(w * 0.016)}px ${FONT}`;
  ctx.fillStyle = "#efe6f9";
  ctx.fillText("قضايا جنائية — مراجعة العميل · CRIM-SYS 2026", w / 2, Math.round(h * 0.088));

  ctx.textAlign = "right";
  ctx.direction = "rtl";

  // Scope block
  let y = Math.round(h * 0.15);
  const labelValue = (label: string, value: string, mono = false): void => {
    ctx.font = `600 ${Math.round(w * 0.016)}px ${FONT}`;
    ctx.fillStyle = CLAY_PURPLE;
    ctx.fillText(label, w - margin, y);
    const labelWidth = ctx.measureText(label).width;
    ctx.font = mono
      ? `500 ${Math.round(w * 0.016)}px "JetBrains Mono", Consolas, monospace`
      : `500 ${Math.round(w * 0.016)}px ${FONT}`;
    ctx.fillStyle = INK;
    const valueX = w - margin - labelWidth - Math.round(w * 0.03);
    const wrapped = wrapText(ctx, value, valueX - margin);
    wrapped.forEach((line) => {
      ctx.fillText(line, w - margin - labelWidth - Math.round(w * 0.03), y);
      y += Math.round(h * 0.027);
    });
  };

  labelValue("نطاق التحليل (المحامي):", meta.lawyerLabel);
  labelValue("نوع القضية:", meta.caseTypeLabel);
  labelValue("تاريخ الإصدار:", generatedAt);
  y += Math.round(h * 0.014);

  // Divider
  ctx.strokeStyle = BORDER;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(margin, y);
  ctx.lineTo(w - margin, y);
  ctx.stroke();
  y += Math.round(h * 0.03);

  // KPI stat chips (3 across)
  const chipGap = Math.round(w * 0.015);
  const chipW = (innerW - chipGap * 2) / 3;
  const chipH = Math.round(h * 0.09);
  const chipY = y;
  const chips: Array<{ value: string; label: string; color: string }> = [
    { value: `${Math.round(analysis.successRate)}%`, label: "معدل النجاح", color: rateColor(analysis.successRate) },
    {
      value: String(analysis.decidedCases),
      label: "قضايا محسومة (من إجمالي " + String(analysis.totalCases) + ")",
      color: INK,
    },
    {
      value:
        analysis.averageDurationDays !== null
          ? `${Math.round(analysis.averageDurationDays)} يوم`
          : "—",
      label: "متوسط مدة القضية",
      color: INK,
    },
  ];
  chips.forEach((chip, i) => {
    const x = margin + i * (chipW + chipGap);
    roundedRect(ctx, x, chipY, chipW, chipH, 18);
    ctx.fillStyle = CARD;
    ctx.fill();
    ctx.strokeStyle = BORDER;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.textAlign = "center";
    ctx.fillStyle = chip.color;
    ctx.font = `800 ${Math.round(w * 0.036)}px ${FONT}`;
    ctx.fillText(chip.value, x + chipW / 2, chipY + chipH * 0.42);
    ctx.fillStyle = MUTED;
    ctx.font = `500 ${Math.round(w * 0.0125)}px ${FONT}`;
    ctx.fillText(chip.label, x + chipW / 2, chipY + chipH * 0.74);
    ctx.textAlign = "right";
  });
  y = chipY + chipH + Math.round(h * 0.028);

  // Progress bar under the chips
  ctx.font = `500 ${Math.round(w * 0.0125)}px ${FONT}`;
  ctx.fillStyle = MUTED;
  ctx.textAlign = "right";
  ctx.fillText("مؤشر معدل النجاح", w - margin, y + Math.round(h * 0.012));
  const barY = y + Math.round(h * 0.024);
  const barH = Math.round(h * 0.014);
  roundedRect(ctx, margin, barY, innerW, barH, barH / 2);
  ctx.fillStyle = "#e5dccb";
  ctx.fill();
  const fillW = Math.max(Math.round(innerW * (analysis.successRate / 100)), Math.round(barH));
  roundedRect(ctx, margin, barY, fillW, barH, barH / 2);
  ctx.fillStyle = rateColor(analysis.successRate);
  ctx.fill();
  ctx.fillStyle = MUTED;
  ctx.textAlign = "center";
  ctx.font = `600 ${Math.round(w * 0.0125)}px ${FONT}`;
  ctx.fillText(
    `${Math.round(analysis.successRate)}% من القضايا المحسومة لصالح الدفاع`,
    w / 2,
    barY + barH + Math.round(h * 0.02),
  );
  ctx.textAlign = "right";
  y = barY + barH + Math.round(h * 0.045);

  // Ranking sections
  const section = (
    title: string,
    iconColor: string,
    items: Array<{ caseType: string; successRate: number; decided: number }>,
    emptyNote: string,
  ): void => {
    y += Math.round(h * 0.018);
    ctx.fillStyle = iconColor;
    ctx.font = `700 ${Math.round(w * 0.017)}px ${FONT}`;
    ctx.fillText(title, w - margin, y);
    y += Math.round(h * 0.036);
    if (items.length === 0) {
      ctx.fillStyle = MUTED;
      ctx.font = `500 ${Math.round(w * 0.014)}px ${FONT}`;
      const noteLines = wrapText(ctx, emptyNote, innerW);
      noteLines.forEach((line) => {
        ctx.fillText(line, w - margin, y);
        y += Math.round(h * 0.026);
      });
      y += Math.round(h * 0.012);
      return;
    }
    items.forEach((item) => {
      ctx.fillStyle = iconColor;
      ctx.font = `700 ${Math.round(w * 0.02)}px ${FONT}`;
      ctx.fillText("●", w - margin, y);
      ctx.fillStyle = INK;
      ctx.font = `600 ${Math.round(w * 0.0155)}px ${FONT}`;
      ctx.fillText(item.caseType, w - margin - Math.round(w * 0.028), y);
      ctx.font = `600 ${Math.round(w * 0.0155)}px ${FONT}`;
      ctx.fillStyle = rateColor(item.successRate);
      const detail = `${Math.round(item.successRate)}% — ${item.decided} قضية محسومة`;
      ctx.fillText(detail, margin + Math.round(w * 0.02), y);
      // faint line under row
      ctx.strokeStyle = "rgba(200,179,138,0.5)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(margin, y + Math.round(h * 0.018));
      ctx.lineTo(w - margin, y + Math.round(h * 0.018));
      ctx.stroke();
      y += Math.round(h * 0.05);
    });
  };

  section(
    "أقوى أنواع القضايا (أعلى نسبة نجاح)",
    GREEN,
    analysis.strongestCaseTypes,
    "لا توجد أنواع كافية للتصنيف — سجّل نتيجتين محسومتين على الأقل لكل نوع.",
  );
  section(
    "مجالات التحسين (أدنى نسبة نجاح)",
    RED,
    analysis.improvementAreas,
    "لا توجد فئات كافية للتحليل بعد.",
  );

  // Footer
  const footerY = h - Math.round(h * 0.075);
  ctx.strokeStyle = BORDER;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(margin, footerY);
  ctx.lineTo(w - margin, footerY);
  ctx.stroke();
  ctx.textAlign = "center";
  ctx.fillStyle = MUTED;
  ctx.font = `500 ${Math.round(w * 0.0125)}px ${FONT}`;
  const disclaimerLines = wrapText(
    ctx,
    "هذا التقرير إحصائي استرشادي مبني على السجل المحلي للنتائج داخل التطبيق — لا يمثل نصيحة قانونية ولا ضماناً للنتائج المستقبلية.",
    innerW,
  );
  disclaimerLines.forEach((line, i) => {
    ctx.fillText(line, w / 2, footerY + Math.round(h * 0.014) + i * Math.round(h * 0.022));
  });
  ctx.fillStyle = "#9a8b76";
  ctx.font = `500 ${Math.round(w * 0.0115)}px ${FONT}`;
  ctx.fillText(
    `صدر من CRIM-SYS 2026 · ${generatedAt}`,
    w / 2,
    footerY + Math.round(h * 0.014) + disclaimerLines.length * Math.round(h * 0.022) + Math.round(h * 0.018),
  );
}

// ============================================================
// Public API
// ============================================================

/**
 * Build the signed-style PDF report bytes for a success-rate analysis.
 */
export async function buildSuccessRateReportPdf(
  analysis: SuccessRateAnalysis,
  meta: SuccessRateReportMeta,
  generatedAt: Date = new Date(),
): Promise<Uint8Array> {
  const w = Math.round(A4_PT[0] * SCALE);
  const h = Math.round(A4_PT[1] * SCALE);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("تعذر تجهيز صفحة التقرير");

  const dateLabel = generatedAt.toLocaleString("ar-EG", {
    dateStyle: "full",
    timeStyle: "short",
  });
  drawReportPage(ctx, w, h, analysis, meta, dateLabel);

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/png"),
  );
  if (!blob) throw new Error("تعذر إنشاء التقرير");

  const pdf = await PDFDocument.create();
  const page = pdf.addPage([A4_PT[0], A4_PT[1]]);
  const image = await pdf.embedPng(new Uint8Array(await blob.arrayBuffer()));
  page.drawImage(image, { x: 0, y: 0, width: A4_PT[0], height: A4_PT[1] });
  return pdf.save();
}

/** Download helper for the generated report. */
export function downloadSuccessRateReport(
  bytes: Uint8Array,
  filename = `success-rate-report-${new Date().toISOString().slice(0, 10)}.pdf`,
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
