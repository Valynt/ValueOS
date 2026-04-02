/**
 * Stage Handoff Contracts
 *
 * Typed Zod schemas for the data passed between each lifecycle stage boundary.
 * These replace the implicit semantic-memory retrieval pattern with explicit,
 * validated contracts that each agent reads as its primary input source.
 *
 * Spec reference: ValueOS Consolidated Spec §8 — Minimal Handoff Contracts
 *
 * Usage:
 *   import { IntakeToDiscoveryHandoff } from '@valueos/shared';
 *   const handoff = IntakeToDiscoveryHandoff.parse(rawData);
 */

import { z } from "zod";

// ── Shared primitives ─────────────────────────────────────────────────────────

const UuidSchema = z.string().uuid();

const PainPointSchema = z.object({
  id: UuidSchema,
  title: z.string().min(1).max(255),
  description: z.string().max(2000).default(""),
  status: z.enum(["inferred", "confirmed", "rejected"]).default("inferred"),
  priority: z.enum(["low", "medium", "high", "critical"]).default("medium"),
  source: z.string().max(255).optional(),
});

const StakeholderSchema = z.object({
  id: UuidSchema,
  name: z.string().min(1).max(255),
  role: z.string().max(255),
  priority: z.enum(["low", "medium", "high"]).default("medium"),
});

const MetricSchema = z.object({
  id: UuidSchema,
  name: z.string().min(1).max(255),
  unit: z.string().max(100),
  baseline_value: z.number().optional(),
  target_value: z.number().optional(),
  source: z.string().max(255).optional(),
});

const AssumptionSchema = z.object({
  id: UuidSchema,
  name: z.string().min(1).max(255),
  value: z.number(),
  unit: z.string().max(100),
  rationale: z.string().max(1000).optional(),
  owner: z.string().max(255).optional(),
  confidence: z.number().min(0).max(1).optional(),
});

const ValueDriverSchema = z.object({
  id: UuidSchema,
  evf_category: z.enum(["revenue_uplift", "cost_savings", "risk_reduction"]),
  name: z.string().min(1).max(255),
  mechanism: z.string().max(1000),
  metric_ids: z.array(UuidSchema).default([]),
  assumption_ids: z.array(UuidSchema).default([]),
});

const ValueHypothesisSchema = z.object({
  id: UuidSchema,
  pain_point_id: UuidSchema,
  driver_id: UuidSchema,
  statement: z.string().min(1).max(2000),
  status: z.enum(["draft", "approved", "blocked", "downgraded"]).default("draft"),
});

const EvidenceSchema = z.object({
  id: UuidSchema,
  source_type: z.enum(["transcript", "crm_note", "benchmark", "case_study", "manual"]),
  source_id: z.string().max(255).optional(),
  excerpt: z.string().max(2000),
  linked_object_type: z.enum(["value_hypothesis", "assumption", "metric", "value_driver"]),
  linked_object_id: UuidSchema,
  trust_level: z.enum(["low", "medium", "high"]),
  relevance_score: z.number().min(0).max(1).optional(),
});

const FinancialModelSchema = z.object({
  id: UuidSchema,
  annual_value: z.number(),
  implementation_cost: z.number().optional(),
  annual_subscription_cost: z.number().optional(),
  roi_percent: z.number().optional(),
  payback_months: z.number().optional(),
  version: z.number().int().positive(),
  status: z.enum(["draft", "approved", "locked"]).default("draft"),
});

const NarrativeArtifactSchema = z.object({
  id: UuidSchema,
  type: z.enum(["cfo_summary", "executive_summary", "persona_narrative", "full_case"]),
  content: z.string().min(1),
  source_model_version: z.number().int().positive(),
  status: z.enum(["draft", "approved", "locked"]).default("draft"),
});

const RealizationRecordSchema = z.object({
  id: UuidSchema,
  expected_annual_value: z.number(),
  realized_annual_value: z.number().optional(),
  realization_score: z.number().min(0).max(1).optional(),
  variance_summary: z.string().max(2000).optional(),
});

// ── 1. Intake → Discovery ─────────────────────────────────────────────────────

export const IntakeToDiscoveryHandoffSchema = z.object({
  opportunity_id: UuidSchema,
  source_bundle_id: UuidSchema.optional(),
  account_snapshot: z.record(z.unknown()).default({}),
  initial_signals: z.array(z.string()).default([]),
});

export type IntakeToDiscoveryHandoff = z.infer<typeof IntakeToDiscoveryHandoffSchema>;

// ── 2. Discovery → Modeling ───────────────────────────────────────────────────

export const DiscoveryToModelingHandoffSchema = z.object({
  opportunity_id: UuidSchema,
  pain_points: z.array(PainPointSchema).min(1, "At least one pain point required"),
  stakeholders: z.array(StakeholderSchema).min(1, "At least one stakeholder required"),
  metrics: z.array(MetricSchema).min(1, "At least one metric required"),
  discovery_gaps: z.array(z.string()).default([]),
});

