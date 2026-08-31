// ============================================================
// CRIM-SYS 2026 — OCR Scanner Module
// Client-side OCR using tesseract.js for Arabic document recognition
// Zero external API dependencies — fully offline-capable
// ============================================================

import { createWorker, type Worker } from "tesseract.js";
import type { OCRResult, ExtractedFields, OCRProcessingLog } from "@/lib/open-source";

// ---- Worker Pool ----

let workerPool: Worker | null = null;

async function getWorker(): Promise<Worker> {
  if (!workerPool) {
    workerPool = await createWorker(["ara", "eng"], 1, {
      logger: (m) => {
        if (m.status === "recognizing text") {
          // Progress callback handled by caller
        }
      },
    });
  }
  return workerPool;
}

// ---- Regex Patterns for Egyptian Documents ----

const patterns = {
  // Egyptian National ID: exactly 14 digits
  nationalId: /\b\d{14}\b/g,
  // Case numbers: various formats like "ج/12345/2026" or "12345/2026"
  caseNo: /\b(?:ج|م|ع|ق)\/?\s*\d{1,5}\/?\s*\d{4}\b/gi,
  // Bail amounts: "الكفالة" followed by numbers
  bailAmount: /(?:الكفالة|كفالة|مبلغ)\s*[:：]?\s*(\d[\d,.]*)\s*(?:ج.م|جنيه|EGP)?/gi,
  // Judge names: "القاضي" or "فضيلة" followed by name
  judgeName: /(?:القاضي|فضيلة السيد|المستشار|المحامى)\s+(.+)/gi,
  // Court names
  courtName: /(?:محكمة|نيابة|قسم)\s+(?:ال\w+\s*)+/gi,
  // Dates in DD/MM/YYYY or DD-MM-YYYY format
  date: /\b(\d{1,2})[/-](\d{1,2})[/-](\d{4})\b/g,
};

// ---- Field Extraction ----

export function extractFields(text: string): ExtractedFields {
  const nationalIdMatch = text.match(patterns.nationalId);
  const caseNoMatch = text.match(patterns.caseNo);
  const bailMatch = text.match(patterns.bailAmount);
  const judgeMatch = text.match(patterns.judgeName);
  const courtMatch = text.match(patterns.courtName);
  const dateMatch = text.match(patterns.date);

  // Extract bail amount as number
  let bailAmount: number | null = null;
  if (bailMatch?.[0]) {
    const amountStr = bailMatch[0].replace(/[^\d,.]/g, "").replace(/,/g, "");
    const parsed = parseFloat(amountStr);
    if (!isNaN(parsed)) bailAmount = parsed;
  }

  // Parse date (first found)
  let filingDate: string | null = null;
  if (dateMatch?.[0]) {
    const [, day, month, year] = dateMatch[0].match(/(\d{1,2})[/-](\d{1,2})[/-](\d{4})/) ?? [];
    if (day && month && year) {
      filingDate = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
    }
  }

  return {
    nationalId: nationalIdMatch?.[0] ?? null,
    caseNo: caseNoMatch?.[0] ?? null,
    bailAmount,
    judgeName: judgeMatch?.[1]?.trim() ?? null,
    courtName: courtMatch?.[0] ?? null,
    filingDate,
  };
}

// ---- Core OCR Functions ----

/**
 * Process an image file and extract text using tesseract.js
 */
export async function processImage(
  file: File | Blob,
  onProgress?: (progress: number) => void
): Promise<OCRResult> {
  const worker = await getWorker();

  onProgress?.(0.1);

  // Convert to image data URL
  const imageData = await fileToDataURL(file);

  onProgress?.(0.2);

  // Recognize text
  const { data } = await worker.recognize(imageData);

  onProgress?.(1.0);

  return {
    text: data.text,
    confidence: data.confidence,
    language: data.text ? "mixed" : "eng",
  };
}

/**
 * Process a file and extract structured fields
 */
export async function processDocument(
  file: File | Blob,
  onProgress?: (progress: number) => void
): Promise<OCRProcessingLog> {
  const result = await processImage(file, onProgress);
  const extractedFields = extractFields(result.text);

  return {
    attachmentId: "", // Set by caller when saving
    extractedText: result.text,
    confidenceScore: result.confidence,
    extractedFields,
    processedAt: new Date().toISOString(),
  };
}

/**
 * Process multiple files in batch
 */
export async function processBatch(
  files: (File | Blob)[],
  onProgress?: (fileIndex: number, progress: number) => void
): Promise<OCRProcessingLog[]> {
  const results: OCRProcessingLog[] = [];

  for (let i = 0; i < files.length; i++) {
    const result = await processDocument(files[i], (progress) => {
      onProgress?.(i, progress);
    });
    results.push(result);
  }

  return results;
}

// ---- Helpers ----

function fileToDataURL(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Clean up worker when done
 */
export async function terminateOCR(): Promise<void> {
  if (workerPool) {
    await workerPool.terminate();
    workerPool = null;
  }
}
