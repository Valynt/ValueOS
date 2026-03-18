/**
 * Promise Baseline Service
 *
 * Creates and manages promise baselines from approved value case scenarios.
 * Baselines are immutable snapshots used for post-sale handoff to Customer Success.
 */

import { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { createLogger } from "../../lib/logger.js";
import { supabase as supabaseClient } from "../../lib/supabase.js";
import { ScenarioType, SourceType } from "../../types/value-modeling.js";

const logger = createLogger({ component: "PromiseBaselineService" });

// ============================================================================
// Zod Schemas
// ============================================================================

export const PromiseBaselineSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  case_id: z.string().uuid(),
  scenario_id: z.string().uuid().optional(),
  scenario_type: z.enum(["conservative", "base", "upside"]),
  status: z.enum(["active", "amended", "archived"]),
  created_by_user_id: z.string().uuid(),
  approved_at: z.string().datetime().optional(),
  handoff_notes: z.string().optional(),
  created_at: z.string().datetime(),
  superseded_at: z.string().datetime().optional(),
  superseded_by_id: z.string().uuid().optional(),
});

export const PromiseKPITargetSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  baseline_id: z.string().uuid(),
  metric_name: z.string(),
  baseline_value: z.number(),
  target_value: z.number(),
  unit: z.string(),
  timeline_months: z.number(),
  source_classification: z.string(),
  confidence_score: z.number().min(0).max(1).optional(),
  benchmark_reference_id: z.string().uuid().optional(),
  value_driver_id: z.string().uuid().optional(),
  created_at: z.string().datetime(),
});

export const PromiseCheckpointSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  baseline_id: z.string().uuid(),
  kpi_target_id: z.string().uuid(),
  measurement_date: z.string().datetime(),
  expected_value_min: z.number().optional(),
  expected_value_max: z.number().optional(),
  actual_value: z.number().optional(),
  data_source_for_actuals: z.string().optional(),
  status: z.enum(["pending", "measured", "missed", "exceeded"]),
  measured_at: z.string().datetime().optional(),
  measured_by_user_id: z.string().uuid().optional(),
  notes: z.string().optional(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export const PromiseHandoffNoteSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  baseline_id: z.string().uuid(),
  section: z.enum(["deal_context", "buyer_priorities", "implementation_assumptions", "key_risks"]),
  content_text: z.string(),
  generated_by_agent: z.boolean(),
  created_at: z.string().datetime(),
});

export type PromiseBaseline = z.infer<typeof PromiseBaselineSchema>;
export type PromiseKPITarget = z.infer<typeof PromiseKPITargetSchema>;
export type PromiseCheckpoint = z.infer<typeof PromiseCheckpointSchema>;
export type PromiseHandoffNote = z.infer<typeof PromiseHandoffNoteSchema>;

export interface PromiseBaselineDetail extends PromiseBaseline {
  kpi_targets: PromiseKPITarget[];
  checkpoints: PromiseCheckpoint[];
  notes: PromiseHandoffNote[];
}

export interface CreateBaselineRequest {
  case_id: string;
  scenario_id: string;
  scenario_type: ScenarioType;
  user_id: string;
}

// ============================================================================
// Service
// ============================================================================

export class PromiseBaselineService {
  private supabase: SupabaseClient;

  constructor() {
    if (!supabaseClient) {
      throw new Error("PromiseBaselineService requires Supabase to be configured");
    }
    this.supabase = supabaseClient;
  }

