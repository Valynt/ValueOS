import DOMPurify from 'dompurify';

const DEFAULT_CONFIG: DOMPurify.Config = {
  ALLOWED_TAGS: [
    'a', 'b', 'blockquote', 'br', 'code', 'div', 'em',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'hr', 'i', 'img',
    'li', 'ol', 'p', 'pre', 'span', 'strong',
    'table', 'tbody', 'td', 'tfoot', 'th', 'thead', 'tr', 'ul',
  ],
  ALLOWED_ATTR: ['alt', 'class', 'height', 'href', 'rel', 'src', 'target', 'title', 'width'],
  FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form', 'input'],
  FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur'],
  ALLOW_DATA_ATTR: false,
  // Explicit scheme allowlist: only https, http, mailto, and tel are permitted.
  // Relative URLs, data: URIs, javascript:, and all other schemes are rejected.
  ALLOWED_URI_REGEXP: /^(?:https?|mailto|tel):/i,
};

// Enforce rel="noopener noreferrer" on all target="_blank" links
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A' && node.getAttribute('target') === '_blank') {
    node.setAttribute('rel', 'noopener noreferrer');
  }
});

export function sanitizeHtml(dirty: string): string {
  if (!dirty) return '';
  return DOMPurify.sanitize(dirty, DEFAULT_CONFIG) as string;
}
