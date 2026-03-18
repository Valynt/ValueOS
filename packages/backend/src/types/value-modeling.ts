/**
 * Value Modeling Types
 *
 * Types for assumptions, scenarios, and financial modeling domain.
 */

import { z } from "zod";

// ============================================================================
// Enums
// ============================================================================

export const SourceTypeSchema = z.enum([
  "customer-confirmed",
  "crm-derived",
  "call-derived",
  "note-derived",
  "benchmark-derived",
  "externally-researched",
  "inferred",
  "manually-overridden",
]);

export type SourceType = z.infer<typeof SourceTypeSchema>;

export const ScenarioTypeSchema = z.enum(["conservative", "base", "upside"]);

export type ScenarioType = z.infer<typeof ScenarioTypeSchema>;

// ============================================================================
// Assumption
// ============================================================================

export const AssumptionSchema = z.object({
  id: z.string().uuid(),
  organization_id: z.string().uuid(),
  case_id: z.string().uuid(),
  name: z.string(),
  value: z.number(),
  unit: z.string().optional(),
  source_type: SourceTypeSchema,
  confidence_score: z.number().min(0).max(1),
  benchmark_reference_id: z.string().uuid().optional(),
  original_value: z.number().optional(),
  overridden_by_user_id: z.string().uuid().optional(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export type Assumption = z.infer<typeof AssumptionSchema>;

export type AssumptionInsert = Omit<Assumption, "id" | "created_at" | "updated_at">;
export type AssumptionUpdate = Partial<Omit<AssumptionInsert, "organization_id" | "case_id">>;

// ============================================================================
// Scenario
// ============================================================================

export interface EVFDecomposition {
  revenue_uplift: number;
  cost_reduction: number;
  risk_mitigation: number;
  efficiency_gain: number;
}

export const ScenarioSchema = z.object({
  id: z.string().uuid(),
  organization_id: z.string().uuid(),
  case_id: z.string().uuid(),
  scenario_type: ScenarioTypeSchema,
  assumptions_snapshot_json: z.record(z.unknown()),
  roi: z.number().optional(),
  npv: z.number().optional(),
  payback_months: z.number().optional(),
  evf_decomposition_json: z.custom<EVFDecomposition>(),
  created_at: z.string().datetime(),
});

export type Scenario = z.infer<typeof ScenarioSchema>;

export type ScenarioInsert = Omit<Scenario, "id" | "created_at">;

// ============================================================================
// API Types
// ============================================================================

export interface CreateAssumptionRequest {
  name: string;
  value: number;
  unit?: string;
  source_type: SourceType;
  confidence_score: number;
  benchmark_reference_id?: string;
}

export interface UpdateAssumptionRequest {
  value?: number;
  source_type?: SourceType;
  confidence_score?: number;
  reason?: string; // For audit trail when overriding
}

export interface ScenarioResult {
  scenario_type: ScenarioType;
  roi: number;
  npv: number;
  payback_months: number;
  evf_decomposition: EVFDecomposition;
}

export interface SensitivityAnalysis {
  assumption_id: string;
  assumption_name: string;
  current_value: number;
  impact_plus_20: number;
  impact_minus_20: number;
  leverage_score: number; // Higher = more sensitive
}
