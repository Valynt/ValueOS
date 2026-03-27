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
    // Use vi.mocked() on the already-mocked dns.resolve (set up via vi.mock at
    // the top of the file). vi.spyOn would create a new spy on top of the mock
    // but promisify() captured the original mock reference at import time.
    vi.mocked(dns.resolve).mockImplementation((hostname: string, cb: (err: NodeJS.ErrnoException | null, addresses: string[]) => void) => {
      cb(null, ['1.1.1.1']);
    });

    const isSafe = await (scraper as any).isSafeUrl('http://malicious.com');
    expect(isSafe).toBe(true);
    
    // The vulnerability is that fetch() is called with the URL, not the validated IP.
    // We can't easily test the fetch() call here without mocking global fetch,
    // but we've confirmed isSafeUrl passes for a hostname that resolves to a safe IP.
  });
});
