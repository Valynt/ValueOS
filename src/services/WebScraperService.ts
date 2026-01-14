import { logger } from "../lib/logger";
import * as cheerio from "cheerio";

export interface WebScraperResult {
  url: string;
  title: string;
  h1_tags: string[];
  main_content: string;
  relevance_score: number;
}

export class WebScraperService {
  private userAgent: string;
  private requestTimes: Map<string, number[]> = new Map();
  private maxRequestsPerMinute = 10; // Conservative limit per domain
  private cache: Map<string, { result: WebScraperResult; timestamp: number }> =
    new Map();
  private cacheTtlMs = 30 * 60 * 1000; // 30 minutes cache TTL

  constructor(userAgent = "ValueCanvasBot/1.0 (+http://valuecanvas.com)") {
    this.userAgent = userAgent;
  }
  /**
   * Scrape a URL for its content
   */
  async scrape(url: string, maxRetries = 3): Promise<WebScraperResult | null> {
    // Check cache first
    const cached = this.cache.get(url);
    if (cached && Date.now() - cached.timestamp < this.cacheTtlMs) {
      logger.debug("Returning cached result", { url });
      return cached.result;
    }

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        // Start with initial URL
        let currentUrl = url;
        let redirectCount = 0;
        const maxRedirects = 5;

        while (redirectCount <= maxRedirects) {
          // Validate URL to prevent SSRF
          if (!this.isSafeUrl(currentUrl)) {
            logger.warn("Web scraping blocked for unsafe URL", {
              url: currentUrl,
            });
            return null;
          }

          // Check rate limit before making request
          const hostname = new URL(currentUrl).hostname;
          if (!this.checkRateLimit(hostname)) {
            logger.warn("Rate limit exceeded for domain", {
              hostname,
              url: currentUrl,
            });
            throw new Error(`Rate limit exceeded for ${hostname}`);
          }

          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

          try {
            // Use manual redirect handling to check every hop
            const response = await fetch(currentUrl, {
              method: "GET",
              headers: {
                "User-Agent": this.userAgent,
                Accept:
                  "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
              },
              signal: controller.signal,
              redirect: "manual",
            });

            clearTimeout(timeoutId);

            // Handle redirects manually
            if (response.status >= 300 && response.status < 400) {
              const location = response.headers.get("Location");
              if (!location) {
                throw new Error(
                  `Redirect with no Location header (status ${response.status})`
                );
              }

              // Resolve relative URLs
              try {
                currentUrl = new URL(location, currentUrl).toString();
              } catch (e) {
                throw new Error(`Invalid redirect location: ${location}`);
              }

              redirectCount++;
              continue;
            }

            if (!response.ok) {
              throw new Error(`HTTP ${response.status} ${response.statusText}`);
            }

            // Validate content type
            const contentType = response.headers.get("content-type") || "";
            if (
              !contentType.includes("text/html") &&
              !contentType.includes("application/xhtml")
            ) {
              throw new Error(`Invalid content type: ${contentType}`);
            }

            const html = await response.text();
            const content = this.extractContent(html);

            // Calculate relevance score based on content quality
            const relevanceScore = this.calculateRelevanceScore(html, content);

            const result = {
              url: currentUrl,
              title: content.title,
              h1_tags: content.h1s,
              main_content: content.text,
              relevance_score: relevanceScore,
            };

            // Cache the result
            this.cache.set(url, { result, timestamp: Date.now() });

            return result;
          } catch (fetchError) {
            clearTimeout(timeoutId);
            throw fetchError;
          }
        }

        throw new Error(`Too many redirects (max ${maxRedirects})`);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        logger.warn(`Web scraping attempt ${attempt + 1} failed`, {
          url,
          attempt: attempt + 1,
          maxRetries,
          error: lastError.message,
        });

        // Wait before retry (exponential backoff)
        if (attempt < maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, attempt), 10000); // Max 10s delay
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    // All retries failed
    logger.warn("Web scraping failed after all retries", {
      url,
      maxRetries,
      finalError: lastError?.message,
    });
    return null;
  }

  private isSafeUrl(urlString: string): boolean {
    try {
      const url = new URL(urlString);

      // Block non-http protocols
      if (!["http:", "https:"].includes(url.protocol)) {
        return false;
      }

      const hostname = url.hostname.toLowerCase();

      // 1. Block localhost and specific local domains
      if (
        hostname === "localhost" ||
        hostname.endsWith(".local") ||
        hostname.endsWith(".localhost")
      ) {
        return false;
      }

      // 2. IPv6 Checks
      // Block ALL IPv6 literals.
      // Parsing IPv6 robustly without a library is error-prone.
      // Safe default: disallow direct IPv6 access (use domain names instead).
      if (hostname.startsWith("[") || hostname.includes(":")) {
        // Simple check for colon in hostname often indicates IPv6 literal (unbracketed in some contexts) or port?
        // URL.hostname usually strips port. If it has colon, it's IPv6.
        // But [::1] -> hostname is "[::1]" or "::1"?
        // In Node URL parser, brackets are kept in hostname for IPv6?
        // Let's verify: new URL('http://[::1]').hostname === '[::1]' in some envs, '::1' in others.
        // Safest is to block if it contains colon.
        return false;
      }

      // 3. IPv4 Checks
      // Check if hostname looks like an IP (starts with digit, or contains likely IP chars)
      // We block integer-only hostnames (http://2130706433) and hex/octal (http://0x7f...)
      const isIpLike = /^(\d+|0x[0-9a-f]+|0[0-7]+)(?:\.|$)/i.test(hostname);

      if (isIpLike) {
        // If it's an IP, we apply strict checks.

        // Block Integer IPs (no dots) - e.g. http://2130706433
        if (!hostname.includes(".")) return false;

        // Block Hex/Octal formats to prevent bypass
        // Valid IPs should be decimal dot notation: d.d.d.d
        const parts = hostname.split(".");
        // If any part looks like hex (0x) or octal (leading 0 but not just '0'), block it.
        if (
          parts.some(
            (p) => p.startsWith("0x") || (p.startsWith("0") && p.length > 1)
          )
        ) {
          return false;
        }

        // Check Private Ranges
        // 127.0.0.0/8
        if (hostname.startsWith("127.")) return false;
        // 10.0.0.0/8
        if (hostname.startsWith("10.")) return false;
        // 192.168.0.0/16
        if (hostname.startsWith("192.168.")) return false;
        // 169.254.0.0/16 (Link Local / Cloud Metadata)
        if (hostname.startsWith("169.254.")) return false;
        // 0.0.0.0/8
        if (hostname.startsWith("0.")) return false;

        // 172.16.0.0/12
        if (hostname.startsWith("172.")) {
          const secondOctet = parseInt(parts[1], 10);
          if (secondOctet >= 16 && secondOctet <= 31) return false;
        }
      }

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Extract structured content from HTML using Cheerio
   * More reliable than regex for complex HTML structures
   */
  private extractContent(html: string): {
    title: string;
    h1s: string[];
    text: string;
  } {
    const $ = cheerio.load(html);

    // 1. Extract Title
    const title = $("title").first().text().trim() || "";

    // 2. Extract H1s
    const h1s: string[] = [];
    $("h1").each((_, element) => {
      const h1Text = $(element).text().trim();
      if (h1Text) {
        h1s.push(h1Text);
      }
    });

    // 3. Extract Main Content
    // Remove script, style, nav, footer, and other non-content elements
    $(
      "script, style, svg, head, noscript, iframe, nav, footer, aside, .sidebar, .navigation, .menu, .footer, .ads, .advertisement"
    ).remove();

    // Get text content from body or main content areas
    let text =
      $("body").text() ||
      $("main").text() ||
      $("article").text() ||
      $.root().text();

    // Clean up whitespace
    text = this.cleanText(text);

    return { title, h1s, text };
  }

  private checkRateLimit(hostname: string): boolean {
    const now = Date.now();
    const windowMs = 60 * 1000; // 1 minute window
    const times = this.requestTimes.get(hostname) || [];

    // Remove requests outside the window
    const validTimes = times.filter((time) => now - time < windowMs);

    // Check if we're within limits
    if (validTimes.length >= this.maxRequestsPerMinute) {
      return false;
    }

    // Add current request
    validTimes.push(now);
    this.requestTimes.set(hostname, validTimes);

    return true;
  }

  private calculateRelevanceScore(
    html: string,
    content: { title: string; h1s: string[]; text: string }
  ): number {
    let score = 0.5; // Base score

    // Title presence and quality (0.2 points)
    if (content.title && content.title.length > 10) {
      score += 0.2;
    }

    // H1 tags presence (0.1 points)
    if (content.h1s.length > 0) {
      score += 0.1;
    }

    // Content length (0.2 points max)
    const textLength = content.text.length;
    if (textLength > 100) score += 0.1;
    if (textLength > 500) score += 0.1;

    // Text-to-HTML ratio (content density) (0.1 points)
    const textRatio = textLength / html.length;
    if (textRatio > 0.1) score += 0.1; // Good content density

    // Cap at 1.0
    return Math.min(1.0, score);
  }

  private cleanText(text: string): string {
    if (!text) return "";

    // Decode basic entities (very basic set)
    let cleaned = text
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");

    // Normalize whitespace
    cleaned = cleaned.replace(/\s+/g, " ").trim();

    return cleaned;
  }
}

export const webScraperService = new WebScraperService();