  /**
   * Create a new promise baseline from an approved case scenario.
   * This is immutable - amendments create a new baseline version.
   */
  async createFromApprovedCase(
    tenantId: string,
    request: CreateBaselineRequest
  ): Promise<PromiseBaseline> {
    logger.info("Creating promise baseline from approved case", {
      tenantId,
      caseId: request.case_id,
      scenarioId: request.scenario_id,
    });

    // Validate tenant access to case
    const { data: valueCase, error: caseError } = await this.supabase
      .from("value_cases")
      .select("id, organization_id, stage")
      .eq("id", request.case_id)
      .eq("organization_id", tenantId)
      .single();

    if (caseError || !valueCase) {
      throw new Error(`Case not found or access denied: ${request.case_id}`);
    }

    // Validate scenario exists and belongs to case
    const { data: scenario, error: scenarioError } = await this.supabase
      .from("scenarios")
      .select("id, case_id, scenario_type, assumptions_snapshot_json")
      .eq("id", request.scenario_id)
      .eq("case_id", request.case_id)
      .single();

    if (scenarioError || !scenario) {
      throw new Error(`Scenario not found or does not belong to case: ${request.scenario_id}`);
    }

    // Create baseline record
    const { data: baseline, error: baselineError } = await this.supabase
      .from("promise_baselines")
      .insert({
        tenant_id: tenantId,
        case_id: request.case_id,
        scenario_id: request.scenario_id,
        scenario_type: request.scenario_type,
        status: "active",
        created_by_user_id: request.user_id,
        approved_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (baselineError || !baseline) {
      logger.error("Failed to create promise baseline", { error: baselineError });
      throw new Error(`Failed to create promise baseline: ${baselineError?.message}`);
    }

    logger.info("Promise baseline created successfully", {
      baselineId: baseline.id,
      tenantId,
      caseId: request.case_id,
    });

    return PromiseBaselineSchema.parse(baseline);
  }

  /**
   * Get a baseline by ID with all related data (KPIs, checkpoints, notes).
   * Validates tenant isolation.
   */
  async getBaseline(baselineId: string, tenantId: string): Promise<PromiseBaselineDetail | null> {
    // Fetch baseline with tenant check
    const { data: baseline, error: baselineError } = await this.supabase
      .from("promise_baselines")
      .select("*")
      .eq("id", baselineId)
      .eq("tenant_id", tenantId)
      .single();

    if (baselineError || !baseline) {
      return null;
    }

    // Fetch related KPI targets
    const { data: kpiTargets, error: kpiError } = await this.supabase
      .from("promise_kpi_targets")
      .select("*")
      .eq("baseline_id", baselineId)
      .eq("tenant_id", tenantId);

    if (kpiError) {
      logger.warn("Failed to fetch KPI targets", { baselineId, error: kpiError });
    }

    // Fetch checkpoints
    const { data: checkpoints, error: checkpointError } = await this.supabase
      .from("promise_checkpoints")
      .select("*")
      .eq("baseline_id", baselineId)
      .eq("tenant_id", tenantId);

    if (checkpointError) {
      logger.warn("Failed to fetch checkpoints", { baselineId, error: checkpointError });
    }

    // Fetch handoff notes
    const { data: handoffNotes, error: notesError } = await this.supabase
      .from("promise_handoff_notes")
      .select("*")
      .eq("baseline_id", baselineId)
      .eq("tenant_id", tenantId);

    if (notesError) {
      logger.warn("Failed to fetch handoff notes", { baselineId, error: notesError });
    }

    return {
      ...PromiseBaselineSchema.parse(baseline),
      kpi_targets: (kpiTargets || []).map(k => PromiseKPITargetSchema.parse(k)),
      checkpoints: (checkpoints || []).map(c => PromiseCheckpointSchema.parse(c)),
      notes: (handoffNotes || []).map(n => PromiseHandoffNoteSchema.parse(n)),
    };
  }

  /**
   * Get the active baseline for a case.
   */
  async getActiveBaselineForCase(caseId: string, tenantId: string): Promise<PromiseBaseline | null> {
    const { data, error } = await this.supabase
      .from("promise_baselines")
      .select("*")
      .eq("case_id", caseId)
      .eq("tenant_id", tenantId)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (error || !data) {
      return null;
    }

    return PromiseBaselineSchema.parse(data);
  }

  /**
   * List all baselines for a case.
   */
  async listBaselinesForCase(caseId: string, tenantId: string): Promise<PromiseBaseline[]> {
    const { data, error } = await this.supabase
      .from("promise_baselines")
      .select("*")
      .eq("case_id", caseId)
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false });

    if (error || !data) {
      return [];
    }

    return data.map(b => PromiseBaselineSchema.parse(b));
  }

  /**
   * Amend an existing baseline by creating a new version.
   * Marks the old baseline as amended and links to new version.
   */
  async amendBaseline(
    baselineId: string,
    tenantId: string,
    newScenarioId: string,
    userId: string
  ): Promise<PromiseBaseline> {
    logger.info("Amending baseline", { baselineId, tenantId, newScenarioId });

    // Get existing baseline
    const existing = await this.getBaseline(baselineId, tenantId);
    if (!existing) {
      throw new Error(`Baseline not found: ${baselineId}`);
    }

    // Create new baseline from the same case
    const newBaseline = await this.createFromApprovedCase(tenantId, {
      case_id: existing.case_id,
      scenario_id: newScenarioId,
      scenario_type: existing.scenario_type,
      user_id: userId,
    });

    // Mark old baseline as superseded
    const { error: updateError } = await this.supabase
      .from("promise_baselines")
      .update({
        status: "amended",
        superseded_at: new Date().toISOString(),
        superseded_by_id: newBaseline.id,
      })
      .eq("id", baselineId)
      .eq("tenant_id", tenantId);

    if (updateError) {
      logger.error("Failed to mark old baseline as amended", { baselineId, error: updateError });
    }

    return newBaseline;
  }

  /**
   * Archive a baseline (soft delete for record-keeping).
   */
  async archiveBaseline(baselineId: string, tenantId: string): Promise<void> {
    const { error } = await this.supabase
      .from("promise_baselines")
      .update({ status: "archived" })
      .eq("id", baselineId)
      .eq("tenant_id", tenantId);

    if (error) {
      throw new Error(`Failed to archive baseline: ${error.message}`);
    }

    logger.info("Baseline archived", { baselineId, tenantId });
  }

  /**
   * Delete a baseline and all associated records.
   * Use with caution - primarily for compensation/rollback.
   */
  async deleteBaseline(baselineId: string, tenantId: string): Promise<void> {
    logger.info("Deleting baseline", { baselineId, tenantId });

    // Delete checkpoints first (FK to KPI targets)
    await this.supabase
      .from("promise_checkpoints")
      .delete()
      .eq("baseline_id", baselineId)
      .eq("tenant_id", tenantId);

    // Delete handoff notes
    await this.supabase
      .from("promise_handoff_notes")
      .delete()
      .eq("baseline_id", baselineId)
      .eq("tenant_id", tenantId);

    // Delete KPI targets
    await this.supabase
      .from("promise_kpi_targets")
      .delete()
      .eq("baseline_id", baselineId)
      .eq("tenant_id", tenantId);

    // Delete baseline
    const { error } = await this.supabase
      .from("promise_baselines")
      .delete()
      .eq("id", baselineId)
      .eq("tenant_id", tenantId);

    if (error) {
      throw new Error(`Failed to delete baseline: ${error.message}`);
    }

    logger.info("Baseline and associated records deleted", { baselineId, tenantId });
  }
}

export const promiseBaselineService = new PromiseBaselineService();
export default promiseBaselineService;
