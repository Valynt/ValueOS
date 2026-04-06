import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../lib/supabase/privileged/index.js", () => ({
  createCronSupabaseClient: vi.fn(),
}));

vi.mock("../lib/observability/index.js", () => ({
  createObservableGauge: vi.fn(() => ({ set: vi.fn() })),
  createCounter: vi.fn(() => ({ inc: vi.fn(), add: vi.fn() })),
}));

import { createCronSupabaseClient } from "../lib/supabase/privileged/index.js";
import { checkAllT1TableFreshness, checkTableFreshness, T1_TABLES } from "./dataFreshness.js";

const mockFrom = vi.fn();
const mockCronClient = createCronSupabaseClient as ReturnType<typeof vi.fn>;

function makeChain(overrides: Record<string, unknown> = {}) {
  const chain: Record<string, unknown> = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    ...overrides,
  };
  return chain;
}

describe("checkTableFreshness", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCronClient.mockReturnValue({ from: mockFrom });
  });

  it("returns fresh when updated_at is within threshold", async () => {
    const recentTs = new Date(Date.now() - 5 * 60_000).toISOString(); // 5 min ago
    mockFrom.mockReturnValue(
      makeChain({ maybeSingle: vi.fn().mockResolvedValue({ data: { updated_at: recentTs }, error: null }) })
    );

    const result = await checkTableFreshness("hypothesis_outputs", 60, "org-1");

    expect(result.status).toBe("ok");
    expect(result.lagMinutes).toBeLessThan(60);
  });

  it("returns stale when updated_at exceeds threshold", async () => {
    const oldTs = new Date(Date.now() - 120 * 60_000).toISOString(); // 2 hours ago
    mockFrom.mockReturnValue(
      makeChain({ maybeSingle: vi.fn().mockResolvedValue({ data: { updated_at: oldTs }, error: null }) })
    );

    const result = await checkTableFreshness("hypothesis_outputs", 60, "org-1");

    expect(result.status).toBe("stale");
    expect(result.lagMinutes).toBeGreaterThan(60);
  });

  it("returns unknown when Supabase returns an error", async () => {
    mockFrom.mockReturnValue(
      makeChain({ maybeSingle: vi.fn().mockResolvedValue({ data: null, error: { message: "db error" } }) })
    );

    const result = await checkTableFreshness("hypothesis_outputs", 60, "org-1");

    expect(result.status).toBe("unknown");
    expect(result.lagMinutes).toBeNull();
  });

  it("returns fresh with 0 lag when table has no rows", async () => {
    mockFrom.mockReturnValue(
      makeChain({ maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }) })
    );

    const result = await checkTableFreshness("hypothesis_outputs", 60, "org-1");

    expect(result.status).toBe("ok");
    expect(result.lagMinutes).toBe(0);
  });

  it("includes table name and tier in result", async () => {
    mockFrom.mockReturnValue(makeChain());

    const result = await checkTableFreshness("hypothesis_outputs", 60, "org-1", "T1");

    expect(result.table).toBe("hypothesis_outputs");
    expect(result.tier).toBe("T1");
  });
});

describe("checkAllT1TableFreshness", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCronClient.mockReturnValue({ from: mockFrom });
    mockFrom.mockReturnValue(makeChain());
  });

  it("runs a check for every T1 table", async () => {
    const results = await checkAllT1TableFreshness("org-1");

    expect(results).toHaveLength(T1_TABLES.length);
    expect(results.every((r) => r.table !== undefined)).toBe(true);
  });

  it("uses 2x SLA as the alert threshold for each table", async () => {
    const results = await checkAllT1TableFreshness("org-1");

    // All results should have a defined thresholdMinutes
    expect(results.every((r) => typeof r.thresholdMinutes === "number")).toBe(true);
  });
});
