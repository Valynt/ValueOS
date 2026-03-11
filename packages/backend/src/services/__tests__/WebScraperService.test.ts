import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Must be set before the module is imported so the singleton proxy resolves correctly.
process.env.WEB_SCRAPER_ENCRYPTION_KEY = 'd'.repeat(64); // 32-byte hex for tests

import { webScraperService } from '../WebScraperService.js'

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
});