export type DiscoveryToModelingHandoff = z.infer<typeof DiscoveryToModelingHandoffSchema>;

// ── 3. Modeling → Evidence ────────────────────────────────────────────────────

export const ModelingToEvidenceHandoffSchema = z.object({
  opportunity_id: UuidSchema,
  value_drivers: z.array(ValueDriverSchema).min(1, "At least one value driver required"),
  value_hypotheses: z.array(ValueHypothesisSchema).min(1, "At least one hypothesis required"),
  assumptions: z.array(AssumptionSchema),
  financial_model: FinancialModelSchema,
});

export type ModelingToEvidenceHandoff = z.infer<typeof ModelingToEvidenceHandoffSchema>;

// ── 4. Evidence → Integrity ───────────────────────────────────────────────────

export const EvidenceToIntegrityHandoffSchema = z.object({
  opportunity_id: UuidSchema,
  evidence: z.array(EvidenceSchema),
  value_hypotheses: z.array(ValueHypothesisSchema),
  financial_model: FinancialModelSchema,
});

export type EvidenceToIntegrityHandoff = z.infer<typeof EvidenceToIntegrityHandoffSchema>;

// ── 5. Integrity → Composition ────────────────────────────────────────────────

export const IntegrityToCompositionHandoffSchema = z.object({
  opportunity_id: UuidSchema,
  integrity_status: z.enum(["pass", "conditional_pass", "fail"]),
  approved_claims: z.array(UuidSchema).default([]),
  downgraded_claims: z.array(UuidSchema).default([]),
  blocked_claims: z.array(UuidSchema).default([]),
  warnings: z.array(z.string()).default([]),
  remediation_actions: z.array(z.string()).default([]),
});

export type IntegrityToCompositionHandoff = z.infer<typeof IntegrityToCompositionHandoffSchema>;

// ── 6. Composition → Approval ─────────────────────────────────────────────────

export const CompositionToApprovalHandoffSchema = z.object({
  opportunity_id: UuidSchema,
  financial_model: FinancialModelSchema,
  narrative_artifacts: z.array(NarrativeArtifactSchema).min(1, "At least one narrative artifact required"),
  integrity_report: z.object({
    id: UuidSchema,
    status: z.enum(["pass", "conditional_pass", "fail"]),
    blocked_claims: z.array(UuidSchema).default([]),
    warnings: z.array(z.string()).default([]),
  }),
});

export type CompositionToApprovalHandoff = z.infer<typeof CompositionToApprovalHandoffSchema>;

// ── 7. Approval → Realization ─────────────────────────────────────────────────

export const ApprovalToRealizationHandoffSchema = z.object({
  value_case_id: UuidSchema,
  locked_model_version: z.number().int().positive(),
  approved_scenario: z.enum(["conservative", "expected", "optimistic"]),
  approved_at: z.string().datetime().optional(),
  approved_by: UuidSchema.optional(),
});

export type ApprovalToRealizationHandoff = z.infer<typeof ApprovalToRealizationHandoffSchema>;

// ── 8. Realization → Expansion ────────────────────────────────────────────────

export const RealizationToExpansionHandoffSchema = z.object({
  value_case_id: UuidSchema,
  realization_records: z.array(RealizationRecordSchema).min(1, "At least one realization record required"),
  adoption_signals: z.array(z.string()).default([]),
  variance_summary: z.string().max(2000).optional(),
});

export type RealizationToExpansionHandoff = z.infer<typeof RealizationToExpansionHandoffSchema>;

// ── Discriminated union for runtime routing ───────────────────────────────────

/**
 * All handoff payloads as a discriminated union keyed by stage boundary.
 * Useful for generic orchestration code that handles any handoff type.
 */
export const StageHandoffSchema = z.discriminatedUnion("boundary", [
  IntakeToDiscoveryHandoffSchema.extend({ boundary: z.literal("intake_to_discovery") }),
  DiscoveryToModelingHandoffSchema.extend({ boundary: z.literal("discovery_to_modeling") }),
  ModelingToEvidenceHandoffSchema.extend({ boundary: z.literal("modeling_to_evidence") }),
  EvidenceToIntegrityHandoffSchema.extend({ boundary: z.literal("evidence_to_integrity") }),
  IntegrityToCompositionHandoffSchema.extend({ boundary: z.literal("integrity_to_composition") }),
  CompositionToApprovalHandoffSchema.extend({ boundary: z.literal("composition_to_approval") }),
  ApprovalToRealizationHandoffSchema.extend({ boundary: z.literal("approval_to_realization") }),
  RealizationToExpansionHandoffSchema.extend({ boundary: z.literal("realization_to_expansion") }),
]);

export type StageHandoff = z.infer<typeof StageHandoffSchema>;

export type StageBoundary =
  | "intake_to_discovery"
  | "discovery_to_modeling"
  | "modeling_to_evidence"
  | "evidence_to_integrity"
  | "integrity_to_composition"
  | "composition_to_approval"
  | "approval_to_realization"
  | "realization_to_expansion";
