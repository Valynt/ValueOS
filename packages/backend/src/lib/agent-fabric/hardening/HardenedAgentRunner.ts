/**
 * HardenedAgentRunner
 *
 * Wraps any BaseAgent._execute() call with the full hardening stack:
 *
 *   ┌─────────────────────────────────────────────────────────────┐
 *   │  Request                                                    │
 *   │    ↓                                                        │
 *   │  [Safety] Prompt injection scan + tool access check        │
 *   │    ↓                                                        │
 *   │  [Resilience] Circuit breaker → timeout → retry backoff    │
 *   │    ↓                                                        │
 *   │  [Agent] _execute() → LLM call via secureInvoke            │
 *   │    ↓                                                        │
 *   │  [Safety] Output schema validation + PII scan              │
 *   │    ↓                                                        │
 *   │  [Governance] IntegrityVeto → confidence threshold → HITL  │
 *   │    ↓                                                        │
 *   │  [Observability] Structured log + OTel span                │
 *   │    ↓                                                        │
 *   │  Response                                                   │
 *   └─────────────────────────────────────────────────────────────┘
 *
 * Usage: instantiate once per agent class, call run() per request.
 * The runner is stateless between calls — all state lives in the
 * ExecutionLogBuilder scoped to each invocation.
 */

import { z } from "zod";
import { logger } from "../../logger.js";
import { CircuitOpenError } from "../../resilience.js";
import { AuditLogger } from "../AuditLogger.js";
import type { LifecycleContext, AgentOutput } from "../../../types/agent.js";
import type {
  ConfidenceBreakdown,
  HardenedInvokeOptions,
  HardenedInvokeResult,
  RequestEnvelope,
  TokenUsage,
} from "./AgentHardeningTypes.js";
import { CONFIDENCE_THRESHOLDS, FAILURE_RESPONSES, GovernanceVetoError } from "./AgentHardeningTypes.js";
import { safetyLayer } from "./AgentSafetyLayer.js";
import {
  GovernanceLayer,
  type GovernanceCheckInput,
  type HITLCheckpointPort,
  type IntegrityVetoServicePort,
} from "./AgentGovernanceLayer.js";
import {
  ExecutionLogBuilder,
  observabilityLayer,
} from "./AgentObservabilityLayer.js";

// ---------------------------------------------------------------------------
// Retry helpers
// ---------------------------------------------------------------------------

interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  jitterRatio: number;
}

const DEFAULT_RETRY: RetryConfig = {
  maxRetries: 3,
  baseDelayMs: 1_000,
  maxDelayMs: 30_000,
  jitterRatio: 0.2,
};

