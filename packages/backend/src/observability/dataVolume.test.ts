import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../lib/supabase.js", () => ({
  supabase: { from: vi.fn() },
}));

const mockGaugeSet = vi.fn();
const mockCounterInc = vi.fn();

vi.mock("../lib/observability/index.js", () => ({
  createObservableGauge: vi.fn(() => ({ set: mockGaugeSet })),
  createCounter: vi.fn(() => ({ inc: mockCounterInc, add: vi.fn() })),
}));

import { supabase } from "../lib/supabase.js";

import { checkTableVolume, recordPartialLoad } from "./dataVolume.js";

const mockFrom = supabase.from as ReturnType<typeof vi.fn>;

/** Build a chain that returns a specific count for .select(..., { count: "exact" }) */
function makeCountChain(count: number | null, error: unknown = null) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    gte: vi.fn().mockResolvedValue({ count, error }),
  };
}

describe("checkTableVolume", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("emits row delta gauge with 24 h count", async () => {
    // First call: 24 h window → 10 rows; second call: 7-day window → 70 rows
    mockFrom
      .mockReturnValueOnce(makeCountChain(10))
      .mockReturnValueOnce(makeCountChain(70));

    const result = await checkTableVolume("hypothesis_outputs", "org-1");

    expect(result.rowDelta24h).toBe(10);
    expect(mockGaugeSet).toHaveBeenCalledWith(10);
  });

  it("detects anomaly when 24 h delta drops >50% below 7-day average", async () => {
    // 7-day total = 70 → daily avg = 10; today = 3 → drop = 70% → anomaly
    mockFrom
      .mockReturnValueOnce(makeCountChain(3))
      .mockReturnValueOnce(makeCountChain(70));

    const result = await checkTableVolume("hypothesis_outputs", "org-1");

    expect(result.anomalyDetected).toBe(true);
    expect(mockCounterInc).toHaveBeenCalledWith({ table: "hypothesis_outputs" });
  });

  it("does not flag anomaly when drop is ≤50%", async () => {
    // 7-day total = 70 → daily avg = 10; today = 6 → drop = 40% → no anomaly
    mockFrom
      .mockReturnValueOnce(makeCountChain(6))
      .mockReturnValueOnce(makeCountChain(70));

    const result = await checkTableVolume("hypothesis_outputs", "org-1");

    expect(result.anomalyDetected).toBe(false);
    expect(mockCounterInc).not.toHaveBeenCalled();
  });

  it("does not flag anomaly when 7-day average is zero (new table)", async () => {
    mockFrom
      .mockReturnValueOnce(makeCountChain(0))
      .mockReturnValueOnce(makeCountChain(0));

    const result = await checkTableVolume("hypothesis_outputs", "org-1");

    expect(result.anomalyDetected).toBe(false);
  });

  it("returns gracefully when Supabase query fails", async () => {
    mockFrom
      .mockReturnValueOnce(makeCountChain(null, { message: "timeout" }))
      .mockReturnValueOnce(makeCountChain(null, { message: "timeout" }));

    const result = await checkTableVolume("hypothesis_outputs", "org-1");

    expect(result.rowDelta24h).toBe(0);
    expect(result.anomalyDetected).toBe(false);
    expect(mockGaugeSet).not.toHaveBeenCalled();
  });

  it("scopes queries to organization_id", async () => {
    const chain24h = makeCountChain(5);
    const chain7d = makeCountChain(35);
    mockFrom.mockReturnValueOnce(chain24h).mockReturnValueOnce(chain7d);

    await checkTableVolume("hypothesis_outputs", "org-42");

    expect(chain24h.eq).toHaveBeenCalledWith("organization_id", "org-42");
    expect(chain7d.eq).toHaveBeenCalledWith("organization_id", "org-42");
  });
});

describe("recordPartialLoad", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("increments partial load counter with agent and table labels", () => {
    recordPartialLoad("OpportunityAgent", "hypothesis_outputs", "org-1");

    expect(mockCounterInc).toHaveBeenCalledWith({
      agent: "OpportunityAgent",
      table: "hypothesis_outputs",
    });
  });
});
