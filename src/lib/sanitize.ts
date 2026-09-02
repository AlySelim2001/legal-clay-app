/**
 * Minimal HTML Sanitizer
 *
 * Strips dangerous HTML tags/attributes while preserving safe formatting
 * (bold, italic, links) from AI-generated legal text.
 *
 * Used before any dangerouslySetInnerHTML usage to prevent XSS.
 */

const DANGEROUS_PROTOCOLS = /^(javascript|data|vbscript|file):/i;

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
