/**
 * PromiseBaselineService
 *
 * Creates immutable baselines from approved scenarios for handoff to CS.
 * Manages KPI targets, checkpoints, and handoff notes.
 *
 * Reference: openspec/changes/promise-baseline-handoff/tasks.md §2
 */

import { z } from "zod";
import { logger } from "../lib/logger.js";
import { supabase } from "../lib/supabase.js";

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

export const PromiseBaselineSchema = z.object({
  id: z.string().uuid(),
  organization_id: z.string().uuid(),
  case_id: z.string().uuid(),
  scenario_id: z.string().uuid(),
  scenario_type: z.enum(["conservative", "base", "upside"]),
  status: z.enum(["active", "amended", "archived"]),
  created_by_user_id: z.string().uuid(),
  approved_at: z.string().datetime(),
  handoff_notes: z.string().optional(),
  created_at: z.string().datetime(),
  superseded_at: z.string().datetime().optional(),
  superseded_by_id: z.string().uuid().optional(),
});

export const KpiTargetSchema = z.object({
  id: z.string().uuid(),
  baseline_id: z.string().uuid(),
  metric_name: z.string(),
  baseline_value: z.number(),
  target_value: z.number(),
  unit: z.string(),
  timeline_months: z.number().int(),
  source_classification: z.string(),
  confidence_score: z.number().min(0).max(1),
  value_driver_id: z.string().uuid().optional(),
});

export type PromiseBaseline = z.infer<typeof PromiseBaselineSchema>;
export type KpiTarget = z.infer<typeof KpiTargetSchema>;

export interface CreateBaselineInput {
  organizationId: string;
  caseId: string;
  scenarioId: string;
  userId: string;
  approvedScenarioType: "conservative" | "base" | "upside";
}

