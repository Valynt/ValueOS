// @vitest-environment node
/**
 * FinancialCalculationTool — unit tests
 *
 * Verifies input validation guards and that calculation methods delegate to
 * executePython with the correct code. The E2B sandbox is not invoked; all
 * tests mock executePython on the underlying SandboxedExecutor instance.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../utils/logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("@e2b/code-interpreter", () => ({
  Sandbox: { create: vi.fn() },
}));

import { FinancialCalculationTool, SandboxedExecutor } from "./SandboxedExecutor.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeCalculator(): { tool: FinancialCalculationTool; execSpy: ReturnType<typeof vi.spyOn> } {
  const tool = new FinancialCalculationTool();
  // Access the private executor via type cast to spy on it without E2B calls.
  const executor = (tool as unknown as { executor: SandboxedExecutor }).executor;
  const execSpy = vi.spyOn(executor, "executePython");
  return { tool, execSpy };
}

function successResult(stdout: string) {
  return Promise.resolve({ success: true, stdout, duration: 1 });
}

// ---------------------------------------------------------------------------
// assertFinite guards — calculateNPV
// ---------------------------------------------------------------------------

describe("FinancialCalculationTool.calculateNPV", () => {
  it("throws when discountRate is NaN", async () => {
    const { tool } = makeCalculator();
    await expect(tool.calculateNPV([100, 200], NaN)).rejects.toThrow(
      "discountRate must be a finite number"
    );
  });

  it("throws when discountRate is Infinity", async () => {
    const { tool } = makeCalculator();
    await expect(tool.calculateNPV([100, 200], Infinity)).rejects.toThrow(
      "discountRate must be a finite number"
    );
  });

  it("throws when discountRate is -Infinity", async () => {
    const { tool } = makeCalculator();
    await expect(tool.calculateNPV([100, 200], -Infinity)).rejects.toThrow(
      "discountRate must be a finite number"
    );
  });

  it("throws when cashFlows contains NaN", async () => {
    const { tool } = makeCalculator();
    await expect(tool.calculateNPV([100, NaN, 200], 0.1)).rejects.toThrow(
      "cashFlows[1] must be a finite number"
    );
  });

  it("throws when cashFlows contains Infinity", async () => {
    const { tool } = makeCalculator();
    await expect(tool.calculateNPV([Infinity], 0.1)).rejects.toThrow(
      "cashFlows[0] must be a finite number"
    );
  });

  it("delegates to executePython and parses stdout as float", async () => {
    const { tool, execSpy } = makeCalculator();
    execSpy.mockReturnValueOnce(successResult("123.45\n"));

    const result = await tool.calculateNPV([-1000, 500, 600], 0.1);

    expect(execSpy).toHaveBeenCalledOnce();
    expect(result).toBeCloseTo(123.45);
  });

  it("throws when executePython reports failure", async () => {
    const { tool, execSpy } = makeCalculator();
    execSpy.mockReturnValueOnce(Promise.resolve({ success: false, error: "NameError", duration: 1 }));

    await expect(tool.calculateNPV([-1000, 500], 0.1)).rejects.toThrow("NPV calculation failed");
  });
});

// ---------------------------------------------------------------------------
// assertFinite guards — calculateIRR
// ---------------------------------------------------------------------------

describe("FinancialCalculationTool.calculateIRR", () => {
  it("throws when cashFlows contains NaN", async () => {
    const { tool } = makeCalculator();
    await expect(tool.calculateIRR([NaN, 200])).rejects.toThrow(
      "cashFlows[0] must be a finite number"
    );
  });

  it("throws when cashFlows contains Infinity", async () => {
    const { tool } = makeCalculator();
    await expect(tool.calculateIRR([-1000, Infinity])).rejects.toThrow(
      "cashFlows[1] must be a finite number"
    );
  });

  it("delegates to executePython and parses stdout as float", async () => {
    const { tool, execSpy } = makeCalculator();
    execSpy.mockReturnValueOnce(successResult("0.15\n"));

    const result = await tool.calculateIRR([-1000, 600, 600]);

    expect(execSpy).toHaveBeenCalledOnce();
    expect(result).toBeCloseTo(0.15);
  });
});

// ---------------------------------------------------------------------------
// assertFinite guards — monteCarloSimulation
// ---------------------------------------------------------------------------

describe("FinancialCalculationTool.monteCarloSimulation", () => {
  const validParams = {
    initialValue: 1000,
    expectedReturn: 0.08,
    volatility: 0.15,
    periods: 12,
    simulations: 100,
  };

  it.each([
    ["initialValue", { ...validParams, initialValue: NaN }],
    ["expectedReturn", { ...validParams, expectedReturn: Infinity }],
    ["volatility", { ...validParams, volatility: -Infinity }],
    ["periods", { ...validParams, periods: NaN }],
    ["simulations", { ...validParams, simulations: Infinity }],
  ] as const)("throws when %s is non-finite", async (field, params) => {
    const { tool } = makeCalculator();
    await expect(tool.monteCarloSimulation(params)).rejects.toThrow(
      `${field} must be a finite number`
    );
  });

  it("delegates to executePython and parses JSON stdout", async () => {
    const { tool, execSpy } = makeCalculator();
    const payload = { mean: 1100, median: 1080, percentile5: 900, percentile95: 1300, results: [1100] };
    execSpy.mockReturnValueOnce(successResult(JSON.stringify(payload)));

    const result = await tool.monteCarloSimulation(validParams);

    expect(execSpy).toHaveBeenCalledOnce();
    expect(result).toMatchObject({ mean: 1100, median: 1080 });
  });
});

// ---------------------------------------------------------------------------
// assertFinite guards — calculatePaybackPeriod
// ---------------------------------------------------------------------------

describe("FinancialCalculationTool.calculatePaybackPeriod", () => {
  it("throws when initialInvestment is NaN", async () => {
    const { tool } = makeCalculator();
    await expect(tool.calculatePaybackPeriod(NaN, [500, 600])).rejects.toThrow(
      "initialInvestment must be a finite number"
    );
  });

  it("throws when initialInvestment is Infinity", async () => {
    const { tool } = makeCalculator();
    await expect(tool.calculatePaybackPeriod(Infinity, [500, 600])).rejects.toThrow(
      "initialInvestment must be a finite number"
    );
  });

  it("throws when cashFlows contains NaN", async () => {
    const { tool } = makeCalculator();
    await expect(tool.calculatePaybackPeriod(1000, [500, NaN])).rejects.toThrow(
      "cashFlows[1] must be a finite number"
    );
  });

  it("delegates to executePython and parses stdout as float", async () => {
    const { tool, execSpy } = makeCalculator();
    execSpy.mockReturnValueOnce(successResult("1.5\n"));

    const result = await tool.calculatePaybackPeriod(1000, [500, 600]);

    expect(execSpy).toHaveBeenCalledOnce();
    expect(result).toBeCloseTo(1.5);
  });

  it("returns -1 when investment is never recovered", async () => {
    const { tool, execSpy } = makeCalculator();
    execSpy.mockReturnValueOnce(successResult("-1\n"));

    const result = await tool.calculatePaybackPeriod(1000, [100, 100]);
    expect(result).toBe(-1);
  });
});
