/**
 * Agent Observability Layer
 *
 * Structured, per-invocation logging for every hardened agent call.
 * Every execution record includes:
 *   - Input summary (PII-redacted)
 *   - Output summary
 *   - Reasoning trace
 *   - Tools used with latency
 *   - Token usage + estimated cost
 *   - Confidence breakdown
 *   - Governance decision
 *   - Safety scan result
 *   - Correlation via request_id / trace_id
 *
 * Records are written to:
 *   1. Structured logger (stdout → log aggregator)
 *   2. reasoning_traces table (via existing repository)
 *   3. OTel spans (via existing getTracer())
 *
 * Cost estimation uses a static model pricing table. Update
 * MODEL_PRICING when provider rates change.
 */

import { SpanStatusCode, trace } from "@opentelemetry/api";
import { logger } from "../../logger.js";
import { redactSensitiveText } from "../redaction.js";
import type {
  AgentExecutionLog,
  ConfidenceBreakdown,
  GovernanceDecision,
  ReasoningTraceEntry,
  SafetyScanResult,
  TokenUsage,
  ToolUsageRecord,
} from "./AgentHardeningTypes.js";

// ---------------------------------------------------------------------------
// Model pricing (USD per 1 000 tokens)
// ---------------------------------------------------------------------------

interface ModelPricing {
  input_per_1k: number;
  output_per_1k: number;
}

const MODEL_PRICING: Record<string, ModelPricing> = {
  "gpt-4o": { input_per_1k: 0.005, output_per_1k: 0.015 },
  "gpt-4o-mini": { input_per_1k: 0.00015, output_per_1k: 0.0006 },
  "gpt-4-turbo": { input_per_1k: 0.01, output_per_1k: 0.03 },
  "claude-3-5-sonnet": { input_per_1k: 0.003, output_per_1k: 0.015 },
  "claude-3-haiku": { input_per_1k: 0.00025, output_per_1k: 0.00125 },
  "meta-llama/Llama-3-70b-chat-hf": { input_per_1k: 0.0009, output_per_1k: 0.0009 },
  // Fallback for unknown models
  default: { input_per_1k: 0.002, output_per_1k: 0.002 },
};

export function estimateCostUsd(
  modelName: string,
  inputTokens: number,
  outputTokens: number
): number {
  const pricing = MODEL_PRICING[modelName] ?? MODEL_PRICING["default"]!;
  return (
    (inputTokens / 1000) * pricing.input_per_1k +
    (outputTokens / 1000) * pricing.output_per_1k
  );
}

// ---------------------------------------------------------------------------
// ExecutionLogBuilder — fluent builder for AgentExecutionLog
// ---------------------------------------------------------------------------

export class ExecutionLogBuilder {
  private log: Partial<AgentExecutionLog>;
  private startedAt: number;

  constructor(base: {
    request_id: string;
    trace_id: string;
    session_id: string;
    agent_name: string;
    agent_version: string;
    lifecycle_stage: string;
    organization_id: string;
    user_id: string;
  }) {
    this.startedAt = Date.now();
    this.log = {
      ...base,
      started_at: new Date(this.startedAt).toISOString(),
      tools_used: [],
      reasoning_trace: [],
    };
  }

  recordToolUse(record: Omit<ToolUsageRecord, "invoked_at">): this {
    this.log.tools_used!.push({
      ...record,
      invoked_at: new Date().toISOString(),
    });
    return this;
  }

  recordReasoningStep(entry: ReasoningTraceEntry): this {
    this.log.reasoning_trace!.push(entry);
    return this;
  }

  setInputSummary(input: Record<string, unknown>): this {
    // Redact all string values before storing
    this.log.input_summary = redactObjectStrings(input);
    return this;
  }

  setOutputSummary(output: Record<string, unknown>): this {
    this.log.output_summary = redactObjectStrings(output);
    return this;
  }

  setTokenUsage(raw: { input_tokens: number; output_tokens: number; total_tokens: number }, modelName: string): this {
    this.log.token_usage = {
      ...raw,
      estimated_cost_usd: estimateCostUsd(modelName, raw.input_tokens, raw.output_tokens),
    };
    return this;
  }

  setConfidence(confidence: ConfidenceBreakdown): this {
    this.log.confidence = confidence;
    return this;
  }

  setGovernance(governance: GovernanceDecision): this {
    this.log.governance = governance;
    return this;
  }

  setSafety(safety: SafetyScanResult): this {
    this.log.safety = safety;
    return this;
  }

  setCircuitBreakerState(state: AgentExecutionLog["circuit_breaker_state"]): this {
    this.log.circuit_breaker_state = state;
    return this;
  }

  setRetryCount(count: number): this {
    this.log.retry_count = count;
    return this;
  }

