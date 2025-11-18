import { describe, expect, it } from 'vitest';
import { sanitizeHtml } from '../sanitizeHtml';

describe('sanitizeHtml', () => {
  it('removes script tags', () => {
    const dirty = '<p>Hello</p><script>alert(1)</script>';
    const cleaned = sanitizeHtml(dirty);
    expect(cleaned).toBe('<p>Hello</p>');
  });

  it('strips javascript: urls', () => {
    const dirty = '<a href="javascript:alert(1)">Click</a>';
    const cleaned = sanitizeHtml(dirty);
    expect(cleaned).toBe('<a>Click</a>');
  });

  it('keeps allowed formatting', () => {
    const dirty = '<p><strong>Bold</strong> and <em>emphasis</em></p>';
    const cleaned = sanitizeHtml(dirty);
    expect(cleaned).toBe('<p><strong>Bold</strong> and <em>emphasis</em></p>');
  });

  it('removes event handlers', () => {
    const dirty = '<span onclick="alert(1)">Test</span>';
    const cleaned = sanitizeHtml(dirty);
    expect(cleaned).toBe('<span>Test</span>');
  });
});
