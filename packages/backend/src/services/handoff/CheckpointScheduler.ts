/**
 * Checkpoint Scheduler
 *
 * Auto-generates quarterly checkpoints for KPI targets based on timeline.
 * Customer Success teams can adjust checkpoint dates but not remove them.
 */

import { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { createLogger } from "../../lib/logger.js";
import { supabase as supabaseClient } from "../../lib/supabase.js";

const logger = createLogger({ component: "CheckpointScheduler" });

// ============================================================================
// Types & Schemas
// ============================================================================

export const ScheduledCheckpointSchema = z.object({
  measurement_date: z.string().datetime(),
  expected_value_min: z.number(),
  expected_value_max: z.number(),
  quarter: z.number().min(1).max(4),
  year: z.number(),
});

export type ScheduledCheckpoint = z.infer<typeof ScheduledCheckpointSchema>;

export interface CheckpointGenerationResult {
  baseline_id: string;
  kpi_target_id: string;
  checkpoints_created: number;
  checkpoints: ScheduledCheckpoint[];
}

// ============================================================================
// Service
// ============================================================================

export class CheckpointScheduler {
  private supabase: SupabaseClient;

  constructor() {
    if (!supabaseClient) {
      throw new Error("CheckpointScheduler requires Supabase to be configured");
    }
    this.supabase = supabaseClient;
  }

  /**
   * Generate quarterly checkpoints for all KPI targets in a baseline.
   * Called automatically when a baseline is created.
   */
  async generateCheckpointsForBaseline(
    baselineId: string,
    tenantId: string,
    startDate: Date = new Date()
  ): Promise<CheckpointGenerationResult[]> {
    logger.info("Generating checkpoints for baseline", { baselineId, tenantId });

    // Fetch all KPI targets for this baseline
    const { data: kpiTargets, error } = await this.supabase
      .from("promise_kpi_targets")
      .select("*")
      .eq("baseline_id", baselineId)
      .eq("tenant_id", tenantId);

    if (error) {
      throw new Error(`Failed to fetch KPI targets: ${error.message}`);
    }

    if (!kpiTargets || kpiTargets.length === 0) {
      logger.warn("No KPI targets found for baseline", { baselineId });
      return [];
    }

    const results: CheckpointGenerationResult[] = [];

    for (const kpi of kpiTargets) {
      try {
        const checkpoints = this.calculateQuarterlyCheckpoints(
          kpi.baseline_value,
          kpi.target_value,
          kpi.timeline_months,
          startDate
        );

        // Insert checkpoints into database
        const created = await this.insertCheckpoints(
          baselineId,
          kpi.id,
          tenantId,
          checkpoints
        );

        results.push({
          baseline_id: baselineId,
          kpi_target_id: kpi.id,
          checkpoints_created: created,
          checkpoints,
        });

        logger.info("Created checkpoints for KPI", {
          kpiId: kpi.id,
          metricName: kpi.metric_name,
          count: created,
        });
      } catch (err) {
        logger.error("Failed to generate checkpoints for KPI", {
          kpiId: kpi.id,
          error: (err as Error).message,
        });
      }
    }

    return results;
  }

  /**
   * Calculate quarterly checkpoint dates and expected values.
   * Distributes target achievement linearly across quarters.
   */
  calculateQuarterlyCheckpoints(
    baselineValue: number,
    targetValue: number,
    timelineMonths: number,
    startDate: Date
  ): ScheduledCheckpoint[] {
    const checkpoints: ScheduledCheckpoint[] = [];
    const totalChange = targetValue - baselineValue;
    const numQuarters = Math.ceil(timelineMonths / 3);

    const currentDate = new Date(startDate);
    let currentYear = currentDate.getFullYear();
    let currentQuarter = Math.floor(currentDate.getMonth() / 3) + 1;

    for (let i = 1; i <= numQuarters; i++) {
      // Advance to next quarter
      currentQuarter++;
      if (currentQuarter > 4) {
        currentQuarter = 1;
        currentYear++;
      }

      // Calculate expected value for this checkpoint (linear progression)
      const progressRatio = i / numQuarters;
      const expectedValue = baselineValue + totalChange * progressRatio;

      // Set measurement date to middle of quarter (15th of middle month)
      const middleMonth = (currentQuarter - 1) * 3 + 1; // 1, 4, 7, or 10
      const measurementDate = new Date(currentYear, middleMonth + 1, 15); // 15th of middle month

      // Calculate expected range (±10% variance allowed)
      const variance = Math.abs(totalChange) * 0.1;
      const expectedMin = expectedValue - variance;
      const expectedMax = expectedValue + variance;

      checkpoints.push({
        measurement_date: measurementDate.toISOString(),
        expected_value_min: Math.min(expectedMin, expectedMax),
        expected_value_max: Math.max(expectedMin, expectedMax),
        quarter: currentQuarter,
        year: currentYear,
      });
    }

    return checkpoints;
  }

  /**
   * Insert calculated checkpoints into the database.
   */
  private async insertCheckpoints(
    baselineId: string,
    kpiTargetId: string,
    tenantId: string,
    checkpoints: ScheduledCheckpoint[]
  ): Promise<number> {
    const records = checkpoints.map(cp => ({
      tenant_id: tenantId,
      baseline_id: baselineId,
      kpi_target_id: kpiTargetId,
      measurement_date: cp.measurement_date.split("T")[0], // Date only
      expected_value_min: cp.expected_value_min,
      expected_value_max: cp.expected_value_max,
      status: "pending",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));

    const { error } = await this.supabase
      .from("promise_checkpoints")
      .insert(records);

    if (error) {
      throw new Error(`Failed to insert checkpoints: ${error.message}`);
    }

    return records.length;
  }

  /**
   * Allow CS team to adjust a checkpoint date (but not remove).
   */
  async adjustCheckpointDate(
    checkpointId: string,
    tenantId: string,
    newDate: string
  ): Promise<void> {
    logger.info("Adjusting checkpoint date", { checkpointId, tenantId, newDate });

    // Verify checkpoint exists and belongs to tenant
    const { data: checkpoint, error: fetchError } = await this.supabase
      .from("promise_checkpoints")
      .select("id, status")
      .eq("id", checkpointId)
      .eq("tenant_id", tenantId)
      .single();

    if (fetchError || !checkpoint) {
      throw new Error(`Checkpoint not found or access denied: ${checkpointId}`);
    }

    if (checkpoint.status !== "pending") {
      throw new Error(`Cannot adjust checkpoint that has already been measured`);
    }

    const { error } = await this.supabase
      .from("promise_checkpoints")
      .update({
        measurement_date: newDate,
        updated_at: new Date().toISOString(),
      })
      .eq("id", checkpointId)
      .eq("tenant_id", tenantId);

    if (error) {
      throw new Error(`Failed to update checkpoint: ${error.message}`);
    }

    logger.info("Checkpoint date adjusted", { checkpointId, newDate });
  }

  /**
   * Get upcoming checkpoints for a baseline (next 90 days).
   */
  async getUpcomingCheckpoints(
    baselineId: string,
    tenantId: string,
    daysAhead: number = 90
  ): Promise<unknown[]> {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + daysAhead);

    const { data, error } = await this.supabase
      .from("promise_checkpoints")
      .select(`
        *,
        promise_kpi_targets!inner(metric_name, unit)
      `)
      .eq("baseline_id", baselineId)
      .eq("tenant_id", tenantId)
      .eq("status", "pending")
      .lte("measurement_date", futureDate.toISOString().split("T")[0])
      .order("measurement_date", { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch upcoming checkpoints: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Record an actual measurement at a checkpoint.
   */
  async recordMeasurement(
    checkpointId: string,
    tenantId: string,
    actualValue: number,
    dataSource: string,
    userId: string,
    notes?: string
  ): Promise<void> {
    logger.info("Recording checkpoint measurement", { checkpointId, tenantId, actualValue });

    // Determine status based on expected range
    const { data: checkpoint, error: fetchError } = await this.supabase
      .from("promise_checkpoints")
      .select("expected_value_min, expected_value_max")
      .eq("id", checkpointId)
      .eq("tenant_id", tenantId)
      .single();

    if (fetchError || !checkpoint) {
      throw new Error(`Checkpoint not found: ${checkpointId}`);
    }

    let status: "measured" | "missed" | "exceeded" = "measured";
    if (checkpoint.expected_value_min !== null && checkpoint.expected_value_max !== null) {
      if (actualValue < checkpoint.expected_value_min) {
        status = "missed";
      } else if (actualValue > checkpoint.expected_value_max) {
        status = "exceeded";
      }
    }

    const { error } = await this.supabase
      .from("promise_checkpoints")
      .update({
        actual_value: actualValue,
        data_source_for_actuals: dataSource,
        status,
        measured_at: new Date().toISOString(),
        measured_by_user_id: userId,
        notes: notes || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", checkpointId)
      .eq("tenant_id", tenantId);

    if (error) {
      throw new Error(`Failed to record measurement: ${error.message}`);
    }

    logger.info("Measurement recorded", { checkpointId, status, actualValue });
  }
}

export const checkpointScheduler = new CheckpointScheduler();
export default checkpointScheduler;
