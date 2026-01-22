import { describe, expect, it } from "vitest";
import { sanitizeHtml } from "../sanitizeHtml";

describe("sanitizeHtml", () => {
  it("removes script tags", () => {
    const dirty = "<p>Hello</p><script>alert(1)</script>";
    const cleaned = sanitizeHtml(dirty);
    expect(cleaned).toBe("<p>Hello</p>");
  });

  it("strips javascript: urls", () => {
    const dirty = '<a href="javascript:alert(1)">Click</a>';
    const cleaned = sanitizeHtml(dirty);
    expect(cleaned).toBe("<a>Click</a>");
  });

  it("keeps allowed formatting", () => {
    const dirty = "<p><strong>Bold</strong> and <em>emphasis</em></p>";
    const cleaned = sanitizeHtml(dirty);
    expect(cleaned).toBe("<p><strong>Bold</strong> and <em>emphasis</em></p>");
  });

  it("removes event handlers", () => {
    const dirty = '<span onclick="alert(1)">Test</span>';
    const cleaned = sanitizeHtml(dirty);
    expect(cleaned).toBe("<span>Test</span>");
  });

  it('adds rel="noopener noreferrer" to target="_blank" links', () => {
    const dirty = '<a href="https://example.com" target="_blank">External Link</a>';
    const cleaned = sanitizeHtml(dirty);
    expect(cleaned).toContain('rel="noopener noreferrer"');
  });

  it("allows image tags with valid attributes", () => {
    const dirty =
      '<img src="https://example.com/image.png" alt="Test Image" width="100" height="100" class="test-class" />';
    const cleaned = sanitizeHtml(dirty);
    expect(cleaned).toBe(
      '<img src="https://example.com/image.png" alt="Test Image" width="100" height="100" class="test-class">'
    );
  });

  it("removes disallowed attributes from image tags", () => {
    const dirty = '<img src="image.png" onerror="alert(1)" onclick="alert(1)" />';
    const cleaned = sanitizeHtml(dirty);
    expect(cleaned).toBe('<img src="image.png">');
  });
});
