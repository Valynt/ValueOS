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

/** Workflow execution deadline violations. */
const workflowDeadlineViolations = createCounter(
  "workflow_deadline_violations_total",
  "Workflow executions that exceeded their deadline",
);

/** Active workflow executions tracked by deadline. */
const workflowExecutionsActive = createCounter(
  "workflow_executions_active_total",
  "Currently active workflow executions",
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
    organization_id: organizationId,
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
    organization_id: organizationId,
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
  hypothesisConfidence.record(confidence, {
    organization_id: organizationId,
    agent: agentName,
  });
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
    organization_id: organizationId,
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
  usageEvents.add(quantity, { metric, organization_id: tenantId });
}

/**
 * Record a workflow execution deadline violation.
 */
export function recordWorkflowDeadlineViolation(opts: {
  executionId: string;
  organizationId: string;
  deadlineMinutes: number;
  actualDurationMs: number;
}): void {
  const { executionId, organizationId, deadlineMinutes, actualDurationMs } = opts;
  workflowDeadlineViolations.add(1, {
    organization_id: organizationId,
    execution_id: executionId,
    deadline_minutes: String(deadlineMinutes),
  });
  logger.warn("Workflow deadline violated", {
    executionId,
    organizationId,
    deadlineMinutes,
    actualDurationMs,
    overrunFactor: (actualDurationMs / (deadlineMinutes * 60 * 1000)).toFixed(2),
  });
}

/**
 * Track active workflow execution count.
 */
export function recordWorkflowExecutionActive(opts: {
  organizationId: string;
  delta: number;
}): void {
  const { organizationId, delta } = opts;
  workflowExecutionsActive.add(delta, { organization_id: organizationId });
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
    organization_id: organizationId,
    stages: completedStages.join(","),
  });
  logger.info("Value loop completed", {
    organizationId,
    sessionId,
    durationMs,
    completedStages,
  });
}
