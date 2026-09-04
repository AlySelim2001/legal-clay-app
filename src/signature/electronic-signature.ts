/**
 * Free Electronic Signature — CRIM-SYS 2026
 *
 * Browser-safe implementation of the digital-signature sketch. The
 * original imported Node-only APIs (`crypto`'s sign/verify and
 * `child_process`-style flows) that cannot run in a Vite browser app.
 * This version keeps the same public contract — `signDocument()` /
 * `verifySignature()` — using what actually ships in the browser:
 *
 *   1. PDF handling        → pdf-lib (load any uploaded PDF, append a
 *                            signed certificate page, save).
 *   2. Key generation      → WebCrypto ECDSA P-256, generated locally
 *                            and persisted as JWK in the app's
 *                            offline-first IndexedDB layer.
 *   3. Digital signature   → ECDSA (P-256, SHA-256) over a payload
 *                            binding the original document hash, the
 *                            signed-PDF hash, the signer, and the
 *                            timestamp. Any modification of the file
 *                            changes its hash and invalidates the
 *                            stored record (tamper detection).
 *   4. Arabic certificate  → rendered on a <canvas> (browser text
 *                            shaping, correct RTL) and embedded in the
 *                            PDF as an image — pdf-lib itself cannot
 *                            shape Arabic.
 *
 * Compliance frame: قانون التوقيع الإلكتروني المصري رقم 15 لسنة 2004
 * (Law 15/2004) — the certificate page cites it; real ITIDA-licensed
 * certificates remain the formal route for official filings.
 */

import { PDFDocument } from "pdf-lib";
import { cacheData, getCachedData } from "@/lib/open-source/offline-sync";

// ============================================================
// Types
// ============================================================

export interface SignerInfo {
  /** Full name as shown on the ID. */
  name: string;
  /** Bar association / license number (رقم النقابة). */
  barLicense?: string;
  /** Role, e.g. "محامٍ بالنقض" أو "الموكل". */
  role?: string;
}

export interface SignedDocument {
  certificateId: string;
  /** SHA-256 of the ORIGINAL uploaded PDF bytes. */
  docHash: string;
  /** SHA-256 of the final signed PDF (the artifact that is downloaded). */
  artifactHash: string;
  /** ECDSA signature (base64url, raw 64-byte r||s). */
  signature: string;
  algorithm: string;
  signedAt: string; // ISO 8601
  signer: Required<Pick<SignerInfo, "name">> & SignerInfo;
  fileName: string;
  fileSize: number;
  compliantWithEgyptianLaw: true;
  /** Signed PDF bytes — download these. */
  pdfBytes: Uint8Array;
}

export interface SignatureRecord {
  id: string;
  type: "e_signature";
  certificateId: string;
  docHash: string;
  artifactHash: string;
  signature: string;
  algorithm: string;
  signedAt: string;
  signer: SignerInfo;
  fileName: string;
  fileSize: number;
  /** Public JWK so signatures can be re-verified later without the keypair. */
  publicKeyJwk: JsonWebKey;
  /** Short thumbprint of the public key (display only). */
  keyFingerprint: string;
  createdAt: string;
}

export interface SignatureKeyRecord {
  id: string;
  type: "e_signature_keypair";
  publicKeyJwk: JsonWebKey;
  privateKeyJwk: JsonWebKey;
  keyFingerprint: string;
  createdAt: string;
}

export interface SignatureVerificationResult {
  valid: boolean;
  /** True when a stored record matches this file's hash but ECDSA failed. */
  tampered: boolean | null;
  signedBy: string | null;
  signedAt: string | null;
  certificateId: string | null;
  message: string;
}

// ============================================================
// Small helpers
// ============================================================

const KEYPAIR_STORE_ID = "esign:keypair";

/** Copy into an ArrayBuffer-backed view (TS BufferSource requires it). */
function toBytes(input: Uint8Array | string): Uint8Array<ArrayBuffer> {
  const encoded =
    typeof input === "string" ? new TextEncoder().encode(input) : input;
  const out = new Uint8Array(encoded.byteLength);
  out.set(encoded);
  return out;
}

