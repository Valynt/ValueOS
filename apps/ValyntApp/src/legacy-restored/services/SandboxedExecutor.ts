/**
 * Sandboxed Code Execution Service
 * 
 * Secure execution environment for agent-generated code.
 * Uses E2B (https://e2b.dev) for isolated code execution.
 * 
 * Enables Financial Modeling Agent to execute complex calculations
 * (NPV, IRR, Monte Carlo simulations) that LLMs struggle with directly.
 */

import { logger } from '../utils/logger';

export interface SandboxConfig {
  language: 'python' | 'javascript' | 'r';
  timeout?: number; // milliseconds
  memory?: string; // e.g., '128MB', '256MB'
  cpu?: number; // CPU cores
  environment?: Record<string, string>;
}

export interface ExecutionResult {
  success: boolean;
  output?: any;
  stdout?: string;
  stderr?: string;
  error?: string;
  duration: number;
  resourceUsage?: {
    memory: number;
    cpu: number;
  };
}

/**
 * Sandboxed Executor using E2B
 */
export class SandboxedExecutor {
  private apiKey: string;
  private baseUrl = 'https://api.e2b.dev/v1';

  constructor() {
    this.apiKey = process.env.E2B_API_KEY || '';
    
    if (!this.apiKey) {
      logger.warn('E2B API key not configured. Sandboxed execution disabled.');
    }
  }

  /**
   * Execute Python code in sandbox
   */
  async executePython(
    code: string,
    config: Partial<SandboxConfig> = {}
  ): Promise<ExecutionResult> {
    return this.execute(code, { ...config, language: 'python' });
  }

  /**
   * Execute JavaScript code in sandbox
   */
  async executeJavaScript(
    code: string,
    config: Partial<SandboxConfig> = {}
  ): Promise<ExecutionResult> {
    return this.execute(code, { ...config, language: 'javascript' });
  }

  /**
   * Execute code in sandbox
   */
  async execute(
    code: string,
    config: SandboxConfig
  ): Promise<ExecutionResult> {
    if (!this.apiKey) {
      return {
        success: false,
        error: 'E2B API key not configured',
        duration: 0,
      };
    }

    const startTime = Date.now();

    try {
      logger.info('Executing code in sandbox', {
        language: config.language,
        codeLength: code.length,
      });

      // Create sandbox session
      const session = await this.createSession(config);

      try {
        // Execute code
        const result = await this.runCode(session.id, code, config);

        const duration = Date.now() - startTime;

        logger.info('Sandbox execution completed', {
          success: result.success,
          duration,
        });

        return {
          ...result,
          duration,
        };
      } finally {
        // Always cleanup session
        await this.destroySession(session.id);
      }
    } catch (error) {
      const duration = Date.now() - startTime;

      logger.error('Sandbox execution failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        duration,
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration,
      };
    }
  }

