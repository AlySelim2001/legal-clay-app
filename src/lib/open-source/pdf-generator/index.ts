// ============================================================
// CRIM-SYS 2026 — PDF Generator Module
// Uses jsPDF + pdfmake for Egyptian court-formatted documents
// with Amiri Arabic font support
// ============================================================

import { jsPDF } from "jspdf";
import type {
  CasePDFData,
  LegalMemoPDFData,
  BailReceiptPDFData,
  PDFGeneratorFormat,
} from "@/lib/open-source";

// ---- Constants ----

const PAGE_MARGIN = 20;
const RTL_FONT = "Amiri";

// ---- Font Loading ----

let fontLoaded = false;

/**
 * Load Amiri Arabic font for jsPDF.
 * In production, place amiri-regular.ttf in /public/fonts/
 * For now we use a fallback approach with standard fonts.
 */
async function loadArabicFont(doc: jsPDF): Promise<void> {
  if (fontLoaded) return;
  try {
    // Try loading Amiri from public/fonts/ — users should download
    // from https://github.com/aliftype/amiri/releases
    const resp = await fetch("/fonts/amiri-regular.ttf");
    if (resp.ok) {
      const buffer = await resp.arrayBuffer();
      const base64 = btoa(
        new Uint8Array(buffer).reduce(
          (data, byte) => data + String.fromCharCode(byte),
          ""
        )
      );
      doc.addFileToVFS("Amiri-Regular.ttf", base64);
      doc.addFont("Amiri-Regular.ttf", RTL_FONT, "normal");
      fontLoaded = true;
    }
  } catch {
    // Font not available — fall back to helvetica (Latin only)
    console.warn("[PDF] Amiri font not found at /public/fonts/amiri-regular.ttf. Arabic text may not render correctly.");
  }
}

// ---- Helper: Draw RTL text ----

function drawRTLText(
  doc: jsPDF,
  text: string,
  x: number,
  y: number,
  options?: {
    fontSize?: number;
    fontStyle?: "normal" | "bold";
    color?: [number, number, number];
    maxWidth?: number;
  }
): void {
  const { fontSize = 12, fontStyle = "normal", color = [0, 0, 0] } = options ?? {};
  doc.setFont(RTL_FONT, fontStyle);
  doc.setFontSize(fontSize);
  doc.setTextColor(...color);

  // jsPDF doesn't natively support RTL; we reverse Arabic text
  // for proper display. In production, consider pdfmake or a
  // dedicated RTL library.
  const reversed = reverseArabic(text);
  doc.text(reversed, doc.internal.pageSize.getWidth() - x, y);
}

function reverseArabic(text: string): string {
  // Simple reversal for display — handles basic Arabic text
  return text.split("").reverse().join("");
}

// ---- Helper: Draw horizontal line ----

function drawLine(
  doc: jsPDF,
  y: number,
  options?: { color?: [number, number, number]; width?: number }
): void {
  const { color = [0, 0, 0], width = 0.5 } = options ?? {};
  doc.setDrawColor(...color);
  doc.setLineWidth(width);
  doc.line(PAGE_MARGIN, y, doc.internal.pageSize.getWidth() - PAGE_MARGIN, y);
}

// ---- Helper: Draw a field row ----

function drawFieldRow(
  doc: jsPDF,
  label: string,
  value: string,
  y: number,
  labelX: number,
  valueX: number
): void {
  doc.setFont(RTL_FONT, "normal");
  doc.setFontSize(10);
  doc.setTextColor(120, 120, 120);
  const reversedLabel = reverseArabic(label);
  doc.text(reversedLabel, doc.internal.pageSize.getWidth() - labelX, y);

  doc.setFont(RTL_FONT, "bold");
  doc.setFontSize(11);
  doc.setTextColor(30, 30, 30);
  const reversedValue = reverseArabic(value);
  doc.text(reversedValue, doc.internal.pageSize.getWidth() - valueX, y);
}

// ---- Format: Case Summary ----

