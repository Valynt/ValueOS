import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WebScraperService } from "../src/services/WebScraperService";

describe("WebScraperService Security Tests", () => {
  const originalFetch = global.fetch;
  let scraper: WebScraperService;

  beforeEach(() => {
    global.fetch = vi.fn();
    scraper = new WebScraperService();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  describe("SSRF Protection", () => {
    it("should block localhost URLs", async () => {
      const result = await scraper.scrape("http://localhost:3000");
      expect(result).toBeNull();
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it("should block 127.0.0.1 URLs", async () => {
      const result = await scraper.scrape("http://127.0.0.1/admin");
      expect(result).toBeNull();
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it("should block private IP ranges", async () => {
      const privateIPs = [
        "http://192.168.1.1/router",
        "http://10.0.0.1/internal",
        "http://172.16.0.1/private",
        "http://169.254.169.254/metadata",
      ];

      for (const ip of privateIPs) {
        const result = await scraper.scrape(ip);
        expect(result).toBeNull();
        expect(global.fetch).not.toHaveBeenCalled();
      }
    });

    it("should block IPv6 addresses", async () => {
      const result = await scraper.scrape("http://[::1]/");
      expect(result).toBeNull();
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it("should block hex/octal IP formats", async () => {
      const result = await scraper.scrape("http://0x7f000001/");
      expect(result).toBeNull();
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it("should allow legitimate external URLs", async () => {
      const mockHtml = `
        <html>
          <head><title>Test Page</title></head>
          <body><h1>Content</h1><p>Test content</p></body>
        </html>
      `;

      (global.fetch as any).mockResolvedValue({
        ok: true,
        text: async () => mockHtml,
        status: 200,
        statusText: "OK",
        headers: new Map([["content-type", "text/html"]]),
      });

      const result = await scraper.scrape("https://example.com");
      expect(result).not.toBeNull();
      expect(result?.title).toBe("Test Page");
      expect(global.fetch).toHaveBeenCalled();
    });
  });

  describe("Rate Limiting", () => {
    it("should enforce rate limits per domain", async () => {
      const mockHtml = "<html><head><title>Test</title></head><body>Content</body></html>";
      (global.fetch as any).mockResolvedValue({
        ok: true,
        text: async () => mockHtml,
        status: 200,
        statusText: "OK",
        headers: new Map([["content-type", "text/html"]]),
      });

      // Make multiple requests to the same domain
      const promises = Array(15)
        .fill(null)
        .map(() => scraper.scrape("https://example.com"));
      const results = await Promise.allSettled(promises);

      // Some should be rate limited
      const rejected = results.filter(
        (r) => r.status === "rejected" || (r.status === "fulfilled" && r.value === null)
      );
      expect(rejected.length).toBeGreaterThan(0);
    });
  });

  describe("Content Validation", () => {
    it("should reject non-HTML content types", async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        text: async () => "binary data",
        status: 200,
        statusText: "OK",
        headers: new Map([["content-type", "application/json"]]),
      });

      const result = await scraper.scrape("https://api.example.com/data.json");
      expect(result).toBeNull();
    });

    it("should handle malformed HTML gracefully", async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        text: async () => "<malformed html",
        status: 200,
        statusText: "OK",
        headers: new Map([["content-type", "text/html"]]),
      });

      const result = await scraper.scrape("https://example.com/malformed");
      expect(result).not.toBeNull();
      expect(result?.title).toBe("");
      expect(result?.main_content).toBe("");
    });
  });

  describe("Cache Security", () => {
    it("should cache results with TTL", async () => {
      const mockHtml = "<html><head><title>Cached</title></head><body>Content</body></html>";
      (global.fetch as any).mockResolvedValue({
        ok: true,
        text: async () => mockHtml,
        status: 200,
        statusText: "OK",
        headers: new Map([["content-type", "text/html"]]),
      });

      // First request
      const result1 = await scraper.scrape("https://example.com/cache");
      expect(result1?.title).toBe("Cached");
      expect(global.fetch).toHaveBeenCalledTimes(1);

      // Second request should use cache
      const result2 = await scraper.scrape("https://example.com/cache");
      expect(result2?.title).toBe("Cached");
      expect(global.fetch).toHaveBeenCalledTimes(1); // Still only called once
    });
  });

  describe("Error Handling", () => {
    it("should handle network errors gracefully", async () => {
      (global.fetch as any).mockRejectedValue(new Error("Network error"));

      const result = await scraper.scrape("https://example.com");
      expect(result).toBeNull();
    });

    it("should handle HTTP errors gracefully", async () => {
      (global.fetch as any).mockResolvedValue({
        ok: false,
        status: 404,
        statusText: "Not Found",
        text: async () => "Not Found",
      });

      const result = await scraper.scrape("https://example.com/notfound");
      expect(result).toBeNull();
    });

    it("should retry failed requests with exponential backoff", async () => {
      (global.fetch as any)
        .mockRejectedValueOnce(new Error("Temporary failure"))
        .mockRejectedValueOnce(new Error("Temporary failure"))
        .mockResolvedValueOnce({
          ok: true,
          text: async () => "<html><head><title>Success</title></head><body>Content</body></html>",
          status: 200,
          statusText: "OK",
          headers: new Map([["content-type", "text/html"]]),
        });

      const startTime = Date.now();
      const result = await scraper.scrape("https://example.com/retry");
      const endTime = Date.now();

      expect(result).not.toBeNull();
      expect(result?.title).toBe("Success");
      expect(endTime - startTime).toBeGreaterThan(1000); // Should have waited for backoff
    });
  });

  describe("Redirect Security", () => {
    it("should validate redirect URLs", async () => {
      (global.fetch as any).mockResolvedValue({
        ok: false,
        status: 302,
        statusText: "Found",
        headers: new Map([["location", "http://localhost:3000"]]),
      });

      const result = await scraper.scrape("https://example.com/redirect");
      expect(result).toBeNull();
    });

    it("should limit redirect chains", async () => {
      // Mock a redirect chain that exceeds the limit
      let redirectCount = 0;
      (global.fetch as any).mockImplementation((url) => {
        redirectCount++;
        if (redirectCount > 6) {
          return Promise.resolve({
            ok: true,
            text: async () => "<html><head><title>Final</title></head><body>Content</body></html>",
            status: 200,
            statusText: "OK",
            headers: new Map([["content-type", "text/html"]]),
          });
        }
        return Promise.resolve({
          ok: false,
          status: 302,
          statusText: "Found",
          headers: new Map([["location", `${url}/next`]]),
        });
      });

      const result = await scraper.scrape("https://example.com/chain");
      expect(result).toBeNull(); // Should fail due to too many redirects
    });
  });
});