  /**
   * Create sandbox session
   */
  private async createSession(config: SandboxConfig): Promise<{ id: string }> {
    // E2B API call to create session
    // This is a placeholder - actual implementation would use E2B SDK
    
    const response = await fetch(`${this.baseUrl}/sandboxes`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        template: this.getTemplate(config.language),
        timeout: config.timeout || 30000,
        memory: config.memory || '256MB',
        cpu: config.cpu || 1,
        environment: config.environment || {},
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to create sandbox: ${response.statusText}`);
    }

    const data = await response.json();
    return { id: data.sandboxId };
  }

  /**
   * Run code in session
   */
  private async runCode(
    sessionId: string,
    code: string,
    config: SandboxConfig
  ): Promise<Omit<ExecutionResult, 'duration'>> {
    // E2B API call to execute code
    // This is a placeholder - actual implementation would use E2B SDK
    
    const response = await fetch(`${this.baseUrl}/sandboxes/${sessionId}/execute`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        code,
        language: config.language,
      }),
    });

    if (!response.ok) {
      throw new Error(`Code execution failed: ${response.statusText}`);
    }

    const data = await response.json();

    return {
      success: data.exitCode === 0,
      output: data.output,
      stdout: data.stdout,
      stderr: data.stderr,
      error: data.error,
      resourceUsage: data.resourceUsage,
    };
  }

  /**
   * Destroy sandbox session
   */
  private async destroySession(sessionId: string): Promise<void> {
    try {
      await fetch(`${this.baseUrl}/sandboxes/${sessionId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
      });
    } catch (error) {
      logger.error('Failed to destroy sandbox session', {
        sessionId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Get template for language
   */
  private getTemplate(language: string): string {
    const templates: Record<string, string> = {
      python: 'python3',
      javascript: 'nodejs',
      r: 'r-base',
    };

    return templates[language] || 'python3';
  }

  /**
   * Validate code for security issues
   */
  validateCode(code: string, language: string): { safe: boolean; issues: string[] } {
    const issues: string[] = [];

    // Basic security checks
    const dangerousPatterns: Record<string, RegExp[]> = {
      python: [
        /import\s+os/i,
        /import\s+subprocess/i,
        /import\s+sys/i,
        /eval\s*\(/i,
        /exec\s*\(/i,
        /__import__/i,
      ],
      javascript: [
        /require\s*\(\s*['"]fs['"]\s*\)/i,
        /require\s*\(\s*['"]child_process['"]\s*\)/i,
        /eval\s*\(/i,
        /Function\s*\(/i,
      ],
    };

    const patterns = dangerousPatterns[language] || [];

    for (const pattern of patterns) {
      if (pattern.test(code)) {
        issues.push(`Potentially dangerous pattern detected: ${pattern.source}`);
      }
    }

    return {
      safe: issues.length === 0,
      issues,
    };
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

  /**
   * Calculate Net Present Value (NPV)
   */
  async calculateNPV(
    cashFlows: number[],
    discountRate: number
  ): Promise<number> {
    const code = `
import numpy as np

cash_flows = ${JSON.stringify(cashFlows)}
discount_rate = ${discountRate}

# Calculate NPV
npv = sum([cf / (1 + discount_rate) ** i for i, cf in enumerate(cash_flows)])

print(npv)
`;

    const result = await this.executor.executePython(code, {
      timeout: 5000,
      memory: '128MB',
    });

    if (!result.success) {
      throw new Error(`NPV calculation failed: ${result.error}`);
    }

    return parseFloat(result.stdout || '0');
  }

  /**
   * Calculate Internal Rate of Return (IRR)
   */
  async calculateIRR(cashFlows: number[]): Promise<number> {
    const code = `
import numpy as np

cash_flows = ${JSON.stringify(cashFlows)}

# Calculate IRR using Newton-Raphson method
def npv(rate, cash_flows):
    return sum([cf / (1 + rate) ** i for i, cf in enumerate(cash_flows)])

def npv_derivative(rate, cash_flows):
    return sum([-i * cf / (1 + rate) ** (i + 1) for i, cf in enumerate(cash_flows)])

# Newton-Raphson iteration
rate = 0.1  # Initial guess
for _ in range(100):
    npv_val = npv(rate, cash_flows)
    npv_deriv = npv_derivative(rate, cash_flows)
    
    if abs(npv_deriv) < 1e-10:
        break
    
    rate = rate - npv_val / npv_deriv
    
    if abs(npv_val) < 1e-10:
        break

print(rate)
`;

    const result = await this.executor.executePython(code, {
      timeout: 5000,
      memory: '128MB',
    });

    if (!result.success) {
      throw new Error(`IRR calculation failed: ${result.error}`);
    }

    return parseFloat(result.stdout || '0');
  }

  /**
   * Run Monte Carlo simulation
   */
  async monteCarloSimulation(
    params: {
      initialValue: number;
      expectedReturn: number;
      volatility: number;
      periods: number;
      simulations: number;
    }
  ): Promise<{
    mean: number;
    median: number;
    percentile5: number;
    percentile95: number;
    results: number[];
  }> {
    const code = `
import numpy as np

np.random.seed(42)

initial_value = ${params.initialValue}
expected_return = ${params.expectedReturn}
volatility = ${params.volatility}
periods = ${params.periods}
simulations = ${params.simulations}

# Run Monte Carlo simulation
results = []
for _ in range(simulations):
    value = initial_value
    for _ in range(periods):
        shock = np.random.normal(expected_return, volatility)
        value *= (1 + shock)
    results.append(value)

results = np.array(results)

# Calculate statistics
import json
output = {
    'mean': float(np.mean(results)),
    'median': float(np.median(results)),
    'percentile5': float(np.percentile(results, 5)),
    'percentile95': float(np.percentile(results, 95)),
    'results': results.tolist()[:100]  # Return first 100 for visualization
}

print(json.dumps(output))
`;

    const result = await this.executor.executePython(code, {
      timeout: 10000,
      memory: '256MB',
    });

    if (!result.success) {
      throw new Error(`Monte Carlo simulation failed: ${result.error}`);
    }

    return JSON.parse(result.stdout || '{}');
  }

  /**
   * Calculate payback period
   */
  async calculatePaybackPeriod(
    initialInvestment: number,
    cashFlows: number[]
  ): Promise<number> {
    const code = `
initial_investment = ${initialInvestment}
cash_flows = ${JSON.stringify(cashFlows)}

# Calculate payback period
cumulative = 0
for i, cf in enumerate(cash_flows):
    cumulative += cf
    if cumulative >= initial_investment:
        # Linear interpolation for fractional period
        previous_cumulative = cumulative - cf
        fraction = (initial_investment - previous_cumulative) / cf
        payback_period = i + fraction
        print(payback_period)
        break
else:
    print(-1)  # Investment not recovered
`;

    const result = await this.executor.executePython(code, {
      timeout: 5000,
      memory: '128MB',
    });

    if (!result.success) {
      throw new Error(`Payback period calculation failed: ${result.error}`);
    }

    return parseFloat(result.stdout || '-1');
  }
}

// Export singleton instances
export const sandboxedExecutor = new SandboxedExecutor();
export const financialCalculator = new FinancialCalculationTool();
