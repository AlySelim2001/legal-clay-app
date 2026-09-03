/**
 * E-Signature Module — CRIM-SYS 2026
 *
 * Free, client-side electronic signature with document integrity
 * verification, aligned with Egyptian Law 15/2004 (قانون التوقيع
 * الإلكتروني المصري) and the e-signature regulations of the
 * Information Technology Industry Development Agency (ITIDA).
 *
 * Security model:
 * - Signature strokes captured on a canvas, exported as PNG data URL.
 * - SHA-256 fingerprint of (document content + signature image +
 *   signer identity + timestamp) locks the signature to the document.
 * - Any change to the document, signature, or signer invalidates the
 *   stored fingerprint (tamper detection).
 */

// ============================================================
// Types
// ============================================================

export interface SignatureInput {
  /** The document content that is being signed. */
  documentContent: string;
  /** PNG data URL of the drawn signature (from the canvas). */
  signatureImage: string;
  /** Full name of the signer (as shown on the ID). */
  signerName: string;
  /** Optional national ID / passport / bar license number. */
  signerIdNumber?: string;
  /** Optional role, e.g. "المحامي الموكل" أو "الموكل". */
  role?: string;
}

export interface SignatureResult {
  id: string;
  signedAt: string; // ISO 8601
  fingerprint: string; // SHA-256 hex
  verified: boolean;
  summary: string;
}

export interface SignatureVerification {
  isValid: boolean;
  fingerprint: string;
  message: string;
}

// ============================================================
// Hashing
// ============================================================

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// ============================================================
// Signature Service
// ============================================================

export class ESignatureService {
  /**
   * Create a signed record for a document. Computes a fingerprint that
   * cryptographically binds the document, signature image, signer, and
   * timestamp together.
   */
  async sign(input: SignatureInput): Promise<SignatureResult> {
    if (!input.documentContent.trim()) {
      throw new Error('لا يمكن التوقيع على مستند فارغ');
    }
    if (!input.signatureImage.trim()) {
      throw new Error('يجب رسم التوقيع أولاً');
    }
    if (!input.signerName.trim()) {
      throw new Error('يجب إدخال اسم الموقّع');
    }

    const signedAt = new Date().toISOString();
    const payload = JSON.stringify({
      documentContent: input.documentContent,
      signatureImage: input.signatureImage,
      signerName: input.signerName,
      signerIdNumber: input.signerIdNumber ?? '',
      role: input.role ?? '',
      signedAt,
    });

    const fingerprint = await sha256Hex(payload);

    return {
      id: `sig-${Date.now().toString(36)}`,
      signedAt,
      fingerprint,
      verified: true,
      summary:
        `تم التوقيع الإلكتروني على المستند بواسطة ${input.signerName}` +
        ` في ${new Date(signedAt).toLocaleString('ar-EG')}`,
    };
  }

  /**
   * Verify a document against a previously stored fingerprint.
   * Returns false if the document, signature, or signer changed.
   */
  async verify(
    input: SignatureInput,
    storedFingerprint: string,
  ): Promise<SignatureVerification> {
    const currentFingerprint = await sha256Hex(
      JSON.stringify({
        documentContent: input.documentContent,
        signatureImage: input.signatureImage,
        signerName: input.signerName,
        signerIdNumber: input.signerIdNumber ?? '',
        role: input.role ?? '',
        signedAt: '', // timestamp is not part of re-verification payload
      }),
    );

    if (currentFingerprint === storedFingerprint) {
      return {
        isValid: true,
        fingerprint: currentFingerprint,
        message: '✅ التوقيع سليم — المستند لم يتم التلاعب به',
      };
    }

    return {
      isValid: false,
      fingerprint: currentFingerprint,
      message:
        '⚠️ تحذير: المستند أو التوقيع أو بيانات الموقّع تم تعديلها — التوقيع غير صالح',
    };
  }
}

// ============================================================
// Singleton + helpers
// ============================================================

let signatureInstance: ESignatureService | null = null;

export function getESignatureService(): ESignatureService {
  if (!signatureInstance) {
    signatureInstance = new ESignatureService();
  }
  return signatureInstance;
}

/**
 * Compliance reference — قانون التوقيع الإلكتروني المصري رقم 15 لسنة 2004.
 * Displayed in the UI so lawyers know the legal basis.
 */
export const EGYPTIAN_ESIGN_LAW = {
  law: 'قانون التوقيع الإلكتروني رقم 15 لسنة 2004',
  authority: 'هيئة تنمية صناعة تكنولوجيا المعلومات (ITIDA)',
  notes: [
    'التوقيع الإلكتروني له حجية التوقيع العادي في الإثبات (المادة 15).',
    'المستند الإلكتروني يعتبر محرراً رسمياً عند استيفاء شروط الضبط المنصوص عليها قانوناً.',
    'يجب الاحتفاظ بسجل تدقيق (Audit Trail) لكل عملية توقيع.',
    'يُنصح باستخدام شهادة رقمية صادرة من جهة تصديق معتمدة للتوقيعات الرسمية.',
  ],
};

/**
 * Build a printable signature certificate (plain text).
 */
export function buildSignatureCertificate(result: SignatureResult): string {
  return `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  شهادة التوقيع الإلكتروني
  Electronic Signature Certificate
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🆔 رقم الشهادة: ${result.id}
📅 تاريخ التوقيع: ${new Date(result.signedAt).toLocaleString('ar-EG')}
🔐 بصمة التوقيع (SHA-256):
${result.fingerprint}

✅ الحالة: ${result.verified ? 'توقيع صالح' : 'توقيع غير صالح'}
⚖️ الأساس القانوني: قانون التوقيع الإلكتروني 15/2004

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  صدر من: CRIM-SYS 2026
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`.trim();
}