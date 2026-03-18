/**
 * Assumption sensitivity tests
 *
 * decimal.js cannot be resolved in the jsdom test environment (same constraint
 * as FinancialModelingAgent). We mock the economic_kernel module and also mock
 * decimal.js itself so the lazy import inside analyseAssumptionSensitivity
 * resolves cleanly. The tests exercise the domain-level logic: ranking,
 * impact calculation, and output structure.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// ─── Mocks (must be before imports) ──────────────────────────────────────────

vi.mock("../economic_kernel.js", () => ({
  sensitivityAnalysis: vi.fn(),
}));

// Provide a minimal Decimal stand-in so the lazy import inside the module works.
vi.mock("decimal.js", () => {
  class MockDecimal {
    private val: number;
    constructor(v: number | string) { this.val = Number(v); }
    toNumber() { return this.val; }
    isZero() { return this.val === 0; }
    gt(other: MockDecimal) { return this.val > other.val; }
    lt(other: MockDecimal) { return this.val < other.val; }
    minus(other: MockDecimal) { return new MockDecimal(this.val - other.val); }
    abs() { return new MockDecimal(Math.abs(this.val)); }
    times(other: MockDecimal) { return new MockDecimal(this.val * other.val); }
    plus(other: MockDecimal) { return new MockDecimal(this.val + other.val); }
    div(other: MockDecimal) { return new MockDecimal(this.val / other.val); }
    pow(n: number) { return new MockDecimal(Math.pow(this.val, n)); }
  }
  return { default: MockDecimal };
});

// ─── Imports ──────────────────────────────────────────────────────────────────

import { analyseAssumptionSensitivity } from "../assumptionSensitivity.js";
import { sensitivityAnalysis } from "../economic_kernel.js";

import type { Assumption } from "@valueos/shared/domain";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const NOW = new Date().toISOString();
const ORG = "00000000-0000-0000-0000-000000000001";
const OPP = "00000000-0000-0000-0000-000000000002";

function makeAssumption(
  id: string,
  name: string,
  value: number,
  sensitivity_range?: [number, number]
): Assumption {
  return {
    id,
    organization_id: ORG,
    opportunity_id: OPP,
    name,
    value,
    unit: "USD",
    source: "benchmark",
    human_reviewed: false,
    sensitivity_range,
    created_at: NOW,
    updated_at: NOW,
  };
}

/** Build a mock SensitivityResult whose output swing equals max(vals) - min(vals). */
function mockSensResult(name: string, baseValue: number, outputValues: number[]) {
  const mid = outputValues[Math.floor(outputValues.length / 2)];
  return {
    parameterName: name,
    baseValue: { toNumber: () => baseValue } as never,
    baseOutput: { toNumber: () => mid } as never,
    points: outputValues.map((v, i) => ({
      parameterValue: { toNumber: () => baseValue * (0.8 + i * 0.1) } as never,
      outputValue: {
        toNumber: () => v,
        gt: (other: { toNumber: () => number }) => v > other.toNumber(),
        lt: (other: { toNumber: () => number }) => v < other.toNumber(),
        minus: (other: { toNumber: () => number }) => ({
          abs: () => ({ toNumber: () => Math.abs(v - other.toNumber()) }),
        }),
      } as never,
    })),
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("analyseAssumptionSensitivity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns empty result for no assumptions", async () => {
    const result = await analyseAssumptionSensitivity([], () => 0);
    expect(result.ranked).toHaveLength(0);
    expect(result.highest_impact).toBeNull();
    expect(result.base_output).toBe(0);
  });

  it("calls sensitivityAnalysis once per assumption", async () => {
    const assumptions = [
      makeAssumption("a1", "Revenue", 1_000_000),
      makeAssumption("a2", "Cost", 200_000),
    ];

    const mockSens = vi.mocked(sensitivityAnalysis);
    mockSens
      .mockReturnValueOnce(mockSensResult("Revenue", 1_000_000, [0.5, 0.75, 1.0, 1.25, 1.5]) as never)
      .mockReturnValueOnce(mockSensResult("Cost", 200_000, [0.95, 0.975, 1.0, 1.025, 1.05]) as never);

    await analyseAssumptionSensitivity(assumptions, (vals) => vals["a1"]! - vals["a2"]!);

    expect(mockSens).toHaveBeenCalledTimes(2);
    expect(mockSens.mock.calls[0][0]).toBe("Revenue");
    expect(mockSens.mock.calls[1][0]).toBe("Cost");
  });

  it("ranks assumptions by output_swing descending", async () => {
    const assumptions = [
      makeAssumption("small", "Small", 10),
      makeAssumption("large", "Large", 10_000),
    ];

    const mockSens = vi.mocked(sensitivityAnalysis);
    // small: swing of 2; large: swing of 2000
    mockSens
      .mockReturnValueOnce(mockSensResult("Small", 10, [9, 10, 11]) as never)
      .mockReturnValueOnce(mockSensResult("Large", 10_000, [9_000, 10_000, 11_000]) as never);

    const result = await analyseAssumptionSensitivity(
      assumptions,
      (vals) => vals["small"]! + vals["large"]!
    );

    expect(result.ranked[0].assumption_id).toBe("large");
    expect(result.ranked[1].assumption_id).toBe("small");
    expect(result.ranked[0].output_swing).toBeGreaterThan(result.ranked[1].output_swing);
  });

  it("INVARIANT: highest_impact is the first element of ranked", async () => {
    const assumptions = [makeAssumption("a", "A", 500)];

    vi.mocked(sensitivityAnalysis).mockReturnValueOnce(
      mockSensResult("A", 500, [400, 500, 600]) as never
    );

    const result = await analyseAssumptionSensitivity(assumptions, (vals) => vals["a"]!);

    expect(result.highest_impact?.assumption_id).toBe(result.ranked[0]?.assumption_id);
  });

  it("sets relative_impact to null when base_output is zero", async () => {
    const assumptions = [makeAssumption("a", "A", 100)];

    vi.mocked(sensitivityAnalysis).mockReturnValueOnce(
      mockSensResult("A", 100, [90, 100, 110]) as never
    );

    const result = await analyseAssumptionSensitivity(assumptions, () => 0);
    expect(result.highest_impact?.relative_impact).toBeNull();
  });

  it("base_output matches direct evaluation at base values", async () => {
    const assumptions = [
      makeAssumption("rev", "Revenue", 500_000),
      makeAssumption("cost", "Cost", 200_000),
    ];

    vi.mocked(sensitivityAnalysis)
      .mockReturnValueOnce(mockSensResult("Revenue", 500_000, [400_000, 500_000, 600_000]) as never)
      .mockReturnValueOnce(mockSensResult("Cost", 200_000, [180_000, 200_000, 220_000]) as never);

    const evaluate = (vals: Record<string, number>) =>
      (vals["rev"]! - vals["cost"]!) / vals["cost"]!;

    const result = await analyseAssumptionSensitivity(assumptions, evaluate);
    const expected = evaluate({ rev: 500_000, cost: 200_000 });
    expect(result.base_output).toBeCloseTo(expected);
  });

  it("uses sensitivity_range perturbations when provided", async () => {
    const assumption = makeAssumption("a", "A", 1000, [0.9, 1.1]);

    vi.mocked(sensitivityAnalysis).mockReturnValueOnce(
      mockSensResult("A", 1000, [900, 950, 1000, 1050, 1100]) as never
    );

    await analyseAssumptionSensitivity([assumption], (vals) => vals["a"]!);

    const call = vi.mocked(sensitivityAnalysis).mock.calls[0];
    const perturbations = call[2] as Array<{ toNumber: () => number }>;
    expect(perturbations).toHaveLength(5);
    expect(perturbations[0].toNumber()).toBeCloseTo(0.9);
    expect(perturbations[4].toNumber()).toBeCloseTo(1.1);
  });

  it("uses default ±20% perturbations when no sensitivity_range", async () => {
    const assumption = makeAssumption("a", "A", 1000);

    vi.mocked(sensitivityAnalysis).mockReturnValueOnce(
      mockSensResult("A", 1000, [800, 900, 1000, 1100, 1200]) as never
    );

    await analyseAssumptionSensitivity([assumption], (vals) => vals["a"]!);

    const call = vi.mocked(sensitivityAnalysis).mock.calls[0];
    const perturbations = call[2] as Array<{ toNumber: () => number }>;
    expect(perturbations).toHaveLength(5);
    expect(perturbations[0].toNumber()).toBeCloseTo(0.8);
    expect(perturbations[4].toNumber()).toBeCloseTo(1.2);
  });
});
