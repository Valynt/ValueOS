import { beforeEach, describe, expect, it, vi } from "vitest";
import { WebScraperService } from "../WebScraperService";
import { logger } from "../../lib/logger.js";

describe("WebScraperService rate limiting", () => {
  let scraper: WebScraperService;

  beforeEach(() => {
    scraper = new WebScraperService();
    vi.restoreAllMocks();
  });

  it("uses Redis INCR/EXPIRE when a Redis client is available", async () => {
    const connect = vi.fn().mockResolvedValue(undefined);
    const incr = vi.fn().mockResolvedValue(1);
    const expire = vi.fn().mockResolvedValue(1);

    (scraper as unknown as { redis: unknown }).redis = {
      isOpen: false,
      connect,
      incr,
      expire,
    };

    const allowed = await (scraper as any).checkRateLimit("example.com");

    expect(allowed).toBe(true);
    expect(connect).toHaveBeenCalledTimes(1);
    expect(incr).toHaveBeenCalledWith("rate_limit:example.com");
    expect(expire).toHaveBeenCalledWith("rate_limit:example.com", 60);
  });

  it("falls back to in-memory rate limiting and emits fallback metric", async () => {
    const warnSpy = vi.spyOn(logger, "warn").mockImplementation(() => {});

    const allowed = await (scraper as any).checkRateLimit("fallback.example");

    expect(allowed).toBe(true);
    expect(warnSpy).toHaveBeenCalledWith("Web scraper in-memory rate limiting active", {
      metric: "web_scraper_rate_limit_fallback_active",
      hostname: "fallback.example",
      fallback: "in_memory",
    });
  });
});