function computeBackoffMs(attempt: number, config: RetryConfig): number {
  const base = config.baseDelayMs * Math.pow(2, attempt);
  const capped = Math.min(base, config.maxDelayMs);
  const jitter = capped * config.jitterRatio * Math.random();
  return Math.floor(capped + jitter);
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Timeout wrapper
// ---------------------------------------------------------------------------

async function withTimeout<T>(
  fn: () => Promise<T>,
  timeoutMs: number,
  label: string
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`[timeout] ${label} exceeded ${timeoutMs}ms`));
    }, timeoutMs);

    fn()
      .then((result) => {
        clearTimeout(timer);
        resolve(result);
      })
      .catch((err: unknown) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

// ---------------------------------------------------------------------------
// HardenedAgentRunner
// ---------------------------------------------------------------------------

export interface HardenedAgentRunnerConfig {
  agentName: string;
  agentVersion: string;
  lifecycleStage: string;
  organizationId: string;
  /** Tools this agent is permitted to invoke. */
  allowedTools: ReadonlySet<string>;
  /** Risk tier for confidence threshold selection. */
  riskTier: keyof typeof CONFIDENCE_THRESHOLDS;
  /** Retry configuration. Defaults to DEFAULT_RETRY. */
  retry?: Partial<RetryConfig>;
  /** Per-call timeout in ms. Default: 30 000. */
  defaultTimeoutMs?: number;
  /** Governance dependencies. Null disables the respective gate. */
  integrityVetoService?: IntegrityVetoServicePort | null;
  hitlPort?: HITLCheckpointPort | null;
}

export type AgentExecuteFn = (context: LifecycleContext) => Promise<AgentOutput>;

export class HardenedAgentRunner {
  private readonly governance: GovernanceLayer;
  private readonly retryConfig: RetryConfig;
  private readonly auditLogger: AuditLogger;
  private readonly defaultTimeoutMs: number;

  constructor(private readonly config: HardenedAgentRunnerConfig) {
    this.governance = new GovernanceLayer(
      config.integrityVetoService ?? null,
      config.hitlPort ?? null
    );
    this.retryConfig = { ...DEFAULT_RETRY, ...config.retry };
    this.auditLogger = new AuditLogger();
    this.defaultTimeoutMs = config.defaultTimeoutMs ?? 30_000;
  }

  /**
   * Run an agent execution through the full hardening stack.
   *
   * @param envelope  - Correlation IDs for this request.
   * @param context   - LifecycleContext passed to the agent.
   * @param executeFn - The agent's _execute() method (or a wrapper).
   * @param options   - Per-call hardening options.
   */
  async run<T>(
    envelope: RequestEnvelope,
    context: LifecycleContext,
    executeFn: AgentExecuteFn,
    options: HardenedInvokeOptions & {
      /** Prompt text for injection scanning. */
      prompt: string;
      /** Tools requested in this invocation (for access check). */
      toolsRequested?: string[];
    }
  ): Promise<HardenedInvokeResult<T>> {
    const timeoutMs = options.timeoutMs ?? this.defaultTimeoutMs;
    const maxRetries = options.maxRetries ?? this.retryConfig.maxRetries;
    const riskTier = options.riskTier ?? this.config.riskTier;

    const logBuilder = new ExecutionLogBuilder({
      request_id: envelope.request_id,
      trace_id: envelope.trace_id,
      session_id: envelope.session_id,
      agent_name: this.config.agentName,
      agent_version: this.config.agentVersion,
      lifecycle_stage: this.config.lifecycleStage,
      organization_id: envelope.organization_id,
      user_id: envelope.user_id,
    });

    logBuilder.setInputSummary({
      workspace_id: context.workspace_id,
      organization_id: context.organization_id,
      lifecycle_stage: context.lifecycle_stage,
      // Deliberately omit raw prompt — it may contain sensitive business data
      prompt_length: options.prompt.length,
    });

    // ── Gate 1: Pre-execution safety scan ───────────────────────────────
    const safetyScan = safetyLayer.check({
      prompt: options.prompt,
      context: context as unknown as Record<string, unknown>,
      toolsRequested: options.toolsRequested,
      agentName: this.config.agentName,
      allowedTools: this.config.allowedTools,
      outputSchema: options.outputSchema,
    });

    logBuilder.setSafety(safetyScan);

    if (safetyScan.verdict === "blocked") {
      await this.auditLogger.logAgentSecurity({
        agentName: this.config.agentName,
        tenantId: envelope.organization_id,
        userId: envelope.user_id,
        action: "prompt_injection_blocked",
        details: {
          request_id: envelope.request_id,
          signals: safetyScan.injection_signals,
          tool_violations: safetyScan.tool_violations,
        },
      });

      const log = logBuilder.complete("failure", {
        code: "SAFETY_BLOCKED",
        message: `Safety layer blocked execution: ${safetyScan.injection_signals.map((s) => s.pattern).join(", ")}`,
        retryable: false,
      });
      observabilityLayer.emit(log);

      throw new Error(
        `[${this.config.agentName}] Execution blocked by safety layer. ` +
          `Signals: ${safetyScan.injection_signals.map((s) => s.pattern).join(", ")}`
      );
    }

    // Use sanitized prompt if the safety layer modified it
    const effectivePrompt = safetyScan.sanitized_prompt;

    // ── Gate 2: Resilience — retry with backoff + timeout ────────────────
    let lastError: unknown;
    let attempts = 0;
    let agentOutput: AgentOutput | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      attempts = attempt + 1;

      if (attempt > 0) {
        const delayMs = computeBackoffMs(attempt - 1, this.retryConfig);
        logger.info("agent.retry", {
          agent: this.config.agentName,
          attempt,
          delay_ms: delayMs,
          request_id: envelope.request_id,
        });
        await sleep(delayMs);
      }

      try {
        agentOutput = await withTimeout(
          () => executeFn({ ...context, _hardenedPrompt: effectivePrompt } as LifecycleContext),
          timeoutMs,
          `${this.config.agentName}.execute`
        );
        break; // Success — exit retry loop
      } catch (err) {
        lastError = err;
        const isTimeout =
          err instanceof Error && err.message.startsWith("[timeout]");
        const isCircuitOpen = err instanceof CircuitOpenError;

        logger.warn("agent.attempt_failed", {
          agent: this.config.agentName,
          attempt,
          is_timeout: isTimeout,
          is_circuit_open: isCircuitOpen,
          error: err instanceof Error ? err.message : String(err),
          request_id: envelope.request_id,
        });

        if (isCircuitOpen) {
          // Circuit open — do not retry
          logBuilder.setCircuitBreakerState("open").setRetryCount(attempts);
          const log = logBuilder.complete("circuit_open", {
            code: "CIRCUIT_OPEN",
            message: err instanceof Error ? err.message : "Circuit breaker open",
            retryable: false,
          });
          observabilityLayer.emit(log);
          throw err;
        }
      }
    }

    logBuilder.setRetryCount(attempts - 1);

    if (!agentOutput) {
      const log = logBuilder.complete(
        lastError instanceof Error && lastError.message.startsWith("[timeout]")
          ? "timeout"
          : "failure",
        {
          code: "EXECUTION_FAILED",
          message:
            lastError instanceof Error
              ? lastError.message
              : "Agent execution failed after retries",
          retryable: true,
        }
      );
      observabilityLayer.emit(log);
      throw lastError ?? new Error(`${this.config.agentName} failed after ${maxRetries} retries`);
    }

    // ── Gate 3: Output schema validation ────────────────────────────────
    const outputScan = safetyLayer.check({
      prompt: effectivePrompt,
      context: {},
      output: agentOutput.result,
      outputSchema: options.outputSchema,
      agentName: this.config.agentName,
      allowedTools: this.config.allowedTools,
    });

    if (!outputScan.schema_valid) {
      logger.warn("agent.output_schema_invalid", {
        agent: this.config.agentName,
        errors: outputScan.schema_errors,
        request_id: envelope.request_id,
      });
    }

    // ── Build confidence breakdown ───────────────────────────────────────
    const hallucinationDetails = (agentOutput as AgentOutput & {
      hallucination_details?: { groundingScore?: number };
    }).hallucination_details;

    const groundingScore = hallucinationDetails?.groundingScore ?? 0.8;
    const confidenceScore = this.confidenceLevelToScore(agentOutput.confidence);

    const confidence: ConfidenceBreakdown = {
      overall: (confidenceScore + groundingScore) / 2,
      evidence_quality: confidenceScore,
      grounding: groundingScore,
      label: agentOutput.confidence,
    };

    logBuilder.setConfidence(confidence);

    // ── Gate 4: Governance ───────────────────────────────────────────────
    const governanceInput: GovernanceCheckInput = {
      output: agentOutput.result,
      confidence,
      riskTier,
      agentName: this.config.agentName,
      agentType: this.config.lifecycleStage,
      traceId: envelope.trace_id,
      sessionId: envelope.session_id,
      organizationId: envelope.organization_id,
      requiresIntegrityVeto: options.requiresIntegrityVeto ?? false,
      requiresHumanApproval: options.requiresHumanApproval ?? false,
    };

    const governanceResult = await this.governance.evaluate(governanceInput);
    logBuilder.setGovernance(governanceResult.decision);

    // ── Finalize token usage ─────────────────────────────────────────────
    const rawTokenUsage = (agentOutput as AgentOutput & {
      token_usage?: { input_tokens: number; output_tokens: number; total_tokens: number };
    }).token_usage;

    const modelName =
      (agentOutput.metadata?.model_version as string | undefined) ?? "default";

    const tokenUsage: TokenUsage = rawTokenUsage
      ? {
          ...rawTokenUsage,
          estimated_cost_usd: 0, // will be set by logBuilder
        }
      : { input_tokens: 0, output_tokens: 0, total_tokens: 0, estimated_cost_usd: 0 };

    logBuilder.setTokenUsage(
      {
        input_tokens: tokenUsage.input_tokens,
        output_tokens: tokenUsage.output_tokens,
        total_tokens: tokenUsage.total_tokens,
      },
      modelName
    );

    logBuilder.setOutputSummary({
      status: agentOutput.status,
      confidence: agentOutput.confidence,
      governance_verdict: governanceResult.decision.verdict,
      result_keys: Object.keys(agentOutput.result ?? {}),
    });

    // ── Emit observability record ────────────────────────────────────────
    const finalStatus =
      governanceResult.decision.verdict === "approved"
        ? "success"
        : governanceResult.decision.verdict === "vetoed"
          ? "vetoed"
          : "pending_review";

    const log = logBuilder.complete(finalStatus);
    observabilityLayer.emit(log);

    // ── Return or throw based on governance verdict ──────────────────────
    if (!governanceResult.release) {
      const scenario =
        governanceResult.decision.verdict === "vetoed"
          ? "integrity_veto"
          : "human_approval_required";

      const failureInfo = FAILURE_RESPONSES[scenario];
      logger.warn("agent.governance_blocked", {
        agent: this.config.agentName,
        verdict: governanceResult.decision.verdict,
        reason: governanceResult.decision.reason,
        scenario,
        system_action: failureInfo.system_action,
        request_id: envelope.request_id,
      });

      throw new GovernanceVetoError(
        this.config.agentName,
        governanceResult.decision.verdict,
        governanceResult.decision.reason ?? "Governance layer blocked output.",
        governanceResult.decision.approval_checkpoint_id
      );
    }

    return {
      output: agentOutput.result as T,
      confidence: governanceResult.adjusted_confidence,
      cache_hit: false,
      attempts,
      trace_id: (agentOutput as AgentOutput & { _trace_id?: string })._trace_id ?? envelope.trace_id,
      token_usage: log.token_usage,
      governance: governanceResult.decision,
      safety: outputScan,
    };
  }

  private confidenceLevelToScore(level: AgentOutput["confidence"]): number {
    const map: Record<string, number> = {
      very_high: 0.95,
      high: 0.80,
      medium: 0.60,
      low: 0.40,
      very_low: 0.20,
    };
    return map[level] ?? 0.50;
  }
}

// GovernanceVetoError is defined in AgentHardeningTypes.ts and re-exported
// from index.ts. Import it from there rather than from this module.
export { GovernanceVetoError } from "./AgentHardeningTypes.js";
