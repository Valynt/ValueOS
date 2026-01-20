import DOMPurify from 'dompurify';

const DEFAULT_CONFIG: DOMPurify.Config = {
  ALLOWED_TAGS: [
    'a',
    'b',
    'blockquote',
    'code',
    'em',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'i',
    'li',
    'ol',
    'p',
    'pre',
    'strong',
    'ul',
    'span',
    'img',
  ],
  ALLOWED_ATTR: ['href', 'target', 'rel', 'title', 'class', 'src', 'alt', 'width', 'height'],
  ALLOW_DATA_ATTR: false,
  ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel):|[^a-z]|[a-z+.-]+(?:[^a-z+.-:]|$))/i,
};

// Add a hook to enforce rel="noopener noreferrer" on target="_blank" links
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A' && node.getAttribute('target') === '_blank') {
    node.setAttribute('rel', 'noopener noreferrer');
  }
});

export function sanitizeHtml(dirty: string): string {
  if (!dirty) return '';
  return DOMPurify.sanitize(dirty, DEFAULT_CONFIG);
}
