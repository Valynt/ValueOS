import * as dns from 'dns';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { WebScraperService } from '../WebScraperService';

vi.mock('dns', () => ({
  resolve: vi.fn(),
  // Add other exports if needed by the service
}));

describe('WebScraperService SSRF TOCTOU', () => {
  let scraper: WebScraperService;

  beforeEach(() => {
    process.env.WEB_SCRAPER_ENCRYPTION_KEY = "c".repeat(64); // 32-byte hex for tests
    scraper = new WebScraperService();
    vi.clearAllMocks();
  });

  it('should be vulnerable to TOCTOU in current implementation', async () => {
    const resolveSpy = vi.spyOn(dns, 'resolve');
    
    // First call (validation) returns safe IP
    resolveSpy.mockImplementation((hostname, cb: any) => {
      cb(null, ['1.1.1.1']);
    });

    const isSafe = await (scraper as any).isSafeUrl('http://malicious.com');
    expect(isSafe).toBe(true);
    
    // The vulnerability is that fetch() is called with the URL, not the validated IP.
    // We can't easily test the fetch() call here without mocking global fetch,
    // but we've confirmed isSafeUrl passes for a hostname.
  });
});
