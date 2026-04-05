import type { RetryOptions } from '../../services/agents/resilience/AgentRetryManager.js';
import type { WorkflowStageContextDTO } from '../../types/workflow/runner.js';
import type { WorkflowStage } from '../../types/workflow.js';

export interface StageRetryConfig {
  max_attempts: number;
  initial_delay_ms: number;
  max_delay_ms: number;
  multiplier: number;
  jitter: boolean;
}

export function buildStageRetryConfig(stage: WorkflowStage, maxRetryAttempts: number): StageRetryConfig {
  return {
    max_attempts: stage.retry_config?.max_attempts ?? maxRetryAttempts,
    initial_delay_ms: stage.retry_config?.initial_delay_ms ?? 1000,
    max_delay_ms: stage.retry_config?.max_delay_ms ?? 10000,
    multiplier: stage.retry_config?.multiplier ?? 2,
    jitter: stage.retry_config?.jitter ?? true,
  };
}

export function buildRetryOptions(
  stage: WorkflowStage,
  context: WorkflowStageContextDTO,
  traceId: string,
  executionId: string,
  stageRetryConfig: StageRetryConfig,
): Partial<RetryOptions> {
  const timeoutMs = (stage.timeout_seconds ?? 30) * 1000;

  return {
    maxRetries: Math.max(stageRetryConfig.max_attempts - 1, 0),
    strategy: 'exponential_backoff',
    baseDelay: stageRetryConfig.initial_delay_ms,
    maxDelay: stageRetryConfig.max_delay_ms,
    backoffMultiplier: stageRetryConfig.multiplier,
    jitterFactor: stageRetryConfig.jitter ? 0.1 : 0,
    fallbackAgents: [],
    fallbackStrategy: 'none',
    attemptTimeout: timeoutMs,
    overallTimeout: timeoutMs * stageRetryConfig.max_attempts,
    context: {
      requestId: traceId,
      sessionId: context.sessionId,
      userId: context.userId,
      organizationId: context.organizationId,
      priority: 'medium',
      source: 'execution-runtime',
      metadata: { executionId, stageId: stage.id },
    },
  };
}
