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
  ],
  ALLOWED_ATTR: ['href', 'target', 'rel', 'title', 'class'],
  ALLOW_DATA_ATTR: false,
  ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel):|[^a-z]|[a-z+.-]+(?:[^a-z+.-:]|$))/i,
};

export function sanitizeHtml(dirty: string): string {
  if (!dirty) return '';
  return DOMPurify.sanitize(dirty, DEFAULT_CONFIG);
}
