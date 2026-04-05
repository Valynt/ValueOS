/**
 * Backend type barrel.
 *
 * Policy:
 * - This file must ONLY re-export from real implementations that exist.
 * - Do NOT define placeholder types here.
 * - If a symbol doesn't exist yet, fix the source module—not this barrel.
 */

// --- SDUI / Canvas ---
import type { UIComponent } from "./sdui-integration";
export type { UIComponent };
/** Canvas component with required spatial properties for layout operations */
export type CanvasComponent = UIComponent & {
  position: { x: number; y: number; z?: number };
  size: { width: number; height: number };
};

// --- Workflow ---
export type {
  WorkflowStatus,
  StageStatus,
  WorkflowStage,
  WorkflowTransition,
  WorkflowDAG,
} from "./workflow";

// CircuitState is the canonical circuit breaker state type (ADR-0012)
export type { CircuitState as CircuitBreakerState } from "../lib/resilience/CircuitBreaker.js";

// --- Billing ---
export type { BillingCustomer, UsageAggregate } from "./billing";

// --- Memory ---
export type {
  SemanticMemoryType,
  SemanticMemoryRow,
  SemanticMemoryInsert,
  SemanticMemoryMatch,
  ExpansionOpportunityType,
  ExpansionOpportunityRow,
  ExpansionOpportunityInsert,
} from "./memory";

// --- VOS ---
export type { Benchmark } from "./vos";

// --- Evidence / provenance ---
export type { EvidenceTierLabel, EvidenceTierNumeric, SourceProvenance } from "./evidence";
export { EVIDENCE_TIER, evidenceTierToLabel, evidenceTierToNumeric } from "./evidence";

// --- Audit ---
export type { AuditLogEntry } from "./audit";

// --- Agent schema primitives/contracts ---
export {
  EvidenceRefSchema,
  AssumptionSchema,
  StakeholderSchema,
  ConfidenceScoreSchema,
} from "./domain-primitives";

export {
  VALUE_LIFECYCLE_SCHEMA_VERSION_V1,
  OpportunityContextSchema,
  OpportunityContextSchemaV1,
  ValueHypothesisDraftSchema,
  ValueHypothesisDraftSchemaV1,
  FinancialModelSchema,
  FinancialModelSchemaV1,
  IntegrityAssessmentSchema,
  IntegrityAssessmentSchemaV1,
  ExecutiveNarrativeSchema,
  ExecutiveNarrativeSchemaV1,
  ValueLifecycleSchema,
  ValueLifecycleSchemaV1,
  serializeValueLifecycle,
  deserializeValueLifecycle,
} from "./agent-schemas";

export type {
  ValueLifecycleSchemaVersion,
  ValueLifecycleSchemaVersionV1,
  OpportunityContext,
  OpportunityContextV1,
  ValueHypothesisDraft,
  ValueHypothesisDraftV1,
  FinancialModel,
  FinancialModelV1,
  IntegrityAssessment,
  IntegrityAssessmentV1,
  ExecutiveNarrative,
  ExecutiveNarrativeV1,
  ValueLifecycle,
  ValueLifecycleV1,
} from "./agent-schemas";
