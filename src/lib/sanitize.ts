/**
 * Minimal HTML Sanitizer
 *
 * Strips dangerous HTML tags/attributes while preserving safe formatting
 * (bold, italic, links) from AI-generated legal text.
 *
 * Used before any dangerouslySetInnerHTML usage to prevent XSS.
 */

const DANGEROUS_PROTOCOLS = /^(javascript|data|vbscript|file):/i;
const EGYPTIAN_NATIONAL_ID = /(?:\d[ -]?){14}/g;
const EGYPTIAN_MOBILE = /01\d{9}/g;

/** Display-safe national ID: only the last four digits are retained. */
export function maskNationalId(value: string | null | undefined): string {
  const digits = String(value ?? '').replace(/\D/g, '');
  return digits.length >= 4 ? `****${digits.slice(-4)}` : '';
}

/** Display-safe Egyptian mobile number. */
export function maskPhone(value: string | null | undefined): string {
  const digits = String(value ?? '').replace(/\D/g, '');
  return digits.length >= 2 ? `*******${digits.slice(-2)}` : '';
}

/** Scrub PII from free text before it enters logs, cache, or local backups. */
export function scrubSensitiveText(value: string): string {
  return value
    .replace(EGYPTIAN_NATIONAL_ID, (match) => maskNationalId(match.replace(/\D/g, '')))
    .replace(EGYPTIAN_MOBILE, (match) => maskPhone(match));
}

/** Deeply sanitize records written to device-local storage. */
export function sanitizeForLocalStorage<T>(value: T): T {
  if (Array.isArray(value)) return value.map(sanitizeForLocalStorage) as T;
  if (value && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      if (key === 'national_id' || key === 'national_id_encrypted') {
        result[key] = maskNationalId(String(item ?? ''));
      } else if (key === 'phone' || key === 'phone_optional') {
        result[key] = item ? maskPhone(String(item)) : item;
      } else if (typeof item === 'string') {
        result[key] = scrubSensitiveText(item);
      } else {
        result[key] = sanitizeForLocalStorage(item);
      }
    }
    return result as T;
  }
  return value;
}

/**
 * Sanitize an HTML string to remove dangerous tags and attributes.
 */
export function sanitizeHtml(html: string): string {
  // Remove script, style, iframe, object, embed, form tags and their content
  let cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, '')
    .replace(/<object[\s\S]*?<\/object>/gi, '')
    .replace(/<embed[\s\S]*?\/?>/gi, '')
    .replace(/<form[\s\S]*?<\/form>/gi, '');

  // Remove on* event handlers
  cleaned = cleaned.replace(/\son\w+\s*=\s*["'][^"']*["']/gi, '');

  // Remove dangerous protocol hrefs
  cleaned = cleaned.replace(/href\s*=\s*["']([^"']*)["']/gi, (_match, url) => {
    if (DANGEROUS_PROTOCOLS.test(url)) {
      return 'href="#"';
    }
    return `href="${url}"`;
  });

  return cleaned;
}

/**
 * Safe markdown-to-HTML for legal agent responses.
 * Only allows bold, bullet points, and basic formatting.
 */
export function safeMarkdownToHtml(text: string): string {
  let html = text;

  // Bold
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

  // Convert newlines to <br>
  html = html.replace(/\n/g, '<br>');

  // Sanitize the result
  return sanitizeHtml(html);
}
