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

function assertFiniteNumber(value: number, name: string): void {
  if (!Number.isFinite(value)) {
    throw new Error(`${name} must be a finite number, got ${value}`);
  }
}

function assertFiniteArray(values: number[], name: string): void {
  for (let i = 0; i < values.length; i++) {
    if (!Number.isFinite(values[i])) {
      throw new Error(`${name}[${i}] must be a finite number, got ${values[i]}`);
    }
  }
}

export class FinancialCalculationTool {
  private executor: SandboxedExecutor;

  constructor() {
    this.executor = new SandboxedExecutor();
  }

  async calculateNPV(cashFlows: number[], discountRate: number): Promise<number> {
    assertFiniteArray(cashFlows, "cashFlows");
    assertFiniteNumber(discountRate, "discountRate");
    const code = `
import numpy as np
cash_flows = ${JSON.stringify(cashFlows)}
discount_rate = ${discountRate}
npv = sum([cf / (1 + discount_rate) ** i for i, cf in enumerate(cash_flows)])
print(npv)
`;
    const result = await this.executor.executePython(code, { timeout: 5000 });
    if (!result.success) throw new Error(`NPV calculation failed: ${result.error}`);
    return parseFloat(result.stdout || "0");
  }

  async calculateIRR(cashFlows: number[]): Promise<number> {
    assertFiniteArray(cashFlows, "cashFlows");
    const code = `
cash_flows = ${JSON.stringify(cashFlows)}

def npv(rate, cfs):
    return sum([cf / (1 + rate) ** i for i, cf in enumerate(cfs)])

def npv_deriv(rate, cfs):
    return sum([-i * cf / (1 + rate) ** (i + 1) for i, cf in enumerate(cfs)])

rate = 0.1
for _ in range(100):
    v = npv(rate, cash_flows)
    d = npv_deriv(rate, cash_flows)
    if abs(d) < 1e-10 or abs(v) < 1e-10:
        break
    rate = rate - v / d

print(rate)
`;
    const result = await this.executor.executePython(code, { timeout: 5000 });
    if (!result.success) throw new Error(`IRR calculation failed: ${result.error}`);
    return parseFloat(result.stdout || "0");
  }

  async monteCarloSimulation(params: {
    initialValue: number;
    expectedReturn: number;
    volatility: number;
    periods: number;
    simulations: number;
  }): Promise<{ mean: number; median: number; percentile5: number; percentile95: number; results: number[] }> {
    assertFiniteNumber(params.initialValue, "initialValue");
    assertFiniteNumber(params.expectedReturn, "expectedReturn");
    assertFiniteNumber(params.volatility, "volatility");
    assertFiniteNumber(params.periods, "periods");
    assertFiniteNumber(params.simulations, "simulations");
    const code = `
import numpy as np, json
np.random.seed(42)
results = []
for _ in range(${params.simulations}):
    v = ${params.initialValue}
    for _ in range(${params.periods}):
        v *= (1 + np.random.normal(${params.expectedReturn}, ${params.volatility}))
    results.append(v)
a = np.array(results)
print(json.dumps({'mean': float(np.mean(a)), 'median': float(np.median(a)),
    'percentile5': float(np.percentile(a, 5)), 'percentile95': float(np.percentile(a, 95)),
    'results': a.tolist()[:100]}))
`;
    const result = await this.executor.executePython(code, { timeout: 10000 });
    if (!result.success) throw new Error(`Monte Carlo simulation failed: ${result.error}`);
    return JSON.parse(result.stdout || "{}") as {
      mean: number;
      median: number;
      percentile5: number;
      percentile95: number;
      results: number[];
    };
  }

  async calculatePaybackPeriod(initialInvestment: number, cashFlows: number[]): Promise<number> {
    assertFiniteNumber(initialInvestment, "initialInvestment");
    assertFiniteArray(cashFlows, "cashFlows");
    const code = `
initial_investment = ${initialInvestment}
cash_flows = ${JSON.stringify(cashFlows)}
cumulative = 0
for i, cf in enumerate(cash_flows):
    cumulative += cf
    if cumulative >= initial_investment:
        prev = cumulative - cf
        print(i + (initial_investment - prev) / cf)
        break
else:
    print(-1)
`;
    const result = await this.executor.executePython(code, { timeout: 5000 });
    if (!result.success) throw new Error(`Payback period calculation failed: ${result.error}`);
    return parseFloat(result.stdout || "-1");
  }
}

export const sandboxedExecutor = new SandboxedExecutor();
export const financialCalculator = new FinancialCalculationTool();
