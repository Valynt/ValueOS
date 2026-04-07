/**
 * Canonical domain model — ValueOS
 *
 * Nine first-class domain objects that represent the complete value lifecycle.
 * All agent reasoning, financial calculations, and artifact generation must
 * operate on these types — not ad-hoc shapes.
 *
 * Sprint 3: Initial definition. Sprint 5 target: all agent routing decisions
 * driven by the structured state of these objects (DecisionContext).
 *
 * Import from this barrel:
 *   import { AccountSchema, type Account } from '@valueos/shared/domain';
 *   import { ValueHypothesisSchema } from '@valueos/shared';
 */

export * from "./Account.js";
export * from "./Opportunity.js";
export * from "./Stakeholder.js";
export * from "./ValueHypothesis.js";
export * from "./Assumption.js";
export * from "./Evidence.js";
export * from "./BusinessCase.js";
export * from "./RealizationPlan.js";
export * from "./ExpansionOpportunity.js";
export * from "./DecisionContext.js";
export * from "./DealContext.js";
export * from "./UseCase.js";

// Canonical lifecycle stage type — re-exported for convenience.
// The authoritative definition is OpportunityLifecycleStageSchema in Opportunity.ts.
export type { OpportunityLifecycleStage as LifecycleStage } from "./Opportunity.js";

// Value Graph — Sprint 47
// Four new entities forming the canonical ontology layer.
// Agents read/write these; ValueGraphService traverses them.
export * from "./VgCapability.js";
export * from "./VgMetric.js";
export * from "./VgValueDriver.js";
export * from "./ValueGraphEdge.js";
export * from "./GraphIntegrityGap.js";

// Value Integrity Layer — Sprint 53
export * from "./Violation.js";

// Reasoning Trace — Sprint 51
// Persisted record of agent reasoning for every secureInvoke call.
export * from "./ReasoningTrace.js";

// Experience Model — Sprint 55
// Bridging layer: maps backend agent state → user-perceivable experience.
export * from "./ExperienceModel.js";

// Warmth — perceptual state layer for the frontend redesign
// Translates saga lifecycle → forming / firm / verified
export * from "./Warmth.js";

// Runtime orchestration failure taxonomy
export * from "./RuntimeFailureTaxonomy.js";
