import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WebScraperService, webScraperService } from '../WebScraperService.js'

describe('WebScraperService', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('should scrape title, h1, and content from HTML', async () => {
    const mockHtml = `
      <html>
        <head>
          <title>Test Page Title</title>
          <style>body { color: red; }</style>
        </head>
        <body>
          <nav>Menu</nav>
          <h1>Main Header</h1>
          <p>This is the <b>main</b> content.</p>
          <script>console.log('ignored');</script>
          <footer>Footer content</footer>
        </body>
      </html>
    `;

    (global.fetch as any).mockResolvedValue({
      ok: true,
      text: async () => mockHtml,
      status: 200,
      statusText: 'OK'
    });

    const result = await webScraperService.scrape('https://example.com');

    expect(result).not.toBeNull();
    expect(result?.title).toBe('Test Page Title');
    expect(result?.h1_tags).toContain('Main Header');
    expect(result?.main_content).toContain('This is the main content.');
    expect(result?.main_content).not.toContain('console.log');
    expect(result?.main_content).not.toContain('color: red');
    expect(result?.main_content).not.toContain('Menu');
    expect(result?.main_content).not.toContain('Footer content');
  });

  it('should handle fetch errors gracefully', async () => {
    (global.fetch as any).mockRejectedValue(new Error('Network error'));

    const result = await webScraperService.scrape('https://example.com/fail');

    expect(result).toBeNull();
  });

  it('should handle 404 errors', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      text: async () => 'Not Found'
    });

    const result = await webScraperService.scrape('https://example.com/404');

    expect(result).toBeNull();
  });

  it('should block unsafe URLs (SSRF protection)', async () => {
    const result = await webScraperService.scrape('http://localhost:3000');
    expect(result).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();

    const result2 = await webScraperService.scrape('http://127.0.0.1/admin');
    expect(result2).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();

    const result3 = await webScraperService.scrape('http://192.168.1.1/router');
    expect(result3).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('should keep cache, dns cache, and request time entries bounded with eviction metrics', () => {
    const scraper = new WebScraperService();
    const internal = scraper as any;

    internal.maxCacheEntries = 2;
    internal.maxDnsCacheEntries = 2;
    internal.maxRequestTimeEntries = 2;

    const now = Date.now();
    internal.cache.set('https://a.example.com', { result: { url: 'a', title: '', h1_tags: [], main_content: '', relevance_score: 1 }, timestamp: now });
    internal.cache.set('https://b.example.com', { result: { url: 'b', title: '', h1_tags: [], main_content: '', relevance_score: 1 }, timestamp: now });
    internal.cache.set('https://c.example.com', { result: { url: 'c', title: '', h1_tags: [], main_content: '', relevance_score: 1 }, timestamp: now });
    internal.evictLruEntries(internal.cache, internal.maxCacheEntries, () => {
      internal.cacheMetrics.cacheEvictions += 1;
    });

    internal.dnsCache.set('a.example.com', { ips: ['1.1.1.1'], timestamp: now });
    internal.dnsCache.set('b.example.com', { ips: ['1.1.1.2'], timestamp: now });
    internal.dnsCache.set('c.example.com', { ips: ['1.1.1.3'], timestamp: now });
    internal.evictLruEntries(internal.dnsCache, internal.maxDnsCacheEntries, () => {
      internal.cacheMetrics.dnsCacheEvictions += 1;
    });

    internal.requestTimes.set('a.example.com', [now]);
    internal.requestTimes.set('b.example.com', [now]);
    internal.requestTimes.set('c.example.com', [now]);
    internal.evictLruEntries(internal.requestTimes, internal.maxRequestTimeEntries, () => {
      internal.cacheMetrics.requestTimesEvictions += 1;
    });

    const stats = scraper.getCacheStats();
    expect(stats.cacheSize).toBeLessThanOrEqual(2);
    expect(stats.dnsCacheEntries).toBeLessThanOrEqual(2);
    expect(stats.rateLimitEntries).toBeLessThanOrEqual(2);
    expect(stats.cacheEvictions).toBeGreaterThan(0);
    expect(stats.dnsCacheEvictions).toBeGreaterThan(0);
    expect(stats.requestTimesEvictions).toBeGreaterThan(0);

    clearInterval(internal.cleanupTimer);
  });

  it('should record cache hit and miss metrics', async () => {
    const scraper = new WebScraperService();
    const internal = scraper as any;

    internal.cache.set('https://cached.example.com', {
      result: { url: 'https://cached.example.com', title: 'Cached', h1_tags: [], main_content: 'Cached', relevance_score: 50 },
      timestamp: Date.now(),
    });

    const hitResult = await scraper.scrape('https://cached.example.com');
    expect(hitResult?.title).toBe('Cached');

    internal.validateUrlAndGetSafeIP = vi.fn().mockResolvedValue({ ip: '93.184.216.34', hostname: 'miss.example.com' });
    (global.fetch as any).mockResolvedValue({
      ok: true,
      text: async () => '<html><head><title>Miss</title></head><body><h1>Miss</h1></body></html>',
      status: 200,
      statusText: 'OK',
      headers: { get: () => null },
    });

    await scraper.scrape('https://miss.example.com');

    const stats = scraper.getCacheStats();
    expect(stats.cacheHits).toBeGreaterThanOrEqual(1);
    expect(stats.cacheMisses).toBeGreaterThanOrEqual(1);

    clearInterval(internal.cleanupTimer);
  });
});
