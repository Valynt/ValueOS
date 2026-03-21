/**
 * RealizationService
 *
 * Handles post-sale value realization tracking including KPI targets,
 * checkpoints, and baseline management.
 *
 * Reference: openspec/specs/promise-baseline/spec.md
 */

import { z } from "zod";
import { logger } from "../lib/logger.js";
import { supabase } from "../lib/supabase.js";

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

export const KpiTargetSchema = z.object({
  id: z.string().uuid(),
  case_id: z.string().uuid(),
  metric_name: z.string(),
  baseline: z.number(),
  target: z.number(),
  unit: z.string(),
  timeline_start: z.string().datetime(),
  timeline_target: z.string().datetime(),
  source: z.string(),
  progress: z.number().min(0).max(100).default(0),
  current_value: z.number().optional(),
});

export const CheckpointSchema = z.object({
  id: z.string().uuid(),
  case_id: z.string().uuid(),
  organization_id: z.string().uuid(),
  kpi_id: z.string().uuid(),
  date: z.string().datetime(),
  expected_range_min: z.number(),
  expected_range_max: z.number(),
  actual_value: z.number().optional(),
  status: z.enum(["pending", "measured", "missed", "exceeded"]),
  notes: z.string().optional(),
});

export const PromiseBaselineSchema = z.object({
  id: z.string().uuid(),
  case_id: z.string().uuid(),
  organization_id: z.string().uuid(),
  scenario_id: z.string().uuid(),
  scenario_name: z.string(),
  approval_date: z.string().datetime(),
  kpi_targets: z.array(KpiTargetSchema),
  assumptions: z.array(z.unknown()),
  handoff_notes: z.object({
    deal_context: z.string().optional(),
    buyer_priorities: z.string().optional(),
    implementation_assumptions: z.string().optional(),
    key_risks: z.string().optional(),
  }),
});

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type KpiTarget = z.infer<typeof KpiTargetSchema>;
export type Checkpoint = z.infer<typeof CheckpointSchema>;
export type PromiseBaseline = z.infer<typeof PromiseBaselineSchema>;

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class RealizationService {
  /**
   * Create a promise baseline after case approval.
   */
  async createBaseline(
    caseId: string,
    organizationId: string,
    scenarioId: string,
    scenarioName: string,
    kpiTargets: Omit<KpiTarget, "id" | "case_id">[],
    assumptions: unknown[],
    handoffNotes: PromiseBaseline["handoff_notes"],
  ): Promise<string> {
    const { data, error } = await supabase
      .from("promise_baselines")
      .insert({
        case_id: caseId,
        organization_id: organizationId,
        scenario_id: scenarioId,
        scenario_name: scenarioName,
        approval_date: new Date().toISOString(),
        kpi_targets: kpiTargets,
        assumptions,
        handoff_notes: handoffNotes,
      })
      .select("id")
      .single();

    if (error) {
      logger.error("RealizationService.createBaseline failed", {
        case_id: caseId,
        error: error.message,
      });
      throw new Error(`Failed to create baseline: ${error.message}`);
    }

    // Auto-generate checkpoints from KPI targets
    await this.generateCheckpoints(caseId, organizationId, kpiTargets);

    logger.info("Promise baseline created", { id: data.id, case_id: caseId });
    return data.id as string;
  }

  /**
   * Generate checkpoints from KPI targets.
   */
  private async generateCheckpoints(
    caseId: string,
    organizationId: string,
    kpiTargets: Omit<KpiTarget, "id" | "case_id">[],
  ): Promise<void> {
    const checkpoints: Omit<Checkpoint, "id" | "status">[] = [];

    for (const target of kpiTargets) {
      const start = new Date(target.timeline_start);
      const end = new Date(target.timeline_target);
      const months = Math.ceil((end.getTime() - start.getTime()) / (30 * 24 * 60 * 60 * 1000));

      // Create monthly checkpoints
      for (let i = 1; i <= months; i++) {
        const checkpointDate = new Date(start);
        checkpointDate.setMonth(checkpointDate.getMonth() + i);

        const progress = (i / months) * 100;
        const expectedValue = target.baseline + ((target.target - target.baseline) * progress) / 100;
        const variance = (target.target - target.baseline) * 0.1; // 10% variance band

        checkpoints.push({
          case_id: caseId,
          organization_id: organizationId,
          kpi_id: target.id || crypto.randomUUID(),
          date: checkpointDate.toISOString(),
          expected_range_min: expectedValue - variance,
          expected_range_max: expectedValue + variance,
        });
      }
    }

    if (checkpoints.length > 0) {
      const { error } = await supabase.from("checkpoints").insert(
        checkpoints.map((c) => ({
          ...c,
          status: "pending",
        })),
      );

      if (error) {
        logger.error("Failed to generate checkpoints", { case_id: caseId, error: error.message });
      }
    }
  }

  /**
   * Get baseline for a case.
   */
  async getBaseline(caseId: string, organizationId: string): Promise<PromiseBaseline | null> {
    const { data, error } = await supabase
      .from("promise_baselines")
      .select("*")
      .eq("case_id", caseId)
      .eq("organization_id", organizationId)
      .single();

    if (error) {
      if (error.code === "PGRST116") return null; // Not found
      logger.error("RealizationService.getBaseline failed", { case_id: caseId, error: error.message });
      throw new Error(`Failed to fetch baseline: ${error.message}`);
    }

    return data as unknown as PromiseBaseline;
  }

  /**
   * Get checkpoints for a case.
   */
  async getCheckpoints(caseId: string, organizationId: string): Promise<Checkpoint[]> {
    const { data, error } = await supabase
      .from("checkpoints")
      .select("*")
      .eq("case_id", caseId)
      .eq("organization_id", organizationId)
      .order("date", { ascending: true });

    if (error) {
      logger.error("RealizationService.getCheckpoints failed", { case_id: caseId, error: error.message });
      throw new Error(`Failed to fetch checkpoints: ${error.message}`);
    }

    return (data || []) as unknown as Checkpoint[];
  }

  /**
   * Record a checkpoint measurement.
   */
  async recordCheckpoint(
    checkpointId: string,
    organizationId: string,
    actualValue: number,
    notes?: string,
  ): Promise<void> {
    const { data: checkpoint, error: fetchError } = await supabase
      .from("checkpoints")
      .select("*")
      .eq("id", checkpointId)
      .eq("organization_id", organizationId)
      .single();

    if (fetchError || !checkpoint) {
      throw new Error(`Checkpoint not found: ${checkpointId}`);
    }

    // Determine status based on actual vs expected
    let status: Checkpoint["status"] = "pending";
    if (actualValue >= checkpoint.expected_range_min && actualValue <= checkpoint.expected_range_max) {
      status = "measured";
    } else if (actualValue > checkpoint.expected_range_max) {
      status = "exceeded";
    } else {
      status = "missed";
    }

    const { error } = await supabase
      .from("checkpoints")
      .update({
        actual_value: actualValue,
        status,
        notes: notes || null,
        measured_at: new Date().toISOString(),
      })
      .eq("id", checkpointId)
      .eq("organization_id", organizationId);

    if (error) {
      logger.error("RealizationService.recordCheckpoint failed", { checkpoint_id: checkpointId, error: error.message });
      throw new Error(`Failed to record checkpoint: ${error.message}`);
    }

    // Update KPI progress
    await this.updateKpiProgress(checkpoint.kpi_id, organizationId);
  }

  /**
   * Update KPI progress based on latest checkpoint.
   */
  private async updateKpiProgress(kpiId: string, organizationId: string): Promise<void> {
    const { data: checkpoints } = await supabase
      .from("checkpoints")
      .select("*")
      .eq("kpi_id", kpiId)
      .eq("organization_id", organizationId)
      .order("date", { ascending: false })
      .limit(1);

    if (checkpoints && checkpoints.length > 0) {
      const latest = checkpoints[0];
      const progress = latest.status === "measured" || latest.status === "exceeded" ? latest.progress || 0 : 0;

      await supabase
        .from("kpi_targets")
        .update({ progress })
        .eq("id", kpiId)
        .eq("organization_id", organizationId);
    }
  }

  /**
   * Get the latest realization report for a case.
   * Returns KPI variance, milestones, risks, and overall realization rate.
   * Used by the RealizationDashboard component.
   */
  async getLatestReport(
    caseId: string,
    organizationId: string,
  ): Promise<{
    kpis: Array<{
      name: string;
      committed_value: number;
      realized_value: number;
      unit: string;
      variance_percentage: number;
      direction: "over" | "under" | "on_target";
    }>;
    milestones: Array<{ title: string; status: string; due_date: string }>;
    risks: Array<{ description: string; severity: string }>;
    overall_realization_rate: number | null;
    recommendations: string[];
    report_date: string;
  } | null> {
    const { data, error } = await supabase
      .from("realization_reports")
      .select("*")
      .eq("value_case_id", caseId)
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      logger.error("RealizationService.getLatestReport failed", {
        case_id: caseId,
        error: error.message,
      });
      throw new Error(`Failed to fetch realization report: ${error.message}`);
    }

    if (!data) return null;

    const report = data as {
      kpis: Array<{
        kpi_name: string;
        committed_value: number;
        realized_value: number;
        unit: string;
        variance_percentage: number;
        direction: "over" | "under" | "on_target";
      }>;
      milestones: Array<{ title: string; status: string; due_date: string }>;
      risks: Array<{ description: string; severity: string }>;
      variance_analysis: { overall_realization_rate?: number; recommendations?: string[] };
      created_at: string;
    };

    return {
      kpis: (report.kpis ?? []).map((k) => ({
        name: k.kpi_name,
        committed_value: k.committed_value,
        realized_value: k.realized_value,
        unit: k.unit,
        variance_percentage: k.variance_percentage,
        direction: k.direction,
      })),
      milestones: report.milestones ?? [],
      risks: report.risks ?? [],
      overall_realization_rate: report.variance_analysis?.overall_realization_rate ?? null,
      recommendations: report.variance_analysis?.recommendations ?? [],
      report_date: report.created_at,
    };
  }

  /**
   * Get KPI targets for a case.
   */
  async getKpiTargets(caseId: string, organizationId: string): Promise<KpiTarget[]> {
    const { data, error } = await supabase
      .from("kpi_targets")
      .select("*")
      .eq("case_id", caseId)
      .eq("organization_id", organizationId);

    if (error) {
      logger.error("RealizationService.getKpiTargets failed", { case_id: caseId, error: error.message });
      throw new Error(`Failed to fetch KPI targets: ${error.message}`);
    }

    return (data || []) as unknown as KpiTarget[];
  }
}

export default RealizationService;
