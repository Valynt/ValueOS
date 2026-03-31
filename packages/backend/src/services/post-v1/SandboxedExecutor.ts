import {
  SandboxedExecutor as CoreSandboxedExecutor,
  type SandboxedExecutionResult,
} from "../agents/SandboxedExecutor.js";

export interface SandboxConfig {
  language: "python" | "javascript";
  timeout?: number;
  environment?: Record<string, string>;
  tenantId?: string;
}

export interface ExecutionResult {
  success: boolean;
  output?: unknown;
  stdout?: string;
  stderr?: string;
  error?: string;
  duration: number;
  exitCode?: number | null;
  status: SandboxedExecutionResult["status"];
}

export class SandboxedExecutor {
  private readonly executor: CoreSandboxedExecutor;

  constructor(executor: CoreSandboxedExecutor = new CoreSandboxedExecutor()) {
    this.executor = executor;
  }

  async executePython(code: string, config: Partial<SandboxConfig> = {}): Promise<ExecutionResult> {
    return this.execute(code, { ...config, language: "python" });
  }

  async executeJavaScript(code: string, config: Partial<SandboxConfig> = {}): Promise<ExecutionResult> {
    return this.execute(code, { ...config, language: "javascript" });
  }

  async execute(code: string, config: SandboxConfig): Promise<ExecutionResult> {
    const result = await this.executor.execute({
      code,
      language: config.language,
      timeoutMs: config.timeout,
      environment: config.environment,
      tenantId: config.tenantId ?? "system",
    });

    return {
      success: result.status === "completed",
      output: undefined,
      stdout: result.stdout || undefined,
      stderr: result.stderr || undefined,
      error: result.error,
      duration: result.durationMs,
      exitCode: result.exitCode,
      status: result.status,
    };
  }
}

export const sandboxedExecutor = new SandboxedExecutor();

// ---------------------------------------------------------------------------
// FinancialCalculationTool
//
// Delegates financial calculations to a Python sandbox so the Node process
// never executes untrusted numeric code directly.
// ---------------------------------------------------------------------------

function assertFinite(value: number, name: string): void {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new RangeError(`${name} must be a finite number`);
  }
}

function assertFiniteArray(values: number[], name: string): void {
  values.forEach((v, i) => {
    if (typeof v !== "number" || !Number.isFinite(v)) {
      throw new RangeError(`${name}[${i}] must be a finite number`);
    }
  });
}

export interface MonteCarloParams {
  initialValue: number;
  expectedReturn: number;
  volatility: number;
  periods: number;
  simulations: number;
}

export interface MonteCarloResult {
  mean: number;
  median: number;
  percentile5: number;
  percentile95: number;
  results: number[];
}

export class FinancialCalculationTool {
  private readonly executor: SandboxedExecutor;

  constructor(executor: SandboxedExecutor = new SandboxedExecutor()) {
    this.executor = executor;
  }

  async calculateNPV(cashFlows: number[], discountRate: number): Promise<number> {
    assertFinite(discountRate, "discountRate");
    assertFiniteArray(cashFlows, "cashFlows");

    const code = `
import json
cash_flows = ${JSON.stringify(cashFlows)}
rate = ${discountRate}
npv = sum(cf / (1 + rate) ** t for t, cf in enumerate(cash_flows))
print(npv)
`.trim();

    const result = await this.executor.executePython(code);
    if (!result.success) throw new Error(`NPV calculation failed: ${result.error}`);
    return parseFloat(result.stdout!.trim());
  }

  async calculateIRR(cashFlows: number[]): Promise<number> {
    assertFiniteArray(cashFlows, "cashFlows");

    const code = `
import numpy_financial as npf
cash_flows = ${JSON.stringify(cashFlows)}
print(npf.irr(cash_flows))
`.trim();

    const result = await this.executor.executePython(code);
    if (!result.success) throw new Error(`IRR calculation failed: ${result.error}`);
    return parseFloat(result.stdout!.trim());
  }

  async monteCarloSimulation(params: MonteCarloParams): Promise<MonteCarloResult> {
    assertFinite(params.initialValue, "initialValue");
    assertFinite(params.expectedReturn, "expectedReturn");
    assertFinite(params.volatility, "volatility");
    assertFinite(params.periods, "periods");
    assertFinite(params.simulations, "simulations");
    if (!Number.isInteger(params.periods) || params.periods < 1) {
      throw new RangeError("periods must be a positive integer");
    }
    if (!Number.isInteger(params.simulations) || params.simulations < 1) {
      throw new RangeError("simulations must be a positive integer");
    }

    const code = `
import json, random, math
random.seed(42)
results = []
for _ in range(${params.simulations}):
    v = ${params.initialValue}
    for _ in range(${params.periods}):
        v *= math.exp((${params.expectedReturn} - 0.5 * ${params.volatility}**2) + ${params.volatility} * random.gauss(0, 1))
    results.append(v)
results.sort()
n = len(results)
print(json.dumps({
  "mean": sum(results)/n,
  "median": results[n//2],
  "percentile5": results[int(n*0.05)],
  "percentile95": results[int(n*0.95)],
  "results": results
}))
`.trim();

    const result = await this.executor.executePython(code);
    if (!result.success) throw new Error(`Monte Carlo simulation failed: ${result.error}`);
    return JSON.parse(result.stdout!.trim()) as MonteCarloResult;
  }

  async calculatePaybackPeriod(initialInvestment: number, cashFlows: number[]): Promise<number> {
    assertFinite(initialInvestment, "initialInvestment");
    assertFiniteArray(cashFlows, "cashFlows");

    const code = `
investment = ${initialInvestment}
cash_flows = ${JSON.stringify(cashFlows)}
cumulative = 0
for i, cf in enumerate(cash_flows):
    cumulative += cf
    if cumulative >= investment:
        prev = cumulative - cf
        fraction = (investment - prev) / cf
        print(i + fraction)
        exit()
print(-1)
`.trim();

    const result = await this.executor.executePython(code);
    if (!result.success) throw new Error(`Payback period calculation failed: ${result.error}`);
    return parseFloat(result.stdout!.trim());
  }
}
