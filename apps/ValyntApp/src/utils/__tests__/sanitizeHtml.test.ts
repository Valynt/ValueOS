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
    const dirty =
      '<img src="x" alt="test" width="10" height="10" title="image" class="img-fluid" onerror="alert(1)">';
    const cleaned = sanitizeHtml(dirty);
    expect(cleaned).toBe(
      '<img src="x" alt="test" width="10" height="10" title="image" class="img-fluid">'
    );
  });

  it('allows block elements like div and table', () => {
    const dirty =
      '<div><p>Text</p></div><table><tr><td>Cell</td></tr></table>';
    const cleaned = sanitizeHtml(dirty);
    // DOMPurify may normalize HTML (e.g., adding tbody)
    expect(cleaned).toContain('<div><p>Text</p></div>');
    expect(cleaned).toContain('<table>');
    expect(cleaned).toContain('<td>Cell</td>');
  });

  // --- Element stripping ---

  it('strips iframe elements', () => {
    const dirty = '<p>text</p><iframe src="https://evil.com"></iframe>';
    const cleaned = sanitizeHtml(dirty);
    expect(cleaned).not.toContain('<iframe');
    expect(cleaned).toContain('<p>text</p>');
  });

  it('strips object elements', () => {
    const dirty = '<p>text</p><object data="x"></object>';
    const cleaned = sanitizeHtml(dirty);
    expect(cleaned).not.toContain('<object');
    expect(cleaned).toContain('<p>text</p>');
  });

  it('strips embed elements', () => {
    const dirty = '<p>text</p><embed src="x">';
    const cleaned = sanitizeHtml(dirty);
    expect(cleaned).not.toContain('<embed');
    expect(cleaned).toContain('<p>text</p>');
  });

  // --- data: URI rejection ---

  it('strips data: URI in anchor href', () => {
    const dirty = '<a href="data:text/html,<script>alert(1)</script>">x</a>';
    const cleaned = sanitizeHtml(dirty);
    expect(cleaned).not.toContain('data:');
  });

  it('strips data: URI in img src', () => {
    // data:image/svg+xml can carry inline scripts
    const dirty = '<img src="data:image/svg+xml,<svg onload=alert(1)>" alt="x">';
    const cleaned = sanitizeHtml(dirty);
    expect(cleaned).not.toContain('data:image/svg+xml');
  });

  // --- Allowed URI schemes ---

  it('allows mailto: links', () => {
    const dirty = '<a href="mailto:user@example.com">email</a>';
    const cleaned = sanitizeHtml(dirty);
    expect(cleaned).toContain('href="mailto:user@example.com"');
  });

  it('allows tel: links', () => {
    const dirty = '<a href="tel:+15551234567">call</a>';
    const cleaned = sanitizeHtml(dirty);
    expect(cleaned).toContain('href="tel:+15551234567"');
  });

  // --- Relative URL policy ---
  // ALLOWED_URI_REGEXP only permits https:, http:, mailto:, and tel: schemes.
  // Relative URLs do not match any allowed scheme and are stripped.
  it('strips relative URLs from href', () => {
    const dirty = '<a href="/internal/path">link</a>';
    const cleaned = sanitizeHtml(dirty);
    // href is removed; the anchor text is preserved
    expect(cleaned).not.toContain('href="/internal/path"');
    expect(cleaned).toContain('link');
  });
});
