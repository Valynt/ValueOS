import { resolve } from "dns";
import { promisify } from "util";

import * as cheerio from "cheerio";
import * as ipaddr from "ipaddr.js";
import Redis, { type Redis as RedisClientType } from "ioredis";

import { logger } from "../../lib/logger.js";

const resolveAsync = promisify(resolve);

export interface WebScraperResult {
  url: string;
  title: string;
  h1_tags: string[];
  main_content: string;
  relevance_score: number;
}

/** Tracks hits, misses, and evictions across all internal maps. */
export interface CacheMetrics {
  cacheHits: number;
  cacheMisses: number;
  cacheEvictions: number;
  requestTimesEvictions: number;
  dnsCacheHits: number;
  dnsCacheMisses: number;
  dnsCacheEvictions: number;
}

/**
 * Bounded LRU map with TTL support.
 * Entries are evicted when the map exceeds maxSize (oldest-accessed first)
 * or when their TTL expires.
 */
class BoundedLRUMap<V> {
  private map = new Map<string, { value: V; timestamp: number; lastAccess: number }>();
  private readonly maxSize: number;
  private readonly ttlMs: number;
  evictions = 0;

  constructor(maxSize: number, ttlMs: number) {
    this.maxSize = maxSize;
    this.ttlMs = ttlMs;
  }

  get(key: string): V | undefined {
    const entry = this.map.get(key);
    if (!entry) return undefined;

    if (Date.now() - entry.timestamp >= this.ttlMs) {
      this.map.delete(key);
      this.evictions++;
      return undefined;
    }

    // Touch for LRU: delete and re-insert to move to end of iteration order
    this.map.delete(key);
    entry.lastAccess = Date.now();
    this.map.set(key, entry);
    return entry.value;
  }

  set(key: string, value: V): void {
    if (this.map.has(key)) {
      this.map.delete(key);
    }

    while (this.map.size >= this.maxSize) {
      const oldest = this.map.keys().next().value;
      if (oldest !== undefined) {
        this.map.delete(oldest);
        this.evictions++;
      }
    }

    this.map.set(key, { value, timestamp: Date.now(), lastAccess: Date.now() });
  }

  has(key: string): boolean {
    const entry = this.map.get(key);
    if (!entry) return false;
    if (Date.now() - entry.timestamp >= this.ttlMs) {
      this.map.delete(key);
      this.evictions++;
      return false;
    }
    return true;
  }

  delete(key: string): boolean {
    return this.map.delete(key);
  }

  get size(): number {
    return this.map.size;
  }

  clear(): void {
    this.map.clear();
  }

  /** Remove all entries whose TTL has expired. Returns count of purged entries. */
  purgeExpired(): number {
    const now = Date.now();
    let purged = 0;
    for (const [key, entry] of this.map) {
      if (now - entry.timestamp >= this.ttlMs) {
        this.map.delete(key);
        this.evictions++;
        purged++;
      }
    }
    return purged;
  }
}

/**
 * Bounded map for rate-limit timestamps per hostname.
 * Evicts the least-recently-used hostname when over capacity.
 */
class BoundedRateLimitMap {
  private map = new Map<string, { times: number[]; lastAccess: number }>();
  private readonly maxSize: number;
  evictions = 0;

  constructor(maxSize: number) {
    this.maxSize = maxSize;
  }

  get(key: string): number[] | undefined {
    const entry = this.map.get(key);
    if (!entry) return undefined;

    this.map.delete(key);
    entry.lastAccess = Date.now();
    this.map.set(key, entry);
    return entry.times;
  }

  set(key: string, times: number[]): void {
    if (this.map.has(key)) {
      this.map.delete(key);
    }

    while (this.map.size >= this.maxSize) {
      const oldest = this.map.keys().next().value;
      if (oldest !== undefined) {
        this.map.delete(oldest);
        this.evictions++;
      }
    }

    this.map.set(key, { times, lastAccess: Date.now() });
  }

  get size(): number {
    return this.map.size;
  }

  clear(): void {
    this.map.clear();
  }