export async function generateCaseSummaryPDF(data: CasePDFData): Promise<Blob> {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  await loadArabicFont(doc);

  const pageWidth = doc.internal.pageSize.getWidth();
  let y = PAGE_MARGIN;

  // Header
  drawRTLText(doc, "CRIM-SYS 2026 — نظام إدارة القضايا الجنائية", PAGE_MARGIN, y, {
    fontSize: 8,
    color: [150, 150, 150],
  });
  y += 8;
  drawLine(doc, y, { color: [200, 200, 200] });
  y += 10;

  // Title
  drawRTLText(doc, "ملخص القضية", PAGE_MARGIN, y, {
    fontSize: 18,
    fontStyle: "bold",
  });
  y += 4;
  drawRTLText(doc, data.case.case_no, PAGE_MARGIN, y, {
    fontSize: 14,
    color: [52, 73, 94],
  });
  y += 8;
  drawLine(doc, y);
  y += 10;

  // Case Info Section
  const fields: [string, string][] = [
    ["كود القضية", data.case.case_code],
    ["رقم القضية", data.case.case_no],
    ["العميل", data.client.full_name],
    ["الرقم القومي", data.client.national_id],
    ["المحكمة", data.case.court_name],
    ["تاريخ التقديم", data.case.filing_date],
    ["حالة القضية", data.case.procedural_status ?? "أخرى"],
    ["التصنيف التكتيكي", data.case.tactical_classification ?? "—"],
    ["الدفاع الأساسي", data.defense?.name ?? "—"],
    ["الكفالة (ج.م)", Number(data.case.bail_amount_egp).toLocaleString("ar-EG")],
    ["حكم أول درجة", data.case.first_instance_ruling ?? "—"],
    ["تاريخ جلسة المعارضة", data.case.opposition_hearing_date ?? "—"],
  ];

  fields.forEach(([label, value]) => {
    drawFieldRow(doc, label, value, y, 80, 20);
    y += 8;
  });

  // Procedural Stage
  if (data.stage) {
    y += 5;
    drawLine(doc, y);
    y += 8;
    drawRTLText(doc, "المرحلة الإجرائية", PAGE_MARGIN, y, {
      fontSize: 14,
      fontStyle: "bold",
    });
    y += 10;

    const stageFields: [string, string][] = [
      ["حالة الكفالة", data.stage.bail_payment_status],
      ["حالة الاستئناف", data.stage.appeal_status],
      ["حالة الطعن بالنقض", data.stage.cassation_status],
      ["تاريخ التقادم", data.stage.prescription_date ?? "—"],
      ["حكم المعارضة", data.stage.opposition_ruling_date ?? "—"],
    ];

    stageFields.forEach(([label, value]) => {
      drawFieldRow(doc, label, value, y, 80, 20);
      y += 8;
    });
  }

  // Notes
  if (data.case.memo_notes) {
    y += 5;
    drawLine(doc, y);
    y += 8;
    drawRTLText(doc, "ملاحظات", PAGE_MARGIN, y, {
      fontSize: 14,
      fontStyle: "bold",
    });
    y += 10;
    drawRTLText(doc, data.case.memo_notes, PAGE_MARGIN, y, {
      fontSize: 10,
    });
  }

  // Footer
  const footerY = doc.internal.pageSize.getHeight() - 15;
  drawLine(doc, footerY, { color: [200, 200, 200] });
  drawRTLText(
    doc,
    `تم الإنشاء: ${new Date().toLocaleDateString("ar-EG")} — CRIM-SYS 2026`,
    PAGE_MARGIN,
    footerY + 6,
    { fontSize: 8, color: [150, 150, 150] }
  );

  return doc.output("blob");
}

// ---- Format: Bail Receipt ----

export async function generateBailReceiptPDF(data: BailReceiptPDFData): Promise<Blob> {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  await loadArabicFont(doc);

  let y = PAGE_MARGIN;

  // Header
  drawRTLText(doc, "CRIM-SYS 2026", PAGE_MARGIN, y, {
    fontSize: 8,
    color: [150, 150, 150],
  });
  y += 10;
  drawLine(doc, y);
  y += 12;

  // Title
  drawRTLText(doc, "إيصال الكفالة", PAGE_MARGIN, y, {
    fontSize: 20,
    fontStyle: "bold",
  });
  y += 4;
  drawRTLText(doc, `رقم الإيصال: ${data.receiptNumber}`, PAGE_MARGIN, y, {
    fontSize: 10,
    color: [100, 100, 100],
  });
  y += 10;
  drawLine(doc, y);
  y += 12;

  // Receipt details
  const fields: [string, string][] = [
    ["رقم القضية", data.case.case_no],
    ["كود القضية", data.case.case_code],
    ["اسم المتهم", data.client.full_name],
    ["الرقم القومي", data.client.national_id],
    ["المحكمة", data.case.court_name],
    ["مبلغ الكفالة الكلي", `${Number(data.bailAmount).toLocaleString("ar-EG")} ج.م`],
    ["المبلغ المدفوع", `${Number(data.paidAmount).toLocaleString("ar-EG")} ج.م`],
    ["تاريخ الدفع", data.paymentDate],
  ];

  fields.forEach(([label, value]) => {
    drawFieldRow(doc, label, value, y, 85, 20);
    y += 9;
  });

  // Footer
  const footerY = doc.internal.pageSize.getHeight() - 25;
  drawLine(doc, footerY, { color: [200, 200, 200] });
  y = footerY + 8;

  drawRTLText(doc, "توقيع المحامي: _______________", PAGE_MARGIN, y, {
    fontSize: 11,
  });
  y += 10;
  drawRTLText(doc, `التاريخ: ${new Date().toLocaleDateString("ar-EG")}`, PAGE_MARGIN, y, {
    fontSize: 10,
    color: [100, 100, 100],
  });

  return doc.output("blob");
}

// ---- Format: Legal Memo ----

