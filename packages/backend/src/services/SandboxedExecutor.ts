import { Sandbox } from "@e2b/code-interpreter";
import { z } from "zod";

import { createLogger } from "@shared/lib/logger";

const logger = createLogger({ component: "SandboxedExecutor" });

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MEMORY_LIMIT_MB = 256;
const DEFAULT_CPU_LIMIT_MS = 10_000;
const MAX_CODE_LENGTH = 100_000;

const executionRequestSchema = z.object({
  tenantId: z.string().min(1, "tenantId is required"),
  sessionId: z.string().min(1).optional(),
  language: z.enum(["python", "javascript"]),
  code: z.string().min(1, "code is required").max(MAX_CODE_LENGTH),
  timeoutMs: z.number().int().positive().max(120_000).optional(),
  memoryLimitMb: z.number().int().positive().max(2048).optional(),
  cpuLimitMs: z.number().int().positive().max(120_000).optional(),
  environment: z.record(z.string()).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const blockedCommandPatterns: Array<{ pattern: RegExp; reason: string }> = [
  { pattern: /\brm\s+-rf\b/i, reason: "rm -rf is not allowed" },
  { pattern: /\bsudo\b/i, reason: "sudo is not allowed" },
  { pattern: /\bchmod\s+777\b/i, reason: "chmod 777 is not allowed" },
  { pattern: /\beval\s*\(/i, reason: "eval() is not allowed" },
  { pattern: /\bkill\s+-9\b/i, reason: "kill -9 is not allowed" },
  { pattern: /\btruncate\b(?![^\n]*\bwhere\b)/i, reason: "TRUNCATE without guard is not allowed" },
  { pattern: /\bdrop\s+table\b(?![^\n]*\bwhere\b)/i, reason: "DROP TABLE is not allowed" },
];

export type SandboxedExecutionStatus =
  | "completed"
  | "failed"
  | "timeout"
  | "blocked"
  | "provider_error";

export interface SandboxedExecutionResult {
  status: SandboxedExecutionStatus;
  stdout: string;
  stderr: string;
  exitCode: number | null;
  timedOut: boolean;
  startedAt: string;
  endedAt: string;
  durationMs: number;
  resourceUsage: {
    requestedCpuLimitMs: number;
    requestedMemoryLimitMb: number;
    cpuTimeMs?: number;
    memoryBytes?: number;
  };
  provider: "e2b";
  tenantId: string;
  error?: string;
}

export type SandboxedExecutionRequest = z.input<typeof executionRequestSchema>;

type NormalizedExecutionRequest = z.output<typeof executionRequestSchema> & {
  timeoutMs: number;
  memoryLimitMb: number;
  cpuLimitMs: number;
};

interface ProviderExecutionResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  error?: string;
  cpuTimeMs?: number;
  memoryBytes?: number;
}

export interface SandboxProvider {
  execute(request: NormalizedExecutionRequest): Promise<ProviderExecutionResult>;
  dispose?(): Promise<void>;
}

class SandboxProviderError extends Error {
  constructor(message: string, public readonly code: "auth" | "quota" | "timeout" | "unknown" = "unknown") {
    super(message);
  }
}

export class E2BSandboxProvider implements SandboxProvider {
  private readonly apiKey: string;

  constructor(apiKey: string = process.env["E2B_API_KEY"] ?? "") {
    this.apiKey = apiKey;
  }

  async execute(request: NormalizedExecutionRequest): Promise<ProviderExecutionResult> {
    if (!this.apiKey) {
      throw new SandboxProviderError("E2B_API_KEY not configured", "auth");
    }

    let sandbox: Sandbox | null = null;
    try {
      sandbox = await Sandbox.create({
        apiKey: this.apiKey,
        timeoutMs: request.timeoutMs,
        envVars: {
          ...(request.environment ?? {}),
          VALUEOS_TENANT_ID: request.tenantId,
        },
      });

      const execution = await sandbox.runCode(request.code);
      return {
        stdout: execution.logs.stdout.join(""),
        stderr: execution.logs.stderr.join(""),
        exitCode: execution.error ? 1 : 0,
        error: execution.error ? String(execution.error) : undefined,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown provider error";
      if (/api key|unauthorized|forbidden/i.test(message)) {
        throw new SandboxProviderError(message, "auth");
      }
      if (/quota|limit/i.test(message)) {
        throw new SandboxProviderError(message, "quota");
      }
      throw new SandboxProviderError(message, "unknown");
    } finally {
      if (sandbox) {
        await sandbox.kill().catch(() => undefined);
      }
    }
  }
}

export class SandboxedExecutor {
  constructor(private readonly provider: SandboxProvider = new E2BSandboxProvider()) {}

  async execute(request: SandboxedExecutionRequest): Promise<SandboxedExecutionResult> {
    const normalized = this.normalizeRequest(request);
    const blockedReason = this.getBlockedCommandReason(normalized.code);

    const startedAtEpoch = Date.now();
    const startedAt = new Date(startedAtEpoch).toISOString();

    if (blockedReason) {
      return this.auditAndReturn(normalized, {
        status: "blocked",
        stdout: "",
        stderr: blockedReason,
        error: blockedReason,
        exitCode: null,
        timedOut: false,
        startedAt,
        endedAt: new Date().toISOString(),
        durationMs: Date.now() - startedAtEpoch,
        resourceUsage: {
          requestedCpuLimitMs: normalized.cpuLimitMs,
          requestedMemoryLimitMb: normalized.memoryLimitMb,
        },
        provider: "e2b",
        tenantId: normalized.tenantId,
      });
    }

    const timeoutResult = await this.executeWithTimeout(normalized, startedAtEpoch, startedAt);
    return this.auditAndReturn(normalized, timeoutResult);
  }

  private normalizeRequest(request: SandboxedExecutionRequest): NormalizedExecutionRequest {
    const parsed = executionRequestSchema.parse(request);
    return {
      ...parsed,
      timeoutMs: parsed.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      memoryLimitMb: parsed.memoryLimitMb ?? DEFAULT_MEMORY_LIMIT_MB,
      cpuLimitMs: parsed.cpuLimitMs ?? DEFAULT_CPU_LIMIT_MS,
    };
  }

  private getBlockedCommandReason(code: string): string | null {
    for (const { pattern, reason } of blockedCommandPatterns) {
      if (pattern.test(code)) {
        return reason;
      }
    }

    return null;
  }

  private async executeWithTimeout(
    request: NormalizedExecutionRequest,
    startedAtEpoch: number,
    startedAt: string
  ): Promise<SandboxedExecutionResult> {
    try {
      const providerExecution = await Promise.race([
        this.provider.execute(request),
        new Promise<ProviderExecutionResult>((_, reject) => {
          setTimeout(() => reject(new SandboxProviderError("Execution timed out", "timeout")), request.timeoutMs);
        }),
      ]);

      const endedAtEpoch = Date.now();
      return {
        status: providerExecution.error ? "failed" : "completed",
        stdout: providerExecution.stdout,
        stderr: providerExecution.stderr,
        error: providerExecution.error,
        exitCode: providerExecution.exitCode,
        timedOut: false,
        startedAt,
        endedAt: new Date(endedAtEpoch).toISOString(),
        durationMs: endedAtEpoch - startedAtEpoch,
        resourceUsage: {
          requestedCpuLimitMs: request.cpuLimitMs,
          requestedMemoryLimitMb: request.memoryLimitMb,
          cpuTimeMs: providerExecution.cpuTimeMs,
          memoryBytes: providerExecution.memoryBytes,
        },
        provider: "e2b",
        tenantId: request.tenantId,
      };
    } catch (error) {
      const endedAtEpoch = Date.now();
      const translated = this.translateProviderError(error);

      return {
        status: translated.status,
        stdout: "",
        stderr: translated.message,
        error: translated.message,
        exitCode: null,
        timedOut: translated.status === "timeout",
        startedAt,
        endedAt: new Date(endedAtEpoch).toISOString(),
        durationMs: endedAtEpoch - startedAtEpoch,
        resourceUsage: {
          requestedCpuLimitMs: request.cpuLimitMs,
          requestedMemoryLimitMb: request.memoryLimitMb,
        },
        provider: "e2b",
        tenantId: request.tenantId,
      };
    }
  }

  private translateProviderError(error: unknown): { status: SandboxedExecutionStatus; message: string } {
    if (error instanceof SandboxProviderError) {
      if (error.code === "timeout") {
        return { status: "timeout", message: error.message };
      }

      return { status: "provider_error", message: error.message };
    }

    return {
      status: "provider_error",
      message: error instanceof Error ? error.message : "Unknown provider error",
    };
  }

  private auditAndReturn(
    request: NormalizedExecutionRequest,
    result: SandboxedExecutionResult
  ): SandboxedExecutionResult {
    logger.info("sandbox.execution", {
      tenantId: request.tenantId,
      sessionId: request.sessionId,
      language: request.language,
      status: result.status,
      durationMs: result.durationMs,
      timeoutMs: request.timeoutMs,
      memoryLimitMb: request.memoryLimitMb,
      cpuLimitMs: request.cpuLimitMs,
      hasError: Boolean(result.error),
      metadata: request.metadata,
    });

    return result;
  }
}

export const sandboxedExecutor = new SandboxedExecutor();
