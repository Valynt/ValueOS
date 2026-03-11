/**
 * WebScraperService HTML Structure Tests
 *
 * Tests for robust HTML parsing with Cheerio, covering various edge cases
 * and HTML structures to ensure reliable content extraction.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import { WebScraperService } from "../../src/services/WebScraperService";

// Mock fetch globally
const fetchMock = vi.fn();
global.fetch = fetchMock;

describe("WebScraperService - HTML Structure Tests", () => {
  let service: WebScraperService;

  beforeEach(() => {
    process.env.WEB_SCRAPER_ENCRYPTION_KEY = "e".repeat(64); // 32-byte hex for tests
    service = new WebScraperService();
    vi.clearAllMocks();
  });

  describe("Title Extraction", () => {
    it("should extract title from standard <title> tag", async () => {
      const html = `
        <!DOCTYPE html>
        <html>
          <head><title>Test Page Title</title></head>
          <body><h1>Heading</h1><p>Content</p></body>
        </html>
      `;

      mockFetchResponse(html);
      const result = await service.scrape("http://example.com");

      expect(result?.title).toBe("Test Page Title");
    });

    it("should extract first title when multiple title tags exist", async () => {
      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Primary Title</title>
            <title>Secondary Title</title>
          </head>
          <body><p>Content</p></body>
        </html>
      `;

      mockFetchResponse(html);
      const result = await service.scrape("http://example.com");

      expect(result?.title).toBe("Primary Title");
    });

    it("should handle missing title tag gracefully", async () => {
      const html = `
        <!DOCTYPE html>
        <html>
          <head></head>
          <body><h1>Heading Only</h1><p>Content</p></body>
        </html>
      `;

      mockFetchResponse(html);
      const result = await service.scrape("http://example.com");

      expect(result?.title).toBe("");
    });

    it("should trim whitespace from title", async () => {
      const html = `
        <!DOCTYPE html>
        <html>
          <head><title>   Spaced Title   </title></head>
          <body><p>Content</p></body>
        </html>
      `;

      mockFetchResponse(html);
      const result = await service.scrape("http://example.com");

      expect(result?.title).toBe("Spaced Title");
    });
  });

  describe("H1 Tag Extraction", () => {
    it("should extract multiple H1 tags", async () => {
      const html = `
        <!DOCTYPE html>
        <html>
          <head><title>Test</title></head>
          <body>
            <h1>First Heading</h1>
            <p>Some content</p>
            <h1>Second Heading</h1>
            <h1>Third Heading</h1>
          </body>
        </html>
      `;

      mockFetchResponse(html);
      const result = await service.scrape("http://example.com");

      expect(result?.h1_tags).toEqual([
        "First Heading",
        "Second Heading",
        "Third Heading",
      ]);
    });

    it("should handle nested H1 tags", async () => {
      const html = `
        <div>
          <h1>Main Title</h1>
          <section>
            <h1>Section Title</h1>
          </section>
        </div>
      `;

      mockFetchResponse(html);
      const result = await service.scrape("http://example.com");

      expect(result?.h1_tags).toEqual(["Main Title", "Section Title"]);
    });

    it("should trim whitespace from H1 tags", async () => {
      const html = `
        <h1>   Spaced H1   </h1>
        <h1>Untrimmed</h1>
      `;

      mockFetchResponse(html);
      const result = await service.scrape("http://example.com");

      expect(result?.h1_tags).toEqual(["Spaced H1", "Untrimmed"]);
    });

    it("should skip empty H1 tags", async () => {
      const html = `
        <h1>Valid H1</h1>
        <h1></h1>
        <h1>   </h1>
        <h1>Another Valid</h1>
      `;

      mockFetchResponse(html);
      const result = await service.scrape("http://example.com");

      expect(result?.h1_tags).toEqual(["Valid H1", "Another Valid"]);
    });
  });

  describe("Content Extraction", () => {
    it("should extract content from main content areas", async () => {
      const html = `
        <html>
          <head><title>Test</title></head>
          <body>
            <nav>Navigation</nav>
            <main>
              <article>
                <p>Main content here.</p>
                <p>More content.</p>
              </article>
            </main>
            <footer>Footer</footer>
          </body>
        </html>
      `;

      mockFetchResponse(html);
      const result = await service.scrape("http://example.com");

      expect(result?.main_content).toContain("Main content here");
      expect(result?.main_content).toContain("More content");
      expect(result?.main_content).not.toContain("Navigation");
      expect(result?.main_content).not.toContain("Footer");
    });

    it("should remove unwanted elements", async () => {
      const html = `
        <html>
          <body>
            <script>alert('malicious');</script>
            <style>body { color: red; }</style>
            <nav>Navigation</nav>
            <p>Good content</p>
            <svg><circle cx="50" cy="50" r="40"/></svg>
            <iframe src="external.com"></iframe>
            <footer>Footer</footer>
            <aside>Sidebar</aside>
            <div class="ads">Advertisement</div>
          </body>
        </html>
      `;

      mockFetchResponse(html);
      const result = await service.scrape("http://example.com");

      expect(result?.main_content).toContain("Good content");
      expect(result?.main_content).not.toContain("alert");
      expect(result?.main_content).not.toContain("Navigation");
      expect(result?.main_content).not.toContain("Footer");
      expect(result?.main_content).not.toContain("Sidebar");
      expect(result?.main_content).not.toContain("Advertisement");
    });

    it("should handle malformed HTML gracefully", async () => {
      const html = `
        <html>
          <body>
            <p>Unclosed paragraph
            <div>
              <p>Nested content</p>
            <span>Unclosed span
            <p>More content</p>
          </body>
        </html>
      `;

      mockFetchResponse(html);
      const result = await service.scrape("http://example.com");

      expect(result?.main_content).toContain("Unclosed paragraph");
      expect(result?.main_content).toContain("Nested content");
      expect(result?.main_content).toContain("More content");
    });

    it("should handle non-standard HTML structures", async () => {
      const html = `
        <html>
          <body>
            <custom-element>
              <p>Content in custom element</p>
            </custom-element>
            <div data-component="react">
              <p>React component content</p>
            </div>
          </body>
        </html>
      `;

      mockFetchResponse(html);
      const result = await service.scrape("http://example.com");

      expect(result?.main_content).toContain("Content in custom element");
      expect(result?.main_content).toContain("React component content");
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty HTML", async () => {
      mockFetchResponse("");
      const result = await service.scrape("http://example.com");

      expect(result?.title).toBe("");
      expect(result?.h1_tags).toEqual([]);
      expect(result?.main_content).toBe("");
    });

    it("should handle HTML with only head content", async () => {
      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Head Only</title>
            <meta name="description" content="Meta content">
          </head>
        </html>
      `;

      mockFetchResponse(html);
      const result = await service.scrape("http://example.com");

      expect(result?.title).toBe("Head Only");
      expect(result?.h1_tags).toEqual([]);
      expect(result?.main_content).toBe("");
    });

    it("should handle deeply nested content", async () => {
      const html = `
        <div>
          <div>
            <div>
              <article>
                <section>
                  <div>
                    <p>Deeply nested content</p>
                  </div>
                </section>
              </article>
            </div>
          </div>
        </div>
      `;

      mockFetchResponse(html);
      const result = await service.scrape("http://example.com");

      expect(result?.main_content).toContain("Deeply nested content");
    });

    it("should handle content with special characters", async () => {
      const html = `
        <html>
          <head><title>Café & Restaurant</title></head>
          <body>
            <h1>Price: $10.99</h1>
            <p>Content with émojis 🚀 and symbols ©®™</p>
          </body>
        </html>
      `;

      mockFetchResponse(html);
      const result = await service.scrape("http://example.com");

      expect(result?.title).toBe("Café & Restaurant");
      expect(result?.h1_tags).toEqual(["Price: $10.99"]);
      expect(result?.main_content).toContain("émojis 🚀 and symbols ©®™");
    });

    it("should handle large HTML documents", async () => {
      // Generate a large HTML document
      const largeContent = Array.from(
        { length: 1000 },
        (_, i) => `<p>Paragraph ${i}: ${"word ".repeat(50)}</p>`
      ).join("\n");

      const html = `
        <!DOCTYPE html>
        <html>
          <head><title>Large Document</title></head>
          <body>
            <h1>Large Document</h1>
            ${largeContent}
          </body>
        </html>
      `;

      mockFetchResponse(html);
      const result = await service.scrape("http://example.com");

      expect(result?.title).toBe("Large Document");
      expect(result?.h1_tags).toEqual(["Large Document"]);
      expect(result?.main_content.length).toBeGreaterThan(1000);
      expect(result?.main_content).toContain("Paragraph 0");
      expect(result?.main_content).toContain("Paragraph 999");
    });
  });

  describe("Content Quality Scoring", () => {
    it("should give high score for good content structure", async () => {
      const html = `
        <!DOCTYPE html>
        <html>
          <head><title>Excellent Content</title></head>
          <body>
            <h1>Excellent Content</h1>
            <article>
              ${"<p>This is a paragraph with substantial content.</p>".repeat(20)}
            </article>
          </body>
        </html>
      `;

      mockFetchResponse(html);
      const result = await service.scrape("http://example.com");

      expect(result?.relevance_score).toBeGreaterThan(0.8);
    });

    it("should give low score for poor content structure", async () => {
      const html = `
        <!DOCTYPE html>
        <html>
          <body>
            <script>console.log("script");</script>
            <nav>Menu</nav>
            <p>Short</p>
          </body>
        </html>
      `;

      mockFetchResponse(html);
      const result = await service.scrape("http://example.com");

      expect(result?.relevance_score).toBeLessThan(0.5);
    });
  });
});

// Helper function to mock fetch responses
function mockFetchResponse(html: string) {
  fetchMock.mockResolvedValueOnce({
    ok: true,
    status: 200,
    headers: new Map([["content-type", "text/html"]]),
    text: () => Promise.resolve(html),
  } as any);
}