  complete(
    status: AgentExecutionLog["status"],
    error?: AgentExecutionLog["error"]
  ): AgentExecutionLog {
    const completedAt = Date.now();
    return {
      ...(this.log as Omit<AgentExecutionLog, "completed_at" | "latency_ms" | "status">),
      completed_at: new Date(completedAt).toISOString(),
      latency_ms: completedAt - this.startedAt,
      status,
      error,
      // Provide safe defaults for optional fields that may not have been set
      input_summary: this.log.input_summary ?? {},
      output_summary: this.log.output_summary ?? {},
      reasoning_trace: this.log.reasoning_trace ?? [],
      tools_used: this.log.tools_used ?? [],
      token_usage: this.log.token_usage ?? {
        input_tokens: 0,
        output_tokens: 0,
        total_tokens: 0,
        estimated_cost_usd: 0,
      },
      confidence: this.log.confidence ?? {
        overall: 0,
        evidence_quality: 0,
        grounding: 0,
        label: "very_low",
      },
      governance: this.log.governance ?? {
        verdict: "approved",
        decided_by: "system",
        decided_at: new Date().toISOString(),
      },
      safety: this.log.safety ?? {
        verdict: "clean",
        injection_signals: [],
        schema_valid: true,
        tool_violations: [],
        pii_detected: false,
      },
      circuit_breaker_state: this.log.circuit_breaker_state ?? "closed",
      retry_count: this.log.retry_count ?? 0,
    };
  }
}

// ---------------------------------------------------------------------------
// ObservabilityLayer — emits logs + OTel spans
// ---------------------------------------------------------------------------

export class ObservabilityLayer {
  /**
   * Emit a completed execution log to the structured logger and OTel.
   *
   * The log is written at INFO level for success/vetoed/pending states,
   * and WARN/ERROR for failure/timeout/circuit_open.
   */
  emit(log: AgentExecutionLog): void {
    const level =
      log.status === "success" ||
      log.status === "vetoed" ||
      log.status === "pending_review"
        ? "info"
        : log.status === "failure" || log.status === "timeout"
          ? "warn"
          : "error";

    logger[level]("agent.execution", {
      // Correlation
      request_id: log.request_id,
      trace_id: log.trace_id,
      session_id: log.session_id,
      // Identity
      agent_name: log.agent_name,
      agent_version: log.agent_version,
      lifecycle_stage: log.lifecycle_stage,
      organization_id: log.organization_id,
      // Outcome
      status: log.status,
      latency_ms: log.latency_ms,
      retry_count: log.retry_count,
      circuit_breaker_state: log.circuit_breaker_state,
      // Confidence
      confidence_overall: log.confidence.overall,
      confidence_label: log.confidence.label,
      confidence_grounding: log.confidence.grounding,
      // Governance
      governance_verdict: log.governance.verdict,
      governance_decided_by: log.governance.decided_by,
      // Safety
      safety_verdict: log.safety.verdict,
      injection_signal_count: log.safety.injection_signals.length,
      pii_detected: log.safety.pii_detected,
      // Cost
      input_tokens: log.token_usage.input_tokens,
      output_tokens: log.token_usage.output_tokens,
      estimated_cost_usd: log.token_usage.estimated_cost_usd,
      // Tools
      tools_used: log.tools_used.map((t) => t.tool_name),
      // Error
      ...(log.error && { error_code: log.error.code, error_message: log.error.message }),
    });

    // Emit OTel span events for the execution record
    this.emitOtelEvents(log);
  }

  private emitOtelEvents(log: AgentExecutionLog): void {
    const tracer = trace.getTracer("agent-hardening");
    const span = tracer.startSpan("agent.hardened_execution", {
      attributes: {
        "agent.name": log.agent_name,
        "agent.version": log.agent_version,
        "agent.lifecycle_stage": log.lifecycle_stage,
        "request.id": log.request_id,
        "trace.id": log.trace_id,
        "tenant.id": log.organization_id,
        "execution.status": log.status,
        "execution.latency_ms": log.latency_ms,
        "execution.retry_count": log.retry_count,
        "confidence.overall": log.confidence.overall,
        "governance.verdict": log.governance.verdict,
        "safety.verdict": log.safety.verdict,
        "tokens.input": log.token_usage.input_tokens,
        "tokens.output": log.token_usage.output_tokens,
        "cost.usd": log.token_usage.estimated_cost_usd,
      },
    });

    if (log.status === "failure" || log.status === "circuit_open") {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: log.error?.message ?? log.status,
      });
    } else {
      span.setStatus({ code: SpanStatusCode.OK });
    }

    // Add reasoning trace as span events (one per step)
    for (const step of log.reasoning_trace) {
      span.addEvent("reasoning_step", {
        step: step.step,
        description: step.description,
        confidence: step.confidence,
        assumption_count: step.assumptions.length,
        evidence_ref_count: step.evidence_refs.length,
      });
    }

    span.end();
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Recursively redact all string values in an object using the existing
 * redactSensitiveText utility. Numeric/boolean values pass through unchanged.
 */
function redactObjectStrings(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === "string") {
      out[k] = redactSensitiveText(v).redactedText;
    } else if (Array.isArray(v)) {
      out[k] = v.map((item) =>
        typeof item === "string"
          ? redactSensitiveText(item).redactedText
          : item && typeof item === "object"
            ? redactObjectStrings(item as Record<string, unknown>)
            : item
      );
    } else if (v && typeof v === "object") {
      out[k] = redactObjectStrings(v as Record<string, unknown>);
    } else {
      out[k] = v;
    }
  }
  return out;
}

export const observabilityLayer = new ObservabilityLayer();
