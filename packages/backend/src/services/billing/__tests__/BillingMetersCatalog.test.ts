/**
 * BillingMetersCatalog Tests
 *
 * Validates caching, lookup, and reload behaviour.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const SEED_METERS = [
  { meter_key: "ai_tokens", display_name: "AI Tokens", unit: "tokens", aggregation: "sum", dimensions_schema: {}, created_at: "2026-01-01" },
  { meter_key: "api_calls", display_name: "API Calls", unit: "calls", aggregation: "sum", dimensions_schema: {}, created_at: "2026-01-01" },
  { meter_key: "storage_gb", display_name: "Storage", unit: "GB", aggregation: "max", dimensions_schema: {}, created_at: "2026-01-01" },
];

let mockQueryResult: { data: unknown; error: unknown } = { data: SEED_METERS, error: null };

const mockOrder = vi.fn(() => Promise.resolve(mockQueryResult));
const mockSelect = vi.fn(() => ({ order: mockOrder }));
const mockFrom = vi.fn(() => ({ select: mockSelect }));

vi.mock("../../../lib/supabase.js", () => ({
  assertNotTestEnv: vi.fn(),
  supabase: { from: (...args: unknown[]) => mockFrom(...args) },
}));

vi.mock("../../../lib/logger.js", () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

describe("BillingMetersCatalog", () => {
  let catalog: { default: Record<string, (...args: unknown[]) => Promise<unknown>> };

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    mockQueryResult = { data: SEED_METERS, error: null };
    catalog = await import("../BillingMetersCatalog");
  });

  it("listMeters returns all seeded meters", async () => {
    const meters = (await catalog.default.listMeters()) as unknown[];
    expect(meters).toHaveLength(3);
    expect(mockFrom).toHaveBeenCalledWith("billing_meters");
  });

  it("getMeter returns a single meter by key", async () => {
    const meter = (await catalog.default.getMeter("ai_tokens")) as Record<string, unknown>;
    expect(meter).not.toBeNull();
    expect(meter.meter_key).toBe("ai_tokens");
    expect(meter.aggregation).toBe("sum");
  });

  it("getMeter returns null for unknown key", async () => {
    const meter = await catalog.default.getMeter("nonexistent");
    expect(meter).toBeNull();
  });

  it("isValidMeter returns true for known meters", async () => {
    expect(await catalog.default.isValidMeter("api_calls")).toBe(true);
  });

  it("isValidMeter returns false for unknown meters", async () => {
    expect(await catalog.default.isValidMeter("nonexistent")).toBe(false);
  });

  it("caches after first load (only one DB call for multiple reads)", async () => {
    await catalog.default.listMeters();
    await catalog.default.getMeter("ai_tokens");
    await catalog.default.isValidMeter("api_calls");
    // Only the first call should hit the DB
    expect(mockFrom).toHaveBeenCalledTimes(1);
  });

  it("reload clears cache and re-fetches", async () => {
    await catalog.default.listMeters();
    expect(mockFrom).toHaveBeenCalledTimes(1);

    await catalog.default.reload();
    expect(mockFrom).toHaveBeenCalledTimes(2);
  });

  it("throws when supabase query fails", async () => {
    vi.resetModules();
    mockQueryResult = { data: null, error: { message: "connection refused", code: "ECONNREFUSED" } };
    const freshCatalog = await import("../BillingMetersCatalog");

    await expect(freshCatalog.default.listMeters()).rejects.toMatchObject({
      message: "connection refused",
    });
  });
});