export async function generateLegalMemoPDF(data: LegalMemoPDFData): Promise<Blob> {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  await loadArabicFont(doc);

  let y = PAGE_MARGIN;

  // Header
  drawRTLText(doc, "CRIM-SYS 2026", PAGE_MARGIN, y, {
    fontSize: 8,
    color: [150, 150, 150],
  });
  y += 10;
  drawLine(doc, y);
  y += 12;

  // Title
  drawRTLText(doc, data.memoTitle, PAGE_MARGIN, y, {
    fontSize: 18,
    fontStyle: "bold",
  });
  y += 8;
  drawRTLText(doc, `قضية: ${data.case.case_no}`, PAGE_MARGIN, y, {
    fontSize: 12,
    color: [52, 73, 94],
  });
  y += 4;
  drawRTLText(doc, `إعداد: ${data.authorName}`, PAGE_MARGIN, y, {
    fontSize: 10,
    color: [100, 100, 100],
  });
  y += 10;
  drawLine(doc, y);
  y += 12;

  // Memo body (wrapped)
  doc.setFont(RTL_FONT, "normal");
  doc.setFontSize(11);
  doc.setTextColor(30, 30, 30);

  const lines = doc.splitTextToSize(
    reverseArabic(data.memoBody),
    doc.internal.pageSize.getWidth() - PAGE_MARGIN * 2
  );
  lines.forEach((line: string) => {
    if (y > 260) {
      doc.addPage();
      y = PAGE_MARGIN;
    }
    doc.text(line, doc.internal.pageSize.getWidth() - PAGE_MARGIN, y);
    y += 6;
  });

  // Legal disclaimer
  y += 10;
  drawLine(doc, y, { color: [192, 57, 43] });
  y += 8;
  drawRTLText(
    doc,
    "⚠️ نتيجة تقديرية استرشادية — يجب التحقق منها مع المحامي المختص قبل اتخاذ أي إجراء.",
    PAGE_MARGIN,
    y,
    { fontSize: 9, color: [192, 57, 43] }
  );

  // Footer
  const footerY = doc.internal.pageSize.getHeight() - 15;
  drawLine(doc, footerY, { color: [200, 200, 200] });
  drawRTLText(
    doc,
    `CRIM-SYS 2026 — ${new Date().toLocaleDateString("ar-EG")}`,
    PAGE_MARGIN,
    footerY + 6,
    { fontSize: 8, color: [150, 150, 150] }
  );

  return doc.output("blob");
}

// ---- Format: Hearing Report ----

export async function generateHearingReportPDF(data: CasePDFData): Promise<Blob> {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  await loadArabicFont(doc);

  let y = PAGE_MARGIN;

  drawRTLText(doc, "CRIM-SYS 2026", PAGE_MARGIN, y, {
    fontSize: 8,
    color: [150, 150, 150],
  });
  y += 10;
  drawLine(doc, y);
  y += 12;

  drawRTLText(doc, "تقرير الجلسة", PAGE_MARGIN, y, {
    fontSize: 18,
    fontStyle: "bold",
  });
  y += 8;
  drawRTLText(doc, `${data.case.case_no} — ${data.client.full_name}`, PAGE_MARGIN, y, {
    fontSize: 12,
    color: [52, 73, 94],
  });
  y += 12;
  drawLine(doc, y);
  y += 12;

  const fields: [string, string][] = [
    ["رقم القضية", data.case.case_no],
    ["العميل", data.client.full_name],
    ["المحكمة", data.case.court_name],
    ["تاريخ جلسة المعارضة", data.case.opposition_hearing_date ?? "لم تحدد"],
    ["حالة القضية", data.case.procedural_status ?? "أخرى"],
  ];

  fields.forEach(([label, value]) => {
    drawFieldRow(doc, label, value, y, 80, 20);
    y += 9;
  });

  if (data.schedules && data.schedules.length > 0) {
    y += 5;
    drawRTLText(doc, "الجلسات القادمة", PAGE_MARGIN, y, {
      fontSize: 14,
      fontStyle: "bold",
    });
    y += 10;

    data.schedules.forEach((s) => {
      drawRTLText(doc, `${s.session_type} — ${s.session_date}`, PAGE_MARGIN, y, {
        fontSize: 10,
      });
      y += 7;
    });
  }

  const footerY = doc.internal.pageSize.getHeight() - 15;
  drawLine(doc, footerY, { color: [200, 200, 200] });
  drawRTLText(
    doc,
    `CRIM-SYS 2026 — ${new Date().toLocaleDateString("ar-EG")}`,
    PAGE_MARGIN,
    footerY + 6,
    { fontSize: 8, color: [150, 150, 150] }
  );

  return doc.output("blob");
}

// ---- Public API ----

export async function generatePDF(
  format: PDFGeneratorFormat,
  data: CasePDFData | LegalMemoPDFData | BailReceiptPDFData
): Promise<Blob> {
  switch (format) {
    case "case-summary":
      return generateCaseSummaryPDF(data as CasePDFData);
    case "bail-receipt":
      return generateBailReceiptPDF(data as BailReceiptPDFData);
    case "legal-memo":
      return generateLegalMemoPDF(data as LegalMemoPDFData);
    case "hearing-report":
      return generateHearingReportPDF(data as CasePDFData);
    default:
      throw new Error(`Unknown PDF format: ${format}`);
  }
}

/**
 * Download a generated PDF blob
 */
export function downloadPDF(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
