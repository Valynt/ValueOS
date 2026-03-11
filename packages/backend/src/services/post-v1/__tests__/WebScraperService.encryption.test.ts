// @vitest-environment node
/**
 * WebScraperService — encryption key validation tests
 *
 * Verifies that the service fails fast when WEB_SCRAPER_ENCRYPTION_KEY is
 * absent rather than silently generating a random key that changes on restart.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("cheerio", () => ({ load: vi.fn(() => () => ({})) }));
vi.mock("ipaddr.js", () => ({ parse: vi.fn(), isValid: vi.fn(() => true) }));
vi.mock("redis", () => ({
  createClient: vi.fn(() => ({
    connect: vi.fn(),
    get: vi.fn(),
    set: vi.fn(),
    incr: vi.fn(),
    expire: vi.fn(),
    isOpen: false,
  })),
}));
vi.mock("../../../lib/logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  createLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() })),
}));

import { WebScraperService, getWebScraperService, resetWebScraperService } from "../WebScraperService.js";

describe("WebScraperService encryption key validation", () => {
  const originalKey = process.env.WEB_SCRAPER_ENCRYPTION_KEY;

  afterEach(() => {
    // Reset the singleton so the next test constructs a fresh instance with
    // whatever WEB_SCRAPER_ENCRYPTION_KEY is set at that point.
    resetWebScraperService();

    if (originalKey === undefined) {
      delete process.env.WEB_SCRAPER_ENCRYPTION_KEY;
    } else {
      process.env.WEB_SCRAPER_ENCRYPTION_KEY = originalKey;
    }
  });

  it("throws at construction when WEB_SCRAPER_ENCRYPTION_KEY is not set", () => {
    delete process.env.WEB_SCRAPER_ENCRYPTION_KEY;

    expect(() => new WebScraperService()).toThrowError(
      /WEB_SCRAPER_ENCRYPTION_KEY environment variable is required/,
    );
  });

  it("error message includes key generation instructions", () => {
    delete process.env.WEB_SCRAPER_ENCRYPTION_KEY;

    let message = "";
    try {
      new WebScraperService();
    } catch (err) {
      message = (err as Error).message;
    }

    expect(message).toContain("randomBytes(32)");
  });

  it("constructs successfully when WEB_SCRAPER_ENCRYPTION_KEY is set", () => {
    process.env.WEB_SCRAPER_ENCRYPTION_KEY = "a".repeat(64);

    const service = new WebScraperService();
    expect(service).toBeDefined();
    service.destroy();
  });

  it("getWebScraperService() returns the same instance on repeated calls", () => {
    process.env.WEB_SCRAPER_ENCRYPTION_KEY = "b".repeat(64);

    const a = getWebScraperService();
    const b = getWebScraperService();

    expect(a).toBe(b);
  });
});
