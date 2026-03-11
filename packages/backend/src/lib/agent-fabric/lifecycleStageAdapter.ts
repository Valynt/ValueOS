/**
 * Lifecycle Stage Adapter
 *
 * Maps internal agent routing labels (used in AgentFactory and agent class
 * declarations) to canonical LifecycleStage values defined in
 * packages/shared/src/domain/Opportunity.ts.
 *
 * Why this exists: agent routing uses short labels like "opportunity",
 * "modeling", "target" that predate the canonical domain vocabulary
 * (discovery, drafting, validating, …). Rather than rename every agent
 * class and all callers in one pass, this adapter bridges the gap so the
 * type system enforces canonical stages at boundaries while internal
 * routing labels remain stable.
 *
 * ADR-0010: Canonical LifecycleStage vocabulary.
 */

import type { LifecycleStage } from "@valueos/shared";

/**
 * Maps internal agent routing labels to canonical lifecycle stages.
 * Used by AgentFactory when constructing AgentConfig.lifecycle_stage.
 */
export const AGENT_LABEL_TO_LIFECYCLE_STAGE: Record<string, LifecycleStage> = {
  opportunity: "discovery",
  "financial-modeling": "drafting",
  modeling: "drafting",
  target: "drafting",
  integrity: "validating",
  narrative: "composing",
  realization: "refining",
  expansion: "expansion",
  "compliance-auditor": "validating",
};

/**
 * Maps canonical lifecycle stages back to the primary agent routing label.
 * Used when a stage name needs to resolve to an agent type.
 */
export const LIFECYCLE_STAGE_TO_AGENT_LABEL: Record<LifecycleStage, string> = {
  discovery: "opportunity",
  drafting: "target",
  validating: "integrity",
  composing: "narrative",
  refining: "realization",
  realized: "realization",
  expansion: "expansion",
};

/**
 * Convert an internal agent routing label to a canonical LifecycleStage.
 * Falls back to "discovery" if the label is not recognised.
 */
export function agentLabelToLifecycleStage(label: string): LifecycleStage {
  return AGENT_LABEL_TO_LIFECYCLE_STAGE[label] ?? "discovery";
}

/**
 * Convert a canonical LifecycleStage to the primary agent routing label.
 */
export function lifecycleStageToAgentLabel(stage: LifecycleStage): string {
  return LIFECYCLE_STAGE_TO_AGENT_LABEL[stage];
}
