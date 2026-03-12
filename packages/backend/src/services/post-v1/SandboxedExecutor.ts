/**
 * Sandboxed Code Execution Service
 *
 * Secure execution environment for agent-generated code using the E2B SDK.
 * Enables FinancialModelingAgent to run Python calculations (NPV, IRR, Monte Carlo)
 * that LLMs cannot reliably compute inline.
 *
 * Requires E2B_API_KEY environment variable.
 */

import { Sandbox } from '@e2b/code-interpreter';
import { logger } from '../utils/logger.js';

export interface SandboxConfig {
  language: 'python' | 'javascript';
  /** Execution timeout in milliseconds. Default: 30 000. */
  timeout?: number;
  environment?: Record<string, string>;
}

export interface ExecutionResult {
  success: boolean;
  output?: unknown;
  stdout?: string;
  stderr?: string;
  error?: string;
  duration: number;
}

// ---------------------------------------------------------------------------
// SandboxedExecutor
// ---------------------------------------------------------------------------

export class SandboxedExecutor {
  private readonly apiKey: string;

  constructor() {
    this.apiKey = process.env['E2B_API_KEY'] ?? '';
    if (!this.apiKey) {
      logger.warn('E2B_API_KEY not set — sandboxed execution disabled.');
    }
  }

  async executePython(code: string, config: Partial<SandboxConfig> = {}): Promise<ExecutionResult> {
    return this.execute(code, { ...config, language: 'python' });
  }

  async executeJavaScript(code: string, config: Partial<SandboxConfig> = {}): Promise<ExecutionResult> {
    return this.execute(code, { ...config, language: 'javascript' });
  }

  async execute(code: string, config: SandboxConfig): Promise<ExecutionResult> {
    if (!this.apiKey) {
      return { success: false, error: 'E2B_API_KEY not configured', duration: 0 };
    }

    const startTime = Date.now();
    const timeoutMs = config.timeout ?? 30_000;

    let sandbox: Sandbox | null = null;
    try {
      logger.info('Creating E2B sandbox', { language: config.language });

      sandbox = await Sandbox.create({
        apiKey: this.apiKey,
        timeoutMs,
        envVars: config.environment,
      });

      const execution = await sandbox.runCode(code);

      const duration = Date.now() - startTime;
      const stdout = execution.logs.stdout.join('');
      const stderr = execution.logs.stderr.join('');
      const hasError = execution.error !== null && execution.error !== undefined;

      logger.info('E2B execution completed', { success: !hasError, duration });

      return {
        success: !hasError,
        output: execution.results[0]?.data ?? undefined,
        stdout: stdout || undefined,
        stderr: stderr || undefined,
        error: hasError ? String(execution.error) : undefined,
        duration,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('E2B execution failed', { error: message, duration });
      return { success: false, error: message, duration };
    } finally {
      if (sandbox) {
        await sandbox.kill().catch((err: unknown) => {
          logger.warn('Failed to kill E2B sandbox', {
            error: err instanceof Error ? err.message : String(err),
          });
        });
      }
    }
  }

  /**
   * Validate code for dangerous patterns before sending to sandbox.
   * The sandbox itself is isolated, but this provides an early-exit signal.
   */
  validateCode(code: string, language: string): { safe: boolean; issues: string[] } {
    const issues: string[] = [];

    const dangerousPatterns: Record<string, RegExp[]> = {
      python: [
        /import\s+os\b/i,
        /import\s+subprocess\b/i,
        /import\s+sys\b/i,
        /\beval\s*\(/i,
        /\bexec\s*\(/i,
        /__import__\s*\(/i,
      ],
      javascript: [
        /require\s*\(\s*['"]fs['"]\s*\)/i,
        /require\s*\(\s*['"]child_process['"]\s*\)/i,
        /\beval\s*\(/i,
        /\bFunction\s*\(/i,
      ],
    };

    for (const pattern of dangerousPatterns[language] ?? []) {
      if (pattern.test(code)) {
        issues.push(`Dangerous pattern: ${pattern.source}`);
      }
    }

    return { safe: issues.length === 0, issues };
  }
}

// ---------------------------------------------------------------------------
// Input validation helpers
// ---------------------------------------------------------------------------

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

/**
 * Financial Calculation Tool using Sandboxed Execution
 */
export class FinancialCalculationTool {
  private executor: SandboxedExecutor;

  constructor() {
    this.executor = new SandboxedExecutor();
  }

  async calculateNPV(cashFlows: number[], discountRate: number): Promise<number> {
    assertFiniteArray(cashFlows, 'cashFlows');
    assertFiniteNumber(discountRate, 'discountRate');
    const code = `
import numpy as np
cash_flows = ${JSON.stringify(cashFlows)}
discount_rate = ${discountRate}
npv = sum([cf / (1 + discount_rate) ** i for i, cf in enumerate(cash_flows)])
print(npv)
`;
    const result = await this.executor.executePython(code, { timeout: 5000 });
    if (!result.success) throw new Error(`NPV calculation failed: ${result.error}`);
    return parseFloat(result.stdout || '0');
  }

  async calculateIRR(cashFlows: number[]): Promise<number> {
    assertFiniteArray(cashFlows, 'cashFlows');
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
    return parseFloat(result.stdout || '0');
  }

  async monteCarloSimulation(params: {
    initialValue: number;
    expectedReturn: number;
    volatility: number;
    periods: number;
    simulations: number;
  }): Promise<{ mean: number; median: number; percentile5: number; percentile95: number; results: number[] }> {
    assertFiniteNumber(params.initialValue, 'initialValue');
    assertFiniteNumber(params.expectedReturn, 'expectedReturn');
    assertFiniteNumber(params.volatility, 'volatility');
    assertFiniteNumber(params.periods, 'periods');
    assertFiniteNumber(params.simulations, 'simulations');
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
    return JSON.parse(result.stdout || '{}') as {
      mean: number; median: number; percentile5: number; percentile95: number; results: number[];
    };
  }

  async calculatePaybackPeriod(initialInvestment: number, cashFlows: number[]): Promise<number> {
    assertFiniteNumber(initialInvestment, 'initialInvestment');
    assertFiniteArray(cashFlows, 'cashFlows');
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
    return parseFloat(result.stdout || '-1');
  }
}

// Export singleton instances
export const sandboxedExecutor = new SandboxedExecutor();
export const financialCalculator = new FinancialCalculationTool();
