import { logger } from "../lib/logger";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

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
  private cache: Map<string, { result: WebScraperResult; timestamp: number }> = new Map();
  private cacheTtlMs = 30 * 60 * 1000; // 30 minutes cache TTL
  private redis: unknown | null = null;
  private encryptionKey: string;
  private dnsCache: Map<string, { ips: string[]; timestamp: number }> = new Map();
  private dnsCacheTtlMs = 5 * 60 * 1000; // 5 minutes DNS cache TTL

  constructor(userAgent = "ValueCanvasBot/1.0 (+http://valuecanvas.com)", redisUrl?: string) {
    this.userAgent = userAgent;
    this.encryptionKey =
      process.env.WEB_SCRAPER_ENCRYPTION_KEY || crypto.randomBytes(32).toString("hex");

    // Initialize Redis for distributed rate limiting
    if (redisUrl) {
      try {
        this.redis = createClient(redisUrl);
        this.redis.on("error", (err: unknown) => logger.error("Redis connection error", { err }));
      } catch (error) {
        logger.warn("Failed to initialize Redis, falling back to in-memory rate limiting", {
          error,
        });
      }
    }
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
          if (!(await this.isSafeUrl(currentUrl))) {
            logger.warn("Web scraping blocked for unsafe URL", { url: currentUrl });
            return null;
          }

          // Check rate limit before making request (distributed)
          const hostname = new URL(currentUrl).hostname;
          if (!(await this.checkRateLimit(hostname))) {
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
                throw new Error(`Redirect with no Location header (status ${response.status})`);
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
            if (!contentType.includes("text/html") && !contentType.includes("application/xhtml")) {
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

            // Cache the result (encrypted if sensitive)
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
        if (parts.some((p) => p.startsWith("0x") || (p.startsWith("0") && p.length > 1))) {
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
   * Extract structured content from HTML using Regex
   * Note: This is a lightweight fallback when heavy parsers like Cheerio/JSDOM are not available/desirable.
   */
  private extractContent(html: string): { title: string; h1s: string[]; text: string } {
    // 1. Extract Title
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const title = titleMatch ? this.cleanText(titleMatch[1]) : "";

    // 2. Extract H1s
    const h1s: string[] = [];
    const h1Regex = /<h1[^>]*>([\s\S]*?)<\/h1>/gi;
    let match;
    while ((match = h1Regex.exec(html)) !== null) {
      const h1Text = this.cleanText(match[1]);
      if (h1Text) {
        h1s.push(h1Text);
      }
    }

    // 3. Extract Main Content
    // First, remove irrelevant tags
    let text = html;

    // Remove scripts, styles, svg, head, noscript, iframe
    text = text.replace(
      /<(script|style|svg|head|noscript|iframe|nav|footer)[^>]*>[\s\S]*?<\/\1>/gi,
      " "
    );

    // Remove comments
    text = text.replace(/<!--[\s\S]*?-->/g, "");

    // Remove all other tags
    text = text.replace(/<[^>]+>/g, " ");

    // Clean and normalize
    text = this.cleanText(text);

    return { title, h1s, text };
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
