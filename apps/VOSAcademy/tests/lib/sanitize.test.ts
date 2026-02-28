import { describe, expect, it } from 'vitest';

import { sanitizeHtml } from '../../src/lib/sanitize';

describe('sanitizeHtml', () => {
  it('should preserve safe HTML', () => {
    const safe = '<p>Hello <strong>World</strong></p>';
    expect(sanitizeHtml(safe)).toBe(safe);
  });

  it('should remove script tags', () => {
    const malicious = '<script>alert("xss")</script><p>Hello</p>';
    expect(sanitizeHtml(malicious)).toBe('<p>Hello</p>');
  });

  it('should remove event handlers', () => {
    const malicious = '<img src="x" onerror="alert(1)">';
    expect(sanitizeHtml(malicious)).toBe('<img src="x">');
  });

  it('should handle target="_blank" by adding rel="noopener noreferrer"', () => {
    const link = '<a href="https://example.com" target="_blank">Link</a>';
    expect(sanitizeHtml(link)).toContain('rel="noopener noreferrer"');
  });

  it('should allow simple formatting', () => {
      const formatting = '<h1>Title</h1><ul><li>Item</li></ul>';
      expect(sanitizeHtml(formatting)).toBe(formatting);
  });
});
