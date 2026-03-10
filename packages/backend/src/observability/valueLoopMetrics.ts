/**
 * Value loop observability — structured metrics and traces for the core product path.
 *
 * Covers the five stages of the value loop:
 *   signal → hypothesis → business_case → realization → expansion
 *
 * Instruments:
 *   - Stage transition latency (histogram)
 *   - Agent invocation count and outcome (counter)
 *   - Hypothesis confidence distribution (histogram)
 *   - Financial calculation accuracy (counter: validated vs unvalidated)
 *   - End-to-end loop duration (histogram)
 */

import { createLogger } from "@shared/lib/logger";
import {
  createCounter,
  createHistogram,
} from "../lib/observability/index.js";

const logger = createLogger({ component: "ValueLoopMetrics" });

// ─── Metrics ──────────────────────────────────────────────────────────────────

/** Latency of each stage transition in the value loop (seconds). */
const stageTransitionLatency = createHistogram(
  "value_loop_stage_transition_seconds",
  "Latency of value loop stage transitions",
);

/** Count of agent invocations, labelled by agent name and outcome. */
const agentInvocations = createCounter(
  "value_loop_agent_invocations_total",
  "Total agent invocations in the value loop",
);

/** Distribution of hypothesis confidence scores (0–1). */
const hypothesisConfidence = createHistogram(
  "value_loop_hypothesis_confidence",
  "Distribution of hypothesis confidence scores",
);

/** Financial calculations: validated (backed by deterministic math) vs unvalidated. */
const financialCalculations = createCounter(
  "value_loop_financial_calculations_total",
  "Financial calculations in the value loop, by validation status",
);

/** End-to-end duration of a complete value loop (seconds). */
const loopDuration = createHistogram(
  "value_loop_e2e_duration_seconds",
  "End-to-end duration of a complete value loop execution",
);

/** Tenant API usage events, labelled by metric type. */
const usageEvents = createCounter(
  "value_loop_usage_events_total",
  "Tenant API usage events recorded by the usage enforcement middleware",
);

// ─── Public API ───────────────────────────────────────────────────────────────

export type ValueLoopStage =
  | "signal"
  | "hypothesis"
  | "business_case"
  | "realization"
  | "expansion";

export type AgentOutcome = "success" | "hallucination_detected" | "error" | "timeout";

/**
 * Record a stage transition with its latency.
 */
export function recordStageTransition(opts: {
  fromStage: ValueLoopStage;
  toStage: ValueLoopStage;
  organizationId: string;
  durationMs: number;
}): void {
  const { fromStage, toStage, organizationId, durationMs } = opts;
  stageTransitionLatency.record(durationMs / 1000, {
    from_stage: fromStage,
    to_stage: toStage,
  });
  logger.info("Value loop stage transition", {
    fromStage,
    toStage,
    organizationId,
    durationMs,
  });
}

/**
 * Record an agent invocation and its outcome.
 */
export function recordAgentInvocation(opts: {
  agentName: string;
  stage: ValueLoopStage;
  outcome: AgentOutcome;
  organizationId: string;
  durationMs: number;
}): void {
  const { agentName, stage, outcome, organizationId, durationMs } = opts;
  agentInvocations.add(1, {
    agent: agentName,
    stage,
    outcome,
  });
  if (outcome !== "success") {
    logger.warn("Agent invocation non-success", {
      agentName,
      stage,
      outcome,
      organizationId,
      durationMs,
    });
  }
}

/**
 * Record a hypothesis confidence score.
 */
export function recordHypothesisConfidence(opts: {
  agentName: string;
  confidence: number;
  organizationId: string;
}): void {
  const { agentName, confidence, organizationId } = opts;
  hypothesisConfidence.record(confidence, { agent: agentName });
  if (confidence < 0.5) {
    logger.warn("Low-confidence hypothesis", { agentName, confidence, organizationId });
  }
}

/**
 * Record a financial calculation, noting whether it was deterministically validated.
 */
export function recordFinancialCalculation(opts: {
  calculationType: string;
  validated: boolean;
  organizationId: string;
}): void {
  const { calculationType, validated, organizationId } = opts;
  financialCalculations.add(1, {
    type: calculationType,
    validated: validated ? "true" : "false",
  });
  if (!validated) {
    logger.warn("Unvalidated financial calculation in value loop", {
      calculationType,
      organizationId,
    });
  }
}

/**
 * Record a tenant usage event from the usage enforcement middleware.
 * Mirrors MetricsCollector.recordUsage() but on the value-loop registry
 * so it appears in the value-loop Grafana dashboard.
 */
export function recordUsageEvent(opts: {
  tenantId: string;
  metric: string;
  quantity?: number;
}): void {
  const { tenantId, metric, quantity = 1 } = opts;
  usageEvents.add(quantity, { metric, tenant: tenantId });
}

/**
 * Record the end-to-end duration of a complete value loop execution.
 */
export function recordLoopCompletion(opts: {
  organizationId: string;
  sessionId: string;
  durationMs: number;
  completedStages: ValueLoopStage[];
}): void {
  const { organizationId, sessionId, durationMs, completedStages } = opts;
  loopDuration.record(durationMs / 1000, {
    stages: completedStages.join(","),
  });
  logger.info("Value loop completed", {
    organizationId,
    sessionId,
    durationMs,
    completedStages,
  });
}