  /** Purge hostnames with no requests in the last windowMs. */
  purgeStale(windowMs: number): number {
    const cutoff = Date.now() - windowMs;
    let purged = 0;
    for (const [key, entry] of this.map) {
      const validTimes = entry.times.filter((t) => t >= cutoff);
      if (validTimes.length === 0) {
        this.map.delete(key);
        this.evictions++;
        purged++;
      } else {
        entry.times = validTimes;
      }
    }
    return purged;
  }
}

// Default capacity limits
const DEFAULT_CACHE_MAX_ENTRIES = 500;
const DEFAULT_REQUEST_TIMES_MAX_ENTRIES = 1000;
const DEFAULT_DNS_CACHE_MAX_ENTRIES = 1000;
const CLEANUP_INTERVAL_MS = 60_000;

export class WebScraperService {
  private userAgent: string;
  private requestTimes: BoundedRateLimitMap;
  private maxRequestsPerMinute = 10;
  private cache: BoundedLRUMap<{ result: WebScraperResult; timestamp: number }>;
  private cacheTtlMs = 30 * 60 * 1000; // 30 minutes
  private redis: RedisClientType | null = null;
  private redisConnectionPromise: Promise<void> | null = null;
  private encryptionKey: string;
  private dnsCache: BoundedLRUMap<{ ips: string[]; timestamp: number }>;
  private dnsCacheTtlMs = 5 * 60 * 1000; // 5 minutes

  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  private _metrics: CacheMetrics = {
    cacheHits: 0,
    cacheMisses: 0,
    cacheEvictions: 0,
    requestTimesEvictions: 0,
    dnsCacheHits: 0,
    dnsCacheMisses: 0,
    dnsCacheEvictions: 0,
  };

