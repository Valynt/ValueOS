/**
 * Agent fabric cost and token metrics.
 *
 * Exposes two counters that the alert rules in
 * infra/k8s/monitoring/agent-fabric-alerts.yaml reference:
 *
 *   agent_fabric_cost_usd_total        — cumulative USD spend per agent/tenant
 *   agent_fabric_token_usage_total     — cumulative token count per agent/tenant
 *
 * Both are registered on the shared prom-client registry so they appear
 * on the /metrics endpoint alongside all other application metrics.
 *
 * Call recordAgentCost() once per secureInvoke() completion inside BaseAgent.
 *
 * Token pricing model
 * -------------------
 * Rates are rough estimates (USD per 1K tokens) matching the values already
 * used in LLMGateway.estimateCostUsd(). When the LLM provider returns actual
 * cost data, pass it directly via the costUsd parameter instead.
 */

import { createCounter } from "../lib/observability/index.js";

// ─── Metrics ──────────────────────────────────────────────────────────────────

/** Cumulative USD cost of agent LLM invocations. */
const agentCostCounter = createCounter(
  "agent_fabric_cost_usd_total",
  "Cumulative USD cost of agent LLM invocations",
);

/** Cumulative token usage across all agent LLM invocations. */
const agentTokenCounter = createCounter(
  "agent_fabric_token_usage_total",
  "Cumulative token count for agent LLM invocations",
);

// ─── Per-model pricing table (USD per 1K tokens) ──────────────────────────────

const PRICING: Record<string, { prompt: number; completion: number }> = {
  "gpt-4":          { prompt: 0.03,    completion: 0.06   },
  "gpt-4o":         { prompt: 0.005,   completion: 0.015  },
  "gpt-4o-mini":    { prompt: 0.00015, completion: 0.0006 },
  "gpt-3.5-turbo":  { prompt: 0.0005,  completion: 0.0015 },
  // Together.ai Llama models (approximate)
  "meta-llama/Llama-3-70b-chat-hf":  { prompt: 0.0009, completion: 0.0009 },
  "meta-llama/Llama-3-8b-chat-hf":   { prompt: 0.0002, completion: 0.0002 },
};

const DEFAULT_RATE = { prompt: 0.01, completion: 0.03 };

export function estimateCostUsd(
  inputTokens: number,
  outputTokens: number,
  model: string,
): number {
  const rate = PRICING[model] ?? DEFAULT_RATE;
  return (inputTokens / 1000) * rate.prompt + (outputTokens / 1000) * rate.completion;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export interface AgentCostRecord {
  agentName: string;
  organizationId: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  /** Pre-computed cost in USD. When omitted, estimated from token counts + model. */
  costUsd?: number;
}

/**
 * Record cost and token usage for a single agent invocation.
 * Safe to call with zero tokens (no-op increment).
 */
export function recordAgentCost(record: AgentCostRecord): void {
  const { agentName, organizationId, model, inputTokens, outputTokens } = record;
  const totalTokens = inputTokens + outputTokens;

  if (totalTokens === 0) return;

  const costUsd = record.costUsd ?? estimateCostUsd(inputTokens, outputTokens, model);

  const labels = {
    agent: agentName,
    organization_id: organizationId,
    model,
  };

  agentCostCounter.add(costUsd, labels);
  agentTokenCounter.add(totalTokens, labels);
}
