import type { ZodType } from "zod";

import type { ConfidenceLevel } from "../../../types/agent";
import type { AgentType } from "../../agent-types.js";

export interface AgentExecutionContext<
  TContext = unknown,
  TParameters = unknown,
> {
  /** Session ID for tracking and context */
  sessionId?: string;
  /** User ID making the request */
  userId?: string;
  /** Organization ID for tenant isolation */
  organizationId?: string;
  /**
   * Runtime context payload for the execution.
   * Must be parsed/validated against `contextSchema` before use.
   */
  context?: unknown;
  contextSchema?: ZodType<TContext>;
  /**
   * Runtime parameter payload for the execution.
   * Must be parsed/validated against `parametersSchema` before use.
   */
  parameters?: unknown;
  parametersSchema?: ZodType<TParameters>;
}

export interface AgentPolicy {
  timeoutMs?: number;
  maxRetries?: number;
  allowCachedResult?: boolean;
  traceReasoning?: boolean;
}

export interface AgentResultMeta {
  executionId: string;
  agentType: AgentType;
  startTime: Date;
  endTime: Date;
  duration: number;
  tokenUsage: {
    input: number;
    output: number;
    total: number;
    cost: number;
  };
  cacheHit: boolean;
  retryCount: number;
  circuitBreakerTripped: boolean;
}

export interface AgentResult<TOutput = unknown> {
  success: boolean;
  output?: TOutput;
  confidence: ConfidenceLevel;
  metadata: AgentResultMeta;
  error?: {
    code: string;
    message: string;
    details?: unknown;
    stack?: string;
    retryable: boolean;
  };
}

export interface AgentContract<TInput = unknown, TOutput = unknown> {
  readonly inputSchema: ZodType<TInput>;
  readonly outputSchema: ZodType<TOutput>;
  execute(
    input: unknown,
    context?: AgentExecutionContext,
    policy?: AgentPolicy,
  ): Promise<AgentResult<TOutput>>;
}
