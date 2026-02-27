/**
 * Agent Name Normalizer
 *
 * Resolves the naming mismatch between:
 * - Backend agent class names: "OpportunityAgent", "TargetAgent", etc.
 * - Frontend AgentType union: "opportunity", "target", etc.
 * - AgentOutput.agent_type (snake_case field) vs GenericAgentOutput.agentType (camelCase)
 *
 * All agent identification should flow through these helpers so the
 * codebase uses a single canonical form.
 */

import type { AgentType } from "../services/agent-types";

/**
 * Map from PascalCase class name to canonical AgentType.
 */
const CLASS_TO_TYPE: Record<string, AgentType> = {
  OpportunityAgent: "opportunity",
  TargetAgent: "target",
  RealizationAgent: "realization",
  ExpansionAgent: "expansion",
  IntegrityAgent: "integrity",
  CoordinatorAgent: "coordinator",
  NarrativeAgent: "narrative",
  ResearchAgent: "research",
  BenchmarkAgent: "benchmark",
  GroundTruthAgent: "groundtruth",
};

const TYPE_TO_CLASS: Record<string, string> = Object.fromEntries(
  Object.entries(CLASS_TO_TYPE).map(([cls, type]) => [type, cls]),
);

/**
 * Normalize any agent identifier to the canonical lowercase AgentType.
 *
 * Handles: "OpportunityAgent", "opportunity", "OPPORTUNITY", "Opportunity"
 */
export function toAgentType(raw: string): AgentType {
  if (CLASS_TO_TYPE[raw]) return CLASS_TO_TYPE[raw];

  const lower = raw.toLowerCase().replace(/agent$/, "").replace(/-/g, "");
  for (const [, type] of Object.entries(CLASS_TO_TYPE)) {
    if (type === lower) return type;
  }

  // Fallback: return as-is (cast) — caller should validate
  return lower as AgentType;
}

/**
 * Convert canonical AgentType to PascalCase class name.
 */
export function toAgentClassName(type: AgentType): string {
  return TYPE_TO_CLASS[type] ?? `${type.charAt(0).toUpperCase()}${type.slice(1)}Agent`;
}

/**
 * Normalize an agent output object so both `agent_type` and `agentType`
 * are present and consistent. This bridges the snake_case ↔ camelCase gap.
 */
export function normalizeAgentOutput<T extends Record<string, unknown>>(
  output: T,
): T & { agentType: string; agent_type: string } {
  const agentType =
    (output.agentType as string) ??
    (output.agent_type as string) ??
    "unknown";

  const canonical = toAgentType(agentType);

  return {
    ...output,
    agentType: canonical,
    agent_type: canonical,
  };
}
