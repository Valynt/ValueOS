/**
 * FinancialModelSnapshotRepository
 *
 * Append-only store for FinancialModelingAgent outputs.
 * Each agent run creates a new snapshot; historical snapshots are preserved.
 * snapshot_version is auto-incremented per (case_id, organization_id).
 *
 * All operations are scoped to (case_id, organization_id).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { logger } from "../lib/logger.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export const FinancialModelSnapshotWriteSchema = z.object({
  case_id: z.string().uuid(),
  organization_id: z.string().uuid(),
  roi: z.number().optional(),
  npv: z.number().optional(),
  payback_period_months: z.number().int().optional(),
  assumptions_json: z.array(z.unknown()).default([]),
  outputs_json: z.record(z.unknown()).default({}),
  source_agent: z.string().default("FinancialModelingAgent"),
});

export type FinancialModelSnapshotWrite = z.infer<
  typeof FinancialModelSnapshotWriteSchema
>;

export interface FinancialModelSnapshotRow {
  id: string;
  case_id: string;
  organization_id: string;
  snapshot_version: number;
  roi: number | null;
  npv: number | null;
  payback_period_months: number | null;
  assumptions_json: unknown[];
  outputs_json: Record<string, unknown>;
  source_agent: string | null;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Repository
// ---------------------------------------------------------------------------

export class FinancialModelSnapshotRepository {
  private readonly db: SupabaseClient;

  constructor(db: SupabaseClient) {
    this.db = db;
  }

  /**
   * Create a new snapshot. snapshot_version is computed as MAX + 1 for the case.
   */
  async createSnapshot(
    input: FinancialModelSnapshotWrite
  ): Promise<FinancialModelSnapshotRow> {
    const validated = FinancialModelSnapshotWriteSchema.parse(input);

    // Compute next version number
    const { data: existing } = await this.db
      .from("financial_model_snapshots")
      .select("snapshot_version")
      .eq("case_id", validated.case_id)
      .eq("organization_id", validated.organization_id)
      .order("snapshot_version", { ascending: false })
      .limit(1)
      .maybeSingle();

    const nextVersion =
      ((existing?.snapshot_version as number | null) ?? 0) + 1;

    const { data, error } = await this.db
      .from("financial_model_snapshots")
      .insert({
        case_id: validated.case_id,
        organization_id: validated.organization_id,
        snapshot_version: nextVersion,
        roi: validated.roi ?? null,
        npv: validated.npv ?? null,
        payback_period_months: validated.payback_period_months ?? null,
        assumptions_json: validated.assumptions_json,
        outputs_json: validated.outputs_json,
        source_agent: validated.source_agent,
      })
      .select("*")
      .single();

    if (error || !data) {
      logger.error("FinancialModelSnapshotRepository.createSnapshot failed", {
        case_id: validated.case_id,
        organization_id: validated.organization_id,
        error: error?.message,
      });
      throw new Error(
        `Failed to create financial model snapshot: ${error?.message}`
      );
    }

    logger.info("FinancialModelSnapshotRepository: snapshot created", {
      id: data.id,
      case_id: validated.case_id,
      organization_id: validated.organization_id,
      snapshot_version: nextVersion,
      roi: validated.roi,
      npv: validated.npv,
    });

    return data as FinancialModelSnapshotRow;
  }

  /**
   * Fetch the latest snapshot for a case (highest snapshot_version).
   * Returns null if no snapshot exists.
   */
  async getLatestSnapshotForCase(
    caseId: string,
    organizationId: string
  ): Promise<FinancialModelSnapshotRow | null> {
    const { data, error } = await this.db
      .from("financial_model_snapshots")
      .select("*")
      .eq("case_id", caseId)
      .eq("organization_id", organizationId)
      .order("snapshot_version", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      logger.error(
        "FinancialModelSnapshotRepository.getLatestSnapshotForCase failed",
        {
          case_id: caseId,
          organization_id: organizationId,
          error: error.message,
        }
      );
      throw new Error(
        `Failed to fetch latest financial model snapshot: ${error.message}`
      );
    }

    return data as FinancialModelSnapshotRow | null;
  }

  /**
   * List all snapshots for a case, newest first.
   */
  async listSnapshotsForCase(
    caseId: string,
    organizationId: string
  ): Promise<FinancialModelSnapshotRow[]> {
    const { data, error } = await this.db
      .from("financial_model_snapshots")
      .select("*")
      .eq("case_id", caseId)
      .eq("organization_id", organizationId)
      .order("snapshot_version", { ascending: false });

    if (error) {
      logger.error(
        "FinancialModelSnapshotRepository.listSnapshotsForCase failed",
        {
          case_id: caseId,
          organization_id: organizationId,
          error: error.message,
        }
      );
      throw new Error(
        `Failed to list financial model snapshots: ${error.message}`
      );
    }

    return (data ?? []) as FinancialModelSnapshotRow[];
  }
}

// No module-level singleton — callers must inject an RLS-scoped SupabaseClient.
// Example: new FinancialModelSnapshotRepository(requestScopedClient)