  constructor(
    userAgent = "ValueCanvasBot/1.0 (+http://valuecanvas.com)",
    redisUrl?: string,
    options?: {
      cacheMaxEntries?: number;
      requestTimesMaxEntries?: number;
      dnsCacheMaxEntries?: number;
      cleanupIntervalMs?: number;
    }
  ) {
    this.userAgent = userAgent;
    const encryptionKey = process.env.WEB_SCRAPER_ENCRYPTION_KEY;
    if (!encryptionKey) {
      // A random key generated at construction time is not usable: it changes on every
      // process start and differs across replicas, making previously-encrypted cache
      // entries permanently unreadable. Fail fast so the missing secret is caught at
      // startup rather than silently corrupting cached data.
      throw new Error(
        "WEB_SCRAPER_ENCRYPTION_KEY environment variable is required. " +
          "Generate a 32-byte hex key with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\" " +
          "and set it in your environment configuration."
      );
    }
    this.encryptionKey = encryptionKey;

    const cacheMax = options?.cacheMaxEntries ?? DEFAULT_CACHE_MAX_ENTRIES;
    const requestTimesMax = options?.requestTimesMaxEntries ?? DEFAULT_REQUEST_TIMES_MAX_ENTRIES;
    const dnsCacheMax = options?.dnsCacheMaxEntries ?? DEFAULT_DNS_CACHE_MAX_ENTRIES;
    const cleanupInterval = options?.cleanupIntervalMs ?? CLEANUP_INTERVAL_MS;

    this.cache = new BoundedLRUMap(cacheMax, this.cacheTtlMs);
    this.requestTimes = new BoundedRateLimitMap(requestTimesMax);
    this.dnsCache = new BoundedLRUMap(dnsCacheMax, this.dnsCacheTtlMs);

    // Periodic cleanup of stale entries
    this.cleanupTimer = setInterval(() => this.runCleanup(), cleanupInterval);
    if (this.cleanupTimer.unref) {
      this.cleanupTimer.unref();
    }

    // Initialize Redis for distributed rate limiting
    if (redisUrl) {
      try {
        this.redis = new Redis(redisUrl);
        this.redis.on("error", (err) => logger.error("Redis connection error", err));
        this.redisConnectionPromise = Promise.resolve();
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
      this._metrics.cacheHits++;
      logger.debug("Web scraper cache hit", { url });
      return cached.result;
    }
    this._metrics.cacheMisses++;

    let currentUrl = url;
    let redirectCount = 0;
    const maxRedirects = 5;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        while (redirectCount <= maxRedirects) {
          // Validate URL and get safe IP to prevent SSRF
          const safeIP = await this.validateUrlAndGetSafeIP(currentUrl);
          if (!safeIP) {
            logger.warn("Web scraping blocked for unsafe URL", {
              url: currentUrl,
            });
            return null;
          }

          // Check rate limit before making request (distributed)
          if (!(await this.checkRateLimit(safeIP.hostname))) {
            logger.warn("Rate limit exceeded for domain", {
              hostname: safeIP.hostname,
              url: currentUrl,
            });
            throw new Error(`Rate limit exceeded for ${safeIP.hostname}`);
          }

          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

          try {
            // Construct URL using the validated IP to prevent TOCTOU
            const urlObj = new URL(currentUrl);
            const fetchUrl = `${urlObj.protocol}//${safeIP.ip}${urlObj.pathname}${urlObj.search}`;

            // Use manual redirect handling to check every hop
            const response = await fetch(fetchUrl, {
              method: "GET",
              headers: {
                "User-Agent": this.userAgent,
                Host: safeIP.hostname, // Set Host header to original hostname
                Accept:
                  "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
              },
              signal: controller.signal,
              redirect: "manual",
            });

            clearTimeout(timeoutId);

            // Handle redirects manually
            if (response.status >= 300 && response.status < 400) {
              const location = response.headers.get("location");
              if (!location) {
                throw new Error(`Redirect response missing location header`);
              }

              currentUrl = new URL(location, currentUrl).toString();
              redirectCount++;
              continue;
            }

            if (!response.ok) {
              throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const html = await response.text();
            const result = await this.extractContent(html, currentUrl);

            // Cache the result
            this.cache.set(url, {
              result,
              timestamp: Date.now(),
            });

            return result;
          } catch (error) {
            clearTimeout(timeoutId);
            throw error;
          }
        }

        throw new Error(`Too many redirects (${redirectCount}) for ${url}`);
      } catch (error) {
        lastError = error as Error;
        logger.warn(`Web scraping attempt ${attempt} failed`, {
          url,
          attempt,
          maxRetries,
          error: (error as Error).message,
        });

        if (attempt < maxRetries) {
          // Exponential backoff with jitter
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    logger.error("Web scraping failed after all retries", {
      url,
      maxRetries,
      error: lastError?.message,
    });

    return null;
  }

  /**
   * Check rate limit for a hostname
   */
  private async checkRateLimit(hostname: string): Promise<boolean> {
    const now = Date.now();
    const windowStart = now - 60000; // 1 minute window

    // Check Redis first if available
    if (this.redis) {
      try {
        await this.ensureRedisConnected();
        const key = `rate_limit:${hostname}`;
        const count = await this.redis.incr(key);
        if (count === 1) {
          await this.redis.expire(key, 60); // Set 60 second TTL
        }
        return count <= this.maxRequestsPerMinute;
      } catch (error) {
        logger.warn("Redis rate limit check failed, falling back to memory", { error });
      }
    }

    logger.warn("Web scraper in-memory rate limiting active", {
      metric: "web_scraper_rate_limit_fallback_active",
      hostname,
      fallback: "in_memory",
    });

    // Fallback to in-memory rate limiting
    const requests = this.requestTimes.get(hostname) || [];
    const validRequests = requests.filter((time) => time >= windowStart);

    if (validRequests.length >= this.maxRequestsPerMinute) {
      return false;
    }

    validRequests.push(now);
    this.requestTimes.set(hostname, validRequests);
    return true;
  }

  private async ensureRedisConnected(): Promise<void> {
    if (!this.redis || this.redis.isOpen) {
      return;
    }

    if (!this.redisConnectionPromise) {
      this.redisConnectionPromise = this.redis.connect();
    }

    await this.redisConnectionPromise;
  }

  /**
   * Extract content from HTML
   */
  private async extractContent(html: string, url: string): Promise<WebScraperResult> {
    const $ = cheerio.load(html);

    // Extract title
    const title = $("title").text().trim() || $("h1").first().text().trim() || "";

    // Extract H1 tags
    const h1Tags: string[] = [];
    $("h1").each((_, element) => {
      const text = $(element).text().trim();
      if (text) h1Tags.push(text);
    });

    // Extract main content
    let mainContent = "";

    // Try to find main content area
    const mainSelectors = [
      "main",
      "article",
      '[role="main"]',
      ".content",
      ".main-content",
      "#content",
      "#main",
    ];

    for (const selector of mainSelectors) {
      const element = $(selector);
      if (element.length > 0) {
        // Remove unwanted elements
        element.find("script, style, nav, header, footer, aside, .ads, .advertisement").remove();
        mainContent = element.text().trim();
        break;
      }
    }

    // Fallback to body if no main content found
    if (!mainContent) {
      $("script, style, nav, header, footer, aside, .ads, .advertisement").remove();
      mainContent = $("body").text().trim();
    }

    // Clean up content
    mainContent = mainContent
      .replace(/\s+/g, " ")
      .replace(/\n\s*\n/g, "\n")
      .substring(0, 5000); // Limit to first 5000 chars

    // Calculate relevance score based on content quality
    const relevanceScore = this.calculateRelevanceScore(title, mainContent, h1Tags);

    return {
      url,
      title,
      h1_tags: h1Tags,
      main_content: mainContent,
      relevance_score: relevanceScore,
    };
  }

  /**
   * Calculate relevance score for extracted content
   */
  private calculateRelevanceScore(title: string, content: string, h1Tags: string[]): number {
    let score = 0;

    // Title quality (30%)
    if (title.length > 10 && title.length < 100) score += 30;
    else if (title.length > 5) score += 15;

    // Content length (25%)
    if (content.length > 500) score += 25;
    else if (content.length > 200) score += 15;
    else if (content.length > 50) score += 5;

    // H1 tags presence (20%)
    if (h1Tags.length > 0 && h1Tags.length <= 3) score += 20;
    else if (h1Tags.length > 0) score += 10;

    // Content indicators (25%)
    const contentIndicators = [
      /\b(the|and|or|but|in|on|at|to|for|of|with|by)\b/gi, // Common words
      /\b\d{4}\b/, // Years
      /\$?\d+(,\d{3})*(\.\d{2})?/, // Numbers/currency
      /\b[A-Z][a-z]+ [A-Z][a-z]+\b/, // Proper names
    ];

    let indicatorCount = 0;
    contentIndicators.forEach((pattern) => {
      if (pattern.test(content)) indicatorCount++;
    });

    if (indicatorCount >= 3) score += 25;
    else if (indicatorCount >= 2) score += 15;
    else if (indicatorCount >= 1) score += 5;

    return Math.min(100, score);
  }

  /**
   * Validate URL and return safe IP address for fetching, or null if unsafe
   */
  private async validateUrlAndGetSafeIP(
    urlString: string
  ): Promise<{ ip: string; hostname: string } | null> {
    try {
      const url = new URL(urlString);

      // Only allow HTTP and HTTPS
      if (!["http:", "https:"].includes(url.protocol)) {
        return null;
      }

      const hostname = url.hostname;
      const blockedHosts = ["localhost", "127.0.0.1", "0.0.0.0", "::1"];

      if (blockedHosts.includes(hostname.toLowerCase())) {
        return null;
      }

      const ips = await this.resolveAndCheckIP(hostname);
      if (!ips) {
        logger.warn("DNS resolution failed, blocking request", { url: urlString });
        return null;
      }

      // Find the first safe IP
      for (const ip of ips) {
        if (!this.isPrivateIP(ip)) {
          return { ip, hostname };
        }
      }

      logger.warn("All resolved IPs are private, blocking request", { hostname, ips });
      return null;
    } catch (error) {
      logger.warn("URL safety check failed, blocking request", {
        url: urlString,
        error: (error as Error).message,
      });
      return null;
    }
  }

  /**
   * Check if hostname looks like an IP address
   */
  private isIpLike(hostname: string): boolean {
    return /^\d+\.\d+\.\d+\.\d+$/.test(hostname) || hostname.includes(":");
  }

  /**
   * Resolve hostname and check IPs
   */
  private async resolveAndCheckIP(hostname: string): Promise<string[] | null> {
    try {
      // Check DNS cache first
      const cached = this.dnsCache.get(hostname);
      if (cached && Date.now() - cached.timestamp < this.dnsCacheTtlMs) {
        this._metrics.dnsCacheHits++;
        return cached.ips;
      }
      this._metrics.dnsCacheMisses++;

      const ips = await resolveAsync(hostname);

      // Cache the result
      this.dnsCache.set(hostname, {
        ips,
        timestamp: Date.now(),
      });

      return ips;
    } catch (error) {
      logger.warn("DNS resolution failed", { hostname, error: (error as Error).message });
      return null;
    }
  }

  /**
   * Check if IP address is private
   */
  private isPrivateIP(ip: string): boolean {
    try {
      const addr = ipaddr.parse(ip);
      const range = addr.range();
      return ["private", "loopback", "linkLocal", "uniqueLocal", "unspecified"].includes(range);
    } catch (e) {
      return true; // Treat invalid IPs as private/unsafe
    }
  }

  /** Run periodic cleanup: purge expired entries and enforce caps. */
  private runCleanup(): void {
    const cachePurged = this.cache.purgeExpired();
    const dnsPurged = this.dnsCache.purgeExpired();
    const ratePurged = this.requestTimes.purgeStale(60_000);

    this._metrics.cacheEvictions = this.cache.evictions;
    this._metrics.requestTimesEvictions = this.requestTimes.evictions;
    this._metrics.dnsCacheEvictions = this.dnsCache.evictions;

    if (cachePurged + dnsPurged + ratePurged > 0) {
      logger.info("WebScraperService cleanup completed", {
        cachePurged,
        dnsPurged,
        ratePurged,
        ...this.getMetrics(),
      });
    }
  }

  /**
   * Clear all caches (useful for testing)
   */
  clearCache(): void {
    this.cache.clear();
    this.requestTimes.clear();
    this.dnsCache.clear();
  }

  /**
   * Get cache size statistics
   */
  getCacheStats(): {
    cacheSize: number;
    rateLimitEntries: number;
    dnsCacheEntries: number;
  } {
    return {
      cacheSize: this.cache.size,
      rateLimitEntries: this.requestTimes.size,
      dnsCacheEntries: this.dnsCache.size,
    };
  }

  /**
   * Get detailed cache metrics including hits, misses, and evictions.
   */
  getMetrics(): CacheMetrics {
    this._metrics.cacheEvictions = this.cache.evictions;
    this._metrics.requestTimesEvictions = this.requestTimes.evictions;
    this._metrics.dnsCacheEvictions = this.dnsCache.evictions;
    return { ...this._metrics };
  }

  /**
   * Stop the periodic cleanup timer. Call on shutdown.
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }
}

// Lazy singleton — constructed on first access so that the missing-key error
// surfaces at call time rather than at module import time (which would break
// any module that imports this file in a test environment without the key set).
let _webScraperServiceInstance: WebScraperService | null = null;

export function getWebScraperService(): WebScraperService {
  if (!_webScraperServiceInstance) {
    _webScraperServiceInstance = new WebScraperService();
  }
  return _webScraperServiceInstance;
}

/**
 * Reset the singleton so the next call to getWebScraperService() constructs
 * a fresh instance. Use in test afterEach/afterAll hooks when
 * WEB_SCRAPER_ENCRYPTION_KEY is changed between tests.
 */
export function resetWebScraperService(): void {
  _webScraperServiceInstance = null;
}

/**
 * @deprecated Use getWebScraperService() instead.
 *
 * Construction is deferred to first property access via a Proxy. If
 * WEB_SCRAPER_ENCRYPTION_KEY is not set, the error surfaces on the first
 * method call, not at module import time. Use getWebScraperService() for
 * explicit construction and predictable error timing.
 */
export const webScraperService: WebScraperService = new Proxy({} as WebScraperService, {
  get(_target, prop) {
    return getWebScraperService()[prop as keyof WebScraperService];
  },
});
