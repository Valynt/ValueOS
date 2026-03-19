/**
 * CheckpointScheduler
 *
 * Auto-generates quarterly checkpoints for KPI targets based on timeline.
 * CS team can adjust checkpoint dates but not remove them.
 *
 * Reference: openspec/changes/promise-baseline-handoff/tasks.md §4
 */

import { z } from "zod";
import { logger } from "../lib/logger.js";
import { supabase } from "../lib/supabase.js";

export const CheckpointSchema = z.object({
  id: z.string().uuid(),
  baseline_id: z.string().uuid(),
  kpi_target_id: z.string().uuid(),
  measurement_date: z.string(),
  expected_value_min: z.number(),
  expected_value_max: z.number(),
  status: z.enum(["pending", "measured", "missed", "exceeded"]),
});

export type Checkpoint = z.infer<typeof CheckpointSchema>;
type DatabaseClient = Pick<typeof supabase, "from">;

const UNSAFE_IDENTIFIER_PATTERNS = [
  /['"]/,
  /--/,
  /;/,
  /<[^>]+>/,
  /\.\.[/\\]/,
  /\$\{/,
  /\x00/,
  /\b(or|union|select|drop|delete|insert|update)\b/i,
];

const assertSafeIdentifier = (value: string, fieldName: string) => {
  if (!value || UNSAFE_IDENTIFIER_PATTERNS.some((pattern) => pattern.test(value))) {
    throw new Error(`Invalid ${fieldName}`);
  }
};

export class CheckpointScheduler {
  private readonly db: DatabaseClient;

  constructor(dependencies: { supabaseClient?: DatabaseClient } = {}) {
    this.db = dependencies.supabaseClient ?? supabase;
  }

  async scheduleCheckpoints(params: {
    baselineId: string;
    tenantId: string;
    kpiTargets: Array<{
      id: string;
      baseline_value: number;
      target_value: number;
      timeline_months: number;
    }>;
  }): Promise<Checkpoint[]> {
    assertSafeIdentifier(params.baselineId, "baselineId");
    assertSafeIdentifier(params.tenantId, "tenantId");

    logger.info(`Scheduling checkpoints for baseline ${params.baselineId}`);

    const checkpoints: Checkpoint[] = [];
    const now = new Date();

    for (const target of params.kpiTargets) {
      const quarterCount = Math.ceil(target.timeline_months / 3);

      for (let q = 1; q <= quarterCount; q++) {
        const checkpointDate = new Date(now);
        checkpointDate.setMonth(checkpointDate.getMonth() + q * 3);

        const progress = q / quarterCount;
        const expectedValue = target.baseline_value + (target.target_value - target.baseline_value) * progress;

        const checkpoint: Checkpoint = {
          id: crypto.randomUUID(),
          baseline_id: params.baselineId,
          kpi_target_id: target.id,
          measurement_date: checkpointDate.toISOString().split("T")[0],
          expected_value_min: expectedValue * 0.9,
          expected_value_max: expectedValue * 1.1,
          status: "pending",
        };

        await this.persistCheckpoint(checkpoint, params.tenantId);
        checkpoints.push(checkpoint);
      }
    }

    return checkpoints;
  }

  async adjustCheckpointDate(
    checkpointId: string,
    tenantId: string,
    newDate: string,
    adjustedByUserId: string,
  ): Promise<void> {
    assertSafeIdentifier(checkpointId, "checkpointId");
    assertSafeIdentifier(tenantId, "tenantId");

    logger.info(`Adjusting checkpoint ${checkpointId} to ${newDate}`);

    const { error } = await this.db
      .from("promise_checkpoints")
      .update({
        measurement_date: newDate,
        adjusted_by_user_id: adjustedByUserId,
        adjusted_at: new Date().toISOString(),
      })
      .eq("id", checkpointId)
      .eq("tenant_id", tenantId);

    if (error) throw new Error(`Failed to adjust checkpoint: ${error.message}`);
  }

  private async persistCheckpoint(checkpoint: Checkpoint, tenantId: string): Promise<void> {
    await this.db.from("promise_checkpoints").insert({
      id: checkpoint.id,
      tenant_id: tenantId,
      baseline_id: checkpoint.baseline_id,
      kpi_target_id: checkpoint.kpi_target_id,
      measurement_date: checkpoint.measurement_date,
      expected_value_min: checkpoint.expected_value_min,
      expected_value_max: checkpoint.expected_value_max,
      status: checkpoint.status,
      created_at: new Date().toISOString(),
    });
  }
}