async function sha256Hex(input: Uint8Array | string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", toBytes(input));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function bytesFromBase64Url(value: string): Uint8Array<ArrayBuffer> {
  const b64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = b64.padEnd(b64.length + ((4 - (b64.length % 4)) % 4), "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function publicKeyThumbprint(jwk: JsonWebKey): Promise<string> {
  const stable = JSON.stringify({
    kty: jwk.kty,
    crv: jwk.crv,
    x: jwk.x,
    y: jwk.y,
  });
  const hex = await sha256Hex(stable);
  return hex.slice(0, 12);
}

/** Canonical payload — the exact object signed & re-verified. */
interface SigningPayload {
  v: number;
  algorithm: string;
  certificateId: string;
  docHash: string;
  artifactHash: string;
  signedAt: string;
  signer: SignerInfo;
  publicKeyJwk: JsonWebKey;
}

const ECDSA_ALGO: EcKeyAlgorithm = { name: "ECDSA", namedCurve: "P-256" };

// ============================================================
// Key management (offline IndexedDB — the "locally generated" key)
// ============================================================

let cachedKey: SignatureKeyRecord | null = null;

async function findRecord<T extends { type: string }>(
  storeType: string,
): Promise<T | undefined> {
  const all = (await getCachedData("attachments")) as T[];
  return all.find((r) => r.type === storeType);
}

/**
 * Get (or create) the locally generated ECDSA keypair.
 * The private key never leaves the device / IndexedDB.
 */
export async function getOrCreateSigningKey(): Promise<SignatureKeyRecord> {
  if (cachedKey) return cachedKey;

  const existing = await findRecord<SignatureKeyRecord>("e_signature_keypair");
  if (existing) {
    cachedKey = existing;
    return existing;
  }

  const pair = await crypto.subtle.generateKey(ECDSA_ALGO, true, ["sign", "verify"]);
  const publicKeyJwk = await crypto.subtle.exportKey("jwk", pair.publicKey);
  const privateKeyJwk = await crypto.subtle.exportKey("jwk", pair.privateKey);

  const record: SignatureKeyRecord = {
    id: KEYPAIR_STORE_ID,
    type: "e_signature_keypair",
    publicKeyJwk,
    privateKeyJwk,
    keyFingerprint: await publicKeyThumbprint(publicKeyJwk),
    createdAt: new Date().toISOString(),
  };

  await cacheData("attachments", record);
  cachedKey = record;
  return record;
}

/** Identity of the local signing key (for display). */
export async function getSigningIdentity(): Promise<{
  keyFingerprint: string;
  createdAt: string;
} | null> {
  try {
    const key = await getOrCreateSigningKey();
    return { keyFingerprint: key.keyFingerprint, createdAt: key.createdAt };
  } catch {
    return null;
  }
}

// ============================================================
// Arabic signature certificate → canvas → PNG (browser shaping)
// ============================================================

const A4_PT: [number, number] = [595.28, 841.89]; // width, height (portrait)
const SCALE = 2;

function wrapArabic(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const lines: string[] = [];
  let line = "";
  // Split on words; Arabic lines flow RTL automatically once drawn with
  // direction-aware fill (we draw with textAlign right, so order holds).
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

/** Render a full-page Arabic signature certificate and return PNG bytes. */
async function renderCertificatePage(
  opts: {
    certificateId: string;
    signer: SignerInfo;
    signedAt: string;
    docHash: string;
    algorithm: string;
    keyFingerprint: string;
  },
): Promise<Uint8Array> {
  const width = Math.round(A4_PT[0] * SCALE);
  const height = Math.round(A4_PT[1] * SCALE);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("تعذر تجهيز صفحة الشهادة");

  const margin = Math.round(width * 0.08);
  const innerW = width - margin * 2;

  // Background (clay paper)
  ctx.fillStyle = "#faf6ef";
  ctx.fillRect(0, 0, width, height);

  // Header band
  ctx.fillStyle = "#6d4c8f"; // clay-purple
  ctx.fillRect(0, 0, width, Math.round(height * 0.13));
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `700 ${Math.round(width * 0.032)}px "Cairo", "Noto Kufi Arabic", "Segoe UI", Tahoma, sans-serif`;
  ctx.fillText("شهادة التوقيع الرقمي الموثّق", width / 2, Math.round(height * 0.048));
  ctx.font = `500 ${Math.round(width * 0.017)}px "Cairo", "Noto Kufi Arabic", Tahoma, sans-serif`;
  ctx.fillStyle = "#efe6f9";
  ctx.fillText(
    "CRIM-SYS 2026 — التوقيع الرقمي الإلكتروني للمستندات",
    width / 2,
    Math.round(height * 0.095),
  );

  // Body
  let y = Math.round(height * 0.165);
  ctx.textAlign = "right";

  const label = (text: string): void => {
    ctx.font = `600 ${Math.round(width * 0.0175)}px "Cairo", "Noto Kufi Arabic", Tahoma, sans-serif`;
    ctx.fillStyle = "#6d4c8f";
    ctx.fillText(text, width - margin, y);
    y += Math.round(height * 0.03);
  };
  const value = (text: string, mono = false): void => {
    ctx.font = mono
      ? `500 ${Math.round(width * 0.0145)}px "JetBrains Mono", Consolas, monospace`
      : `500 ${Math.round(width * 0.018)}px "Cairo", "Noto Kufi Arabic", Tahoma, sans-serif`;
    ctx.fillStyle = "#2b2620";
    ctx.direction = "rtl";
    for (const line of wrapArabic(ctx, text, innerW)) {
      ctx.fillText(line, width - margin, y);
      y += Math.round(height * 0.026);
    }
  };

  // Law citation badge
  ctx.direction = "ltr";
  ctx.font = `600 ${Math.round(width * 0.016)}px "Cairo", Tahoma, sans-serif`;
  const badge = "⚖️ قانون التوقيع الإلكتروني المصري رقم 15 لسنة 2004 — هيئة تنمية صناعة تكنولوجيا المعلومات (ITIDA)";
  ctx.textAlign = "center";
  ctx.fillStyle = "#f1c40f";
  ctx.fillRect(0, Math.round(height * 0.135), width, Math.round(height * 0.022));
  ctx.fillStyle = "#4a3a12";
  ctx.fillText(badge, width / 2, Math.round(height * 0.147));
  ctx.textAlign = "right";
  y += Math.round(height * 0.03);

  // The artifact hash of the final signed file is stored in the offline
  // record (it can only be known after saving), so the printed page shows
  // the original-document hash — both are bound by the ECDSA signature.
  const fields: Array<{ l: string; v: string; mono?: boolean }> = [
    { l: "الموقّع", v: opts.signer.name },
    { l: "رقم النقابة / الترخيص", v: opts.signer.barLicense ?? "—" },
    { l: "الصفة", v: opts.signer.role ?? "محامٍ" },
    { l: "تاريخ التوقيع", v: new Date(opts.signedAt).toLocaleString("ar-EG") },
    { l: "رقم الشهادة", v: opts.certificateId, mono: true },
    { l: "الخوارزمية", v: opts.algorithm, mono: true },
    { l: "بصمة المستند الموقَّع (SHA-256)", v: opts.docHash, mono: true },
    { l: "بصمة مفتاح التوقيع", v: opts.keyFingerprint, mono: true },
  ];

  for (const field of fields) {
    label(field.l);
    value(field.v, field.mono);
    y += Math.round(height * 0.008);
  }

  // Seal box
  const boxY = Math.round(height * 0.8);
  roundedRect(ctx, margin, boxY, innerW, Math.round(height * 0.075), 16);
  ctx.fillStyle = "#f3ead9";
  ctx.fill();
  ctx.strokeStyle = "#c8b38a";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = "#6b5840";
  ctx.font = `600 ${Math.round(width * 0.017)}px "Cairo", Tahoma, sans-serif`;
  ctx.direction = "rtl";
  ctx.textAlign = "right";
  const sealLines = wrapArabic(
    ctx,
    "التحقق من صحة هذا التوقيع يتم داخل تطبيق CRIM-SYS 2026 (التوقيع الرقمي للمستندات) — أي تعديل على الملف يُبطل التوقيع.",
    innerW - Math.round(width * 0.03),
  );
  sealLines.forEach((line, i) => {
    ctx.fillText(
      line,
      width - margin - Math.round(width * 0.015),
      boxY + Math.round(height * 0.025) + i * Math.round(height * 0.021),
    );
  });

  // Footer
  ctx.font = `500 ${Math.round(width * 0.0125)}px "Cairo", Tahoma, sans-serif`;
  ctx.fillStyle = "#9a8b76";
  ctx.textAlign = "center";
  ctx.direction = "ltr";
  ctx.fillText(
    "صدرت من CRIM-SYS 2026 — نسخة استرشادية للتوقيع الرقمي الحر · قانون 15/2004",
    width / 2,
    height - Math.round(height * 0.03),
  );

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/png"),
  );
  if (!blob) throw new Error("تعذر إنشاء صفحة الشهادة");
  return new Uint8Array(await blob.arrayBuffer());
}

// ============================================================
// Electronic Signature Service
// ============================================================

export class FreeElectronicSignature {
  /**
   * Digitally sign a PDF document:
   *  1. hash the original bytes,
   *  2. append a rendered Arabic certificate page,
   *  3. ECDSA-sign a payload binding (docHash · artifactHash · signer · time),
   *  4. persist the verification record offline.
   */
  async signDocument(
    pdfBuffer: Uint8Array | ArrayBuffer,
    signerInfo: SignerInfo,
    fileName = "document.pdf",
  ): Promise<SignedDocument> {
    if (!pdfBuffer || (pdfBuffer as ArrayBuffer).byteLength === 0) {
      throw new Error("الملف فارغ — لا يمكن توقيعه");
    }
    if (!signerInfo.name.trim()) throw new Error("يجب إدخال اسم الموقّع");

    const key = await getOrCreateSigningKey();
    const source =
      pdfBuffer instanceof Uint8Array
        ? pdfBuffer.slice()
        : new Uint8Array(pdfBuffer);

    // 1) Load the original PDF and fingerprint it.
    const docHash = await sha256Hex(source);
    let pdf: PDFDocument;
    try {
      pdf = await PDFDocument.load(source, { ignoreEncryption: true });
    } catch {
      throw new Error("الملف المحدد ليس ملف PDF صالحاً");
    }

    // 2) Append the certificate page (canvas-rendered Arabic, doc hash
    //    known upfront; the artifact hash is recorded after saving).
    const certificateId = `sig-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
    const signedAt = new Date().toISOString();
    const page = pdf.addPage([A4_PT[0], A4_PT[1]]);
    const certPng = await renderCertificatePage({
      certificateId,
      signer: { name: signerInfo.name, barLicense: signerInfo.barLicense, role: signerInfo.role },
      signedAt,
      docHash,
      algorithm: "ECDSA P-256 (SHA-256)",
      keyFingerprint: key.keyFingerprint,
    });
    const pngImage = await pdf.embedPng(certPng);
    page.drawImage(pngImage, { x: 0, y: 0, width: A4_PT[0], height: A4_PT[1] });

    const artifactBytes = await pdf.save();
    const artifactHash = await sha256Hex(artifactBytes);

    // 3) Sign the binding payload.
    const payload: SigningPayload = {
      v: 1,
      algorithm: "ECDSA P-256 (SHA-256)",
      certificateId,
      docHash,
      artifactHash,
      signedAt,
      signer: { name: signerInfo.name, barLicense: signerInfo.barLicense, role: signerInfo.role },
      publicKeyJwk: key.publicKeyJwk,
    };

    const privateKey = await crypto.subtle.importKey(
      "jwk",
      key.privateKeyJwk,
      ECDSA_ALGO,
      false,
      ["sign"],
    );
    const signatureRaw = new Uint8Array(
      await crypto.subtle.sign(
        { name: "ECDSA", hash: "SHA-256" },
        privateKey,
        toBytes(canonicalize(payload)),
      ),
    );

    // 4) Persist the record (offline, tamper-proof by hash binding).
    const record: SignatureRecord = {
      id: `esign-${certificateId}`,
      type: "e_signature",
      certificateId,
      docHash,
      artifactHash,
      signature: bytesToBase64Url(signatureRaw),
      algorithm: payload.algorithm,
      signedAt,
      signer: { name: signerInfo.name, barLicense: signerInfo.barLicense, role: signerInfo.role },
      fileName,
      fileSize: artifactBytes.length,
      publicKeyJwk: key.publicKeyJwk,
      keyFingerprint: key.keyFingerprint,
      createdAt: signedAt,
    };
    await cacheData("attachments", record);

    return {
      certificateId,
      docHash,
      artifactHash,
      signature: record.signature,
      algorithm: record.algorithm,
      signedAt,
      signer: { ...signerInfo, name: signerInfo.name },
      fileName,
      fileSize: artifactBytes.length,
      compliantWithEgyptianLaw: true,
      pdfBytes: artifactBytes,
    };
  }

  /**
   * Verify a signed PDF against the offline signature registry:
   *  - re-hash the submitted bytes → must equal a stored artifact hash,
   *  - ECDSA-verify the stored signature over the binding payload.
   */
  async verifySignature(signedPdf: Uint8Array | ArrayBuffer): Promise<SignatureVerificationResult> {
    const bytes =
      signedPdf instanceof Uint8Array
        ? signedPdf.slice()
        : new Uint8Array(signedPdf);
    const currentHash = await sha256Hex(bytes);
    const records = await listSignedDocuments();

    const record = records.find((r) => r.artifactHash === currentHash);
    if (!record) {
      return {
        valid: false,
        tampered: null,
        signedBy: null,
        signedAt: null,
        certificateId: null,
        message:
          "⚠️ لا يوجد سجل توقيع مطابق لهذا الملف في قاعدة التوقيعات المحلية — المستند لم يُوقَّع عبر هذا التطبيق أو تم تعديله بعد التوقيع.",
      };
    }

    try {
      const publicKey = await crypto.subtle.importKey(
        "jwk",
        record.publicKeyJwk,
        ECDSA_ALGO,
        false,
        ["verify"],
      );
      const payload: SigningPayload = {
        v: 1,
        algorithm: record.algorithm,
        certificateId: record.certificateId,
        docHash: record.docHash,
        artifactHash: record.artifactHash,
        signedAt: record.signedAt,
        signer: record.signer,
        publicKeyJwk: record.publicKeyJwk,
      };
      const ok = await crypto.subtle.verify(
        { name: "ECDSA", hash: "SHA-256" },
        publicKey,
        bytesFromBase64Url(record.signature),
        toBytes(canonicalize(payload)),
      );

      if (ok) {
        return {
          valid: true,
          tampered: false,
          signedBy: record.signer.name,
          signedAt: record.signedAt,
          certificateId: record.certificateId,
          message: "✅ التوقيع الرقمي سليم — الملف لم يتم التلاعب به والموقّع موثّق.",
        };
      }
      return {
        valid: false,
        tampered: true,
        signedBy: record.signer.name,
        signedAt: record.signedAt,
        certificateId: record.certificateId,
        message: "⚠️ فشل التحقق من التوقيع — البيانات المسجلة لا تطابق الملف المقدَّم.",
      };
    } catch {
      return {
        valid: false,
        tampered: null,
        signedBy: null,
        signedAt: null,
        certificateId: null,
        message: "تعذر التحقق — بيئة التوقيع غير متاحة (يحتاج WebCrypto عبر HTTPS).",
      };
    }
  }
}

function canonicalize(payload: SigningPayload): string {
  return JSON.stringify(payload); // stable construction order above
}

// ============================================================
// Registry helpers
// ============================================================

/** All signature records, newest first. */
export async function listSignedDocuments(): Promise<SignatureRecord[]> {
  const all = (await getCachedData("attachments")) as SignatureRecord[];
  return all
    .filter((r) => r.type === "e_signature")
    .sort((a, b) => b.signedAt.localeCompare(a.signedAt));
}

// ============================================================
// Singleton + compliance reference
// ============================================================

let signatureInstance: FreeElectronicSignature | null = null;

export function getElectronicSignature(): FreeElectronicSignature {
  if (!signatureInstance) signatureInstance = new FreeElectronicSignature();
  return signatureInstance;
}

export const PDF_SIGNATURE_LAW = {
  law: "قانون التوقيع الإلكتروني رقم 15 لسنة 2004",
  authority: "هيئة تنمية صناعة تكنولوجيا المعلومات (ITIDA)",
  notes: [
    "المفتاح يُنشأ محلياً على الجهاز ولا يغادر المتصفح أبداً.",
    "أي تعديل على الملف الموقّع يغيّر بصمته ويُبطل التوقيع فوراً.",
    "التوقيع المرسوم يدوياً + البصمة الرقمية = حجية أقوى في الإثبات.",
    "للأوراق الرسمية يلزم شهادة رقمية من جهة تصدير معتمدة لدى ITIDA.",
  ],
};
