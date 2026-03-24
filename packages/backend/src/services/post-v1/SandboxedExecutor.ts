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