export interface CreateBaselineResult {
  baselineId: string;
  kpiTargets: KpiTarget[];
  checkpoints: Array<{
    id: string;
    kpiTargetId: string;
    measurementDate: string;
  }>;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class PromiseBaselineService {
  /**
   * Create a promise baseline from an approved scenario.
   */
  async createFromApprovedCase(input: CreateBaselineInput): Promise<CreateBaselineResult> {
    logger.info(`Creating baseline for case ${input.caseId} from scenario ${input.scenarioId}`);

    // Verify scenario exists
    const { data: scenario, error: scenarioError } = await supabase
      .from("scenarios")
      .select("*")
      .eq("id", input.scenarioId)
      .eq("organization_id", input.organizationId)
      .single();

    if (scenarioError || !scenario) {
      throw new Error(`Scenario not found: ${input.scenarioId}`);
    }

    // Create baseline record
    const baselineId = crypto.randomUUID();
    const now = new Date().toISOString();

    const { error: baselineError } = await supabase.from("promise_baselines").insert({
      id: baselineId,
      organization_id: input.organizationId,
      case_id: input.caseId,
      scenario_id: input.scenarioId,
      scenario_type: input.approvedScenarioType,
      status: "active",
      created_by_user_id: input.userId,
      approved_at: now,
      created_at: now,
    });

    if (baselineError) {
      throw new Error(`Failed to create baseline: ${baselineError.message}`);
    }

    // Fetch assumptions to create KPI targets
    const { data: assumptions, error: assumptionsError } = await supabase
      .from("assumptions")
      .select("id, name, value, unit, source_type, confidence_score")
      .eq("case_id", input.caseId)
      .eq("organization_id", input.organizationId);

    if (assumptionsError) {
      throw new Error(`Failed to fetch assumptions for baseline: ${assumptionsError.message}`);
    }

    // Create KPI targets from assumptions
    const kpiTargets: KpiTarget[] = [];
    for (const assumption of assumptions || []) {
      const targetValue = this.calculateTargetValue(
        assumption.value,
        scenario.evf_decomposition_json,
        input.approvedScenarioType,
      );

      const kpiTarget: KpiTarget = {
        id: crypto.randomUUID(),
        baseline_id: baselineId,
        metric_name: assumption.name,
        baseline_value: assumption.value,
        target_value: targetValue,
        unit: assumption.unit,
        timeline_months: 12, // Default 12-month timeline
        source_classification: assumption.source_type,
        confidence_score: assumption.confidence_score,
      };

      kpiTargets.push(kpiTarget);
    }

    // Persist KPI targets
    await this.persistKpiTargets(kpiTargets, input.organizationId);

    // Schedule checkpoints
    const checkpoints = await this.scheduleCheckpoints(baselineId, kpiTargets, input.organizationId);

    // Generate handoff notes
    await this.generateHandoffNotes(baselineId, input.organizationId, input.caseId);

    logger.info(`Baseline ${baselineId} created with ${kpiTargets.length} KPI targets and ${checkpoints.length} checkpoints`);

    return { baselineId, kpiTargets, checkpoints };
  }

  /**
   * Get baseline with all related data.
   */
  async getBaseline(baselineId: string, organizationId: string): Promise<{
    baseline: PromiseBaseline;
    kpiTargets: KpiTarget[];
    checkpoints: Array<{
      id: string;
      kpi_target_id: string;
      measurement_date: string;
      expected_value_min: number;
      expected_value_max: number;
      status: string;
    }>;
    handoffNotes: Array<{
      section: string;
      content: string;
    }>;
  }> {
    // Fetch baseline
    const { data: baseline, error: baselineError } = await supabase
      .from("promise_baselines")
      .select("*")
      .eq("id", baselineId)
      .eq("organization_id", organizationId)
      .single();

    if (baselineError || !baseline) {
      throw new Error(`Baseline not found: ${baselineId}`);
    }

    // Fetch KPI targets
    const { data: kpiTargets } = await supabase
      .from("promise_kpi_targets")
      .select("*")
      .eq("baseline_id", baselineId)
      .eq("organization_id", organizationId);

    // Fetch checkpoints
    const { data: checkpoints } = await supabase
      .from("promise_checkpoints")
      .select("*")
      .eq("baseline_id", baselineId)
      .eq("organization_id", organizationId)
      .order("measurement_date");

    // Fetch handoff notes
    const { data: handoffNotes } = await supabase
      .from("promise_handoff_notes")
      .select("*")
      .eq("baseline_id", baselineId)
      .eq("organization_id", organizationId);

    return {
      baseline: PromiseBaselineSchema.parse(baseline),
      kpiTargets: (kpiTargets || []).map((k) => KpiTargetSchema.parse(k)),
      checkpoints: (checkpoints || []).map((c) => ({
        id: c.id,
        kpi_target_id: c.kpi_target_id,
        measurement_date: c.measurement_date,
        expected_value_min: c.expected_value_min,
        expected_value_max: c.expected_value_max,
        status: c.status,
      })),
      handoffNotes: (handoffNotes || []).map((n) => ({
        section: n.section,
        content: n.content_text,
      })),
    };
  }

  /**
   * Amend a baseline (creates new version, archives old).
   */
  async amendBaseline(
    baselineId: string,
    organizationId: string,
    userId: string,
    amendments: {
      kpiAdjustments?: Array<{ kpiTargetId: string; newTarget: number; reason: string }>;
    },
  ): Promise<string> {
    logger.info(`Amending baseline ${baselineId}`);

    // Fetch original baseline
    const { data: original } = await supabase
      .from("promise_baselines")
      .select("*")
      .eq("id", baselineId)
      .eq("organization_id", organizationId)
      .single();

    if (!original) {
      throw new Error(`Baseline not found: ${baselineId}`);
    }

    // Create new baseline version
    const newBaselineId = crypto.randomUUID();
    const now = new Date().toISOString();

    const { error: newBaselineError } = await supabase.from("promise_baselines").insert({
      id: newBaselineId,
      organization_id: organizationId,
      case_id: original.case_id,
      scenario_id: original.scenario_id,
      scenario_type: original.scenario_type,
      status: "active",
      created_by_user_id: userId,
      approved_at: now,
      handoff_notes: `Amended from baseline ${baselineId}. ${JSON.stringify(amendments)}`,
      created_at: now,
    });

    if (newBaselineError) {
      throw new Error(`Failed to create amended baseline: ${newBaselineError.message}`);
    }

    // Archive original
    const { error: archiveError } = await supabase
      .from("promise_baselines")
      .update({
        status: "amended",
        superseded_at: now,
        superseded_by_id: newBaselineId,
      })
      .eq("id", baselineId)
      .eq("organization_id", organizationId);

    if (archiveError) {
      throw new Error(`Failed to archive original baseline: ${archiveError.message}`);
    }

    // Copy and adjust KPI targets — bulk insert instead of per-row loop
    const { data: originalKpis, error: kpisError } = await supabase
      .from("promise_kpi_targets")
      .select("*")
      .eq("baseline_id", baselineId)
      .eq("organization_id", organizationId);

    if (kpisError) {
      throw new Error(`Failed to fetch KPI targets for amendment: ${kpisError.message}`);
    }

    if (originalKpis && originalKpis.length > 0) {
      const kpiRows = originalKpis.map((kpi) => {
        const adjustment = amendments.kpiAdjustments?.find(
          (a) => a.kpiTargetId === kpi.id,
        );
        return {
          id: crypto.randomUUID(),
          organization_id: organizationId,
          baseline_id: newBaselineId,
          metric_name: kpi.metric_name,
          baseline_value: kpi.baseline_value,
          target_value: adjustment?.newTarget ?? kpi.target_value,
          unit: kpi.unit,
          timeline_months: kpi.timeline_months,
          source_classification: kpi.source_classification,
          confidence_score: kpi.confidence_score,
        };
      });

      const { error: kpiInsertError } = await supabase
        .from("promise_kpi_targets")
        .insert(kpiRows);

      if (kpiInsertError) {
        // Compensating rollback: the original baseline was already marked
        // "amended" and the new baseline record was already written. Revert
        // both so the system is not left with a superseded-but-unreplaced
        // baseline. Best-effort — log if compensation itself fails.
        logger.error(`KPI insert failed for amendment of ${baselineId}, attempting rollback`, {
          error: kpiInsertError.message,
          newBaselineId,
        });
        const [revertResult, deleteResult] = await Promise.allSettled([
          supabase
            .from("promise_baselines")
            .update({ status: "active", superseded_at: null, superseded_by_id: null })
            .eq("id", baselineId)
            .eq("organization_id", organizationId),
          supabase
            .from("promise_baselines")
            .delete()
            .eq("id", newBaselineId)
            .eq("organization_id", organizationId),
        ]);
        if (revertResult.status === "rejected") {
          logger.error("Rollback revert of original baseline failed — manual intervention required", {
            reason: revertResult.reason,
            baselineId,
            organizationId,
          });
        }
        if (deleteResult.status === "rejected") {
          logger.error("Rollback delete of orphaned baseline failed — manual intervention required", {
            reason: deleteResult.reason,
            newBaselineId,
            organizationId,
          });
        }
        throw new Error(`Failed to insert amended KPI targets: ${kpiInsertError.message}`);
      }
    }

    return newBaselineId;
  }

  /**
   * Calculate target value based on EVF decomposition.
   *
   * EVF values are absolute USD amounts, not percentages. The target is
   * computed by scaling the baseline by the scenario multiplier, which
   * represents the expected improvement factor for that scenario type.
   * Conservative = 70% of base improvement, upside = 130%.
   */
  private calculateTargetValue(
    baselineValue: number,
    evfDecomposition: { revenue_uplift: number; cost_reduction: number; risk_mitigation: number; efficiency_gain: number },
    scenarioType: string,
  ): number {
    const scenarioMultiplier = scenarioType === "conservative" ? 0.7 :
                               scenarioType === "upside" ? 1.3 : 1.0;

    // Total EVF improvement in USD. If no EVF data is available, fall back
    // to the scenario multiplier applied directly to the baseline.
    const totalEvfUsd = evfDecomposition.revenue_uplift +
                        evfDecomposition.cost_reduction +
                        evfDecomposition.risk_mitigation +
                        evfDecomposition.efficiency_gain;

    if (totalEvfUsd <= 0 || baselineValue <= 0) {
      return baselineValue * scenarioMultiplier;
    }

    // Express the EVF improvement as a ratio relative to the baseline value,
    // then apply the scenario multiplier to that ratio.
    const improvementRatio = (totalEvfUsd / baselineValue) * scenarioMultiplier;

    // Cap at a 10× improvement to guard against extreme outliers.
    const cappedRatio = Math.min(improvementRatio, 10);

    return baselineValue * (1 + cappedRatio);
  }

  /**
   * Persist KPI targets.
   */
  private async persistKpiTargets(targets: KpiTarget[], organizationId: string): Promise<void> {
    if (targets.length === 0) return;

    const { error } = await supabase.from("promise_kpi_targets").insert(
      targets.map((t) => ({
        id: t.id,
        organization_id: organizationId,
        baseline_id: t.baseline_id,
        metric_name: t.metric_name,
        baseline_value: t.baseline_value,
        target_value: t.target_value,
        unit: t.unit,
        timeline_months: t.timeline_months,
        source_classification: t.source_classification,
        confidence_score: t.confidence_score,
      })),
    );

    if (error) {
      logger.error(`Failed to persist KPI targets: ${error.message}`);
      throw new Error(`Failed to persist KPI targets: ${error.message}`);
    }
  }

  /**
   * Schedule checkpoints for KPI targets.
   */
  private async scheduleCheckpoints(
    baselineId: string,
    kpiTargets: KpiTarget[],
    organizationId: string,
  ): Promise<Array<{ id: string; kpiTargetId: string; measurementDate: string }>> {
    const checkpoints: Array<{ id: string; kpiTargetId: string; measurementDate: string }> = [];
    const now = new Date();

    // Collect all checkpoint rows across all targets and quarters, then bulk insert.
    const checkpointRows: Array<Record<string, unknown>> = [];

    for (const target of kpiTargets) {
      // Create quarterly checkpoints
      const quarters = Math.ceil(target.timeline_months / 3);

      for (let q = 1; q <= quarters; q++) {
        const checkpointDate = new Date(now);
        checkpointDate.setMonth(checkpointDate.getMonth() + q * 3);

        // Calculate expected progress (linear interpolation)
        const progressPct = q / quarters;
        const expectedValue = target.baseline_value + (target.target_value - target.baseline_value) * progressPct;

        const checkpointId = crypto.randomUUID();

        checkpointRows.push({
          id: checkpointId,
          organization_id: organizationId,
          baseline_id: baselineId,
          kpi_target_id: target.id,
          measurement_date: checkpointDate.toISOString().split("T")[0],
          expected_value_min: expectedValue * 0.9,
          expected_value_max: expectedValue * 1.1,
          status: "pending",
          created_at: now.toISOString(),
        });

        checkpoints.push({
          id: checkpointId,
          kpiTargetId: target.id,
          measurementDate: checkpointDate.toISOString(),
        });
      }
    }

    if (checkpointRows.length > 0) {
      const { error: checkpointInsertError } = await supabase
        .from("promise_checkpoints")
        .insert(checkpointRows);

      if (checkpointInsertError) {
        throw new Error(`Failed to insert checkpoints: ${checkpointInsertError.message}`);
      }
    }

    return checkpoints;
  }

  /**
   * Generate handoff notes for CS team.
   */
  private async generateHandoffNotes(
    baselineId: string,
    organizationId: string,
    caseId: string,
  ): Promise<void> {
    const now = new Date().toISOString();

    // Fetch case context
    const { data: caseData } = await supabase
      .from("value_cases")
      .select("name, account_id")
      .eq("id", caseId)
      .single();

    const notes = [
      {
        section: "deal_context",
        content: `Value case: ${caseData?.name || "Untitled"}. Baseline created from approved scenario.`,
      },
      {
        section: "buyer_priorities",
        content: "Key priorities identified during value case development. See value driver analysis.",
      },
      {
        section: "implementation_assumptions",
        content: "Assumptions validated during modeling phase. Monitor during implementation.",
      },
      {
        section: "key_risks",
        content: "Risk factors identified. See scenario sensitivity analysis.",
      },
    ];

    for (const note of notes) {
      const { error: noteError } = await supabase.from("promise_handoff_notes").insert({
        id: crypto.randomUUID(),
        organization_id: organizationId,
        baseline_id: baselineId,
        section: note.section,
        content_text: note.content,
        generated_by_agent: true,
        created_at: now,
      });

      if (noteError) {
        // Handoff notes are supplementary — log but don't fail baseline creation.
        logger.error(`Failed to persist handoff note (section: ${note.section}): ${noteError.message}`);
      }
    }
  }
}
