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

  it('adds rel="noopener noreferrer" to target="_blank" links', () => {
    const dirty = '<a href="https://example.com" target="_blank">External Link</a>';
    const cleaned = sanitizeHtml(dirty);
    expect(cleaned).toContain('rel="noopener noreferrer"');
  });

  it('allows img tags with safe attributes', () => {
    const dirty = '<img src="https://example.com/image.png" alt="Test Image" width="100" height="100">';
    const cleaned = sanitizeHtml(dirty);
    expect(cleaned).toBe('<img src="https://example.com/image.png" alt="Test Image" width="100" height="100">');
  });

  it('strips onerror from img tags', () => {
    const dirty = '<img src="invalid" onerror="alert(1)" alt="Test">';
    const cleaned = sanitizeHtml(dirty);
    expect(cleaned).toBe('<img src="invalid" alt="Test">');
  });

  it('strips javascript src in img tags', () => {
    const dirty = '<img src="javascript:alert(1)" alt="Test">';
    const cleaned = sanitizeHtml(dirty);
    // DOMPurify usually removes the whole tag or the src attribute depending on config, but with our config it likely removes the src.
    // Let's check what it actually does. If src is removed, it might look like <img alt="Test">
    expect(cleaned).not.toContain('javascript:');
    expect(cleaned).not.toContain('alert(1)');
  });
});
