import { beforeEach, describe, expect, it, vi } from "vitest";

import { BILLING_METRICS } from "../../../config/billing.js";
import UsageCache from "../UsageCache.js";

const { mockLogger } = vi.hoisted(() => ({
  mockLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock("../../../lib/logger.js", () => ({
  createLogger: vi.fn(() => mockLogger),
}));

vi.mock("ioredis", () => ({
  default: vi.fn().mockImplementation(() => ({
    isReady: false,
    on: vi.fn(),
    get: vi.fn(),
    setex: vi.fn(),
    del: vi.fn(),
  })),
}));

describe("UsageCache.refreshCache", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("attempts all metrics even when one metric refresh fails", async () => {
    const cache = new UsageCache({} as never);
    const tenantId = "tenant-1";
    const failingMetric = BILLING_METRICS[1];

    const fetchUsageSpy = vi
      .spyOn(cache as object, "fetchUsageFromDB" as never)
      .mockImplementation(async (_tenantId: string, metric: string) => {
        if (metric === failingMetric) {
          throw new Error("usage fetch failed");
        }
        return 10;
      });

    const fetchQuotaSpy = vi
      .spyOn(cache as object, "fetchQuotaFromDB" as never)
      .mockResolvedValue(100);

    const setSpy = vi
      .spyOn(cache as object, "set" as never)
      .mockResolvedValue(undefined);

    await expect(cache.refreshCache(tenantId)).resolves.toBeUndefined();

    expect(fetchUsageSpy).toHaveBeenCalledTimes(BILLING_METRICS.length);
    expect(fetchQuotaSpy).toHaveBeenCalledTimes(BILLING_METRICS.length);
    expect(setSpy).toHaveBeenCalledTimes((BILLING_METRICS.length - 1) * 2);
    expect(mockLogger.error).toHaveBeenCalledWith(
      "Error refreshing cache",
      expect.any(Error),
      { tenantId, metric: failingMetric }
    );
    expect(mockLogger.info).toHaveBeenCalledWith("Cache refreshed", { tenantId });
  });

  it("preserves success logging and cache write behavior for each metric", async () => {
    const cache = new UsageCache({} as never);
    const tenantId = "tenant-2";

    vi.spyOn(cache as object, "fetchUsageFromDB" as never).mockResolvedValue(21);
    vi.spyOn(cache as object, "fetchQuotaFromDB" as never).mockResolvedValue(84);
    const setSpy = vi
      .spyOn(cache as object, "set" as never)
      .mockResolvedValue(undefined);

    await expect(cache.refreshCache(tenantId)).resolves.toBeUndefined();

    expect(setSpy).toHaveBeenCalledTimes(BILLING_METRICS.length * 2);
    for (const metric of BILLING_METRICS) {
      expect(setSpy).toHaveBeenCalledWith(`usage:${tenantId}:${metric}`, 21);
      expect(setSpy).toHaveBeenCalledWith(`quota:${tenantId}:${metric}`, 84);
    }

    expect(mockLogger.error).not.toHaveBeenCalledWith(
      "Error refreshing cache",
      expect.anything(),
      expect.anything()
    );
    expect(mockLogger.info).toHaveBeenCalledWith("Cache refreshed", { tenantId });
  });
});
