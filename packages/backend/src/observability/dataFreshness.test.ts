import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../lib/supabase.js", () => ({
  supabase: { from: vi.fn() },
}));

vi.mock("../lib/observability/index.js", () => ({
  createObservableGauge: vi.fn(() => ({ set: vi.fn() })),
  createCounter: vi.fn(() => ({ inc: vi.fn(), add: vi.fn() })),
}));

import { supabase } from "../lib/supabase.js";
import { checkTableFreshness, checkAllT1TableFreshness, T1_TABLES } from "./dataFreshness.js";

const mockFrom = supabase.from as ReturnType<typeof vi.fn>;

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
  });

  it("returns ok when updated_at is within threshold", async () => {
    const recentDate = new Date(Date.now() - 2 * 60_000).toISOString(); // 2 min ago
    const chain = makeChain({
      maybeSingle: vi.fn().mockResolvedValue({
        data: { updated_at: recentDate },
        error: null,
      }),
    });
    mockFrom.mockReturnValue(chain);

    const result = await checkTableFreshness("hypothesis_outputs", 20, "org-1");

    expect(result.status).toBe("ok");
    expect(result.lagMinutes).toBeGreaterThan(0);
    expect(result.lagMinutes).toBeLessThan(20);
    expect(chain.eq).toHaveBeenCalledWith("organization_id", "org-1");
  });

  it("returns stale when lag exceeds threshold", async () => {
    const oldDate = new Date(Date.now() - 60 * 60_000).toISOString(); // 60 min ago
    const chain = makeChain({
      maybeSingle: vi.fn().mockResolvedValue({
        data: { updated_at: oldDate },
        error: null,
      }),
    });
    mockFrom.mockReturnValue(chain);

    const result = await checkTableFreshness("hypothesis_outputs", 20, "org-1");

    expect(result.status).toBe("stale");
    expect(result.lagMinutes).toBeGreaterThan(20);
  });

  it("returns ok with lagMinutes=0 when table has no rows", async () => {
    const chain = makeChain({
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    });
    mockFrom.mockReturnValue(chain);

    const result = await checkTableFreshness("hypothesis_outputs", 20, "org-1");

    expect(result.status).toBe("ok");
    expect(result.lagMinutes).toBe(0);
  });

  it("returns unknown when Supabase returns an error", async () => {
    const chain = makeChain({
      maybeSingle: vi.fn().mockResolvedValue({
        data: null,
        error: { message: "connection refused" },
      }),
    });
    mockFrom.mockReturnValue(chain);

    const result = await checkTableFreshness("hypothesis_outputs", 20, "org-1");

    expect(result.status).toBe("unknown");
    expect(result.lagMinutes).toBeNull();
  });

  it("includes table name and tier in result", async () => {
    const chain = makeChain({
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    });
    mockFrom.mockReturnValue(chain);

    const result = await checkTableFreshness("semantic_memory", 60, "org-1", "T1");

    expect(result.table).toBe("semantic_memory");
    expect(result.tier).toBe("T1");
    expect(result.thresholdMinutes).toBe(60);
  });
});

describe("checkAllT1TableFreshness", () => {
  it("runs a check for every T1 table", async () => {
    const chain = makeChain({
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    });
    mockFrom.mockReturnValue(chain);

    const results = await checkAllT1TableFreshness("org-1");

    expect(results).toHaveLength(T1_TABLES.length);
    expect(results.every((r) => r.tier === "T1")).toBe(true);
  });

  it("uses 2× SLA as the alert threshold for each table", async () => {
    const chain = makeChain({
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    });
    mockFrom.mockReturnValue(chain);

    const results = await checkAllT1TableFreshness("org-1");

    for (const result of results) {
      const entry = T1_TABLES.find((t) => t.table === result.table);
      expect(result.thresholdMinutes).toBe((entry?.slaMinutes ?? 0) * 2);
    }
  });
});
