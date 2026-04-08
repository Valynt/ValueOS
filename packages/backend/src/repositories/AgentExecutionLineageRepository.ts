/**
 * AgentExecutionLineageRepository
 *
 * Append-only store for per-agent-invocation lineage records.
 * Each secureInvoke call writes one row capturing memory reads,
 * tool calls, and DB writes for that execution.
 *
 * All operations are scoped to organization_id (tenant isolation).
 * Rows are never updated or deleted by application code — DSR erasure
 * is handled by service_role via the DSR API.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { logger } from "../lib/logger.js";

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

export const AgentExecutionLineageWriteSchema = z.object({
  session_id: z.string().uuid(),
  agent_name: z.string().min(1),
  organization_id: z.string().uuid(),
  memory_reads: z.array(z.unknown()).default([]),
  tool_calls: z.array(z.unknown()).default([]),
  db_writes: z.array(z.unknown()).default([]),
});

export type AgentExecutionLineageWrite = z.infer<
  typeof AgentExecutionLineageWriteSchema
>;

export interface AgentExecutionLineageRow {
  id: string;
  session_id: string;
  agent_name: string;
  organization_id: string;
  memory_reads: unknown[];
  tool_calls: unknown[];
  db_writes: unknown[];
  created_at: string;
}

export interface LineageQueryOptions {
  caseId: string;
  organizationId: string;
  page?: number;
  pageSize?: number;
}

export interface LineagePage {
  rows: AgentExecutionLineageRow[];
  total: number;
  page: number;
  pageSize: number;
}

// ---------------------------------------------------------------------------
// Repository
// ---------------------------------------------------------------------------

export class AgentExecutionLineageRepository {
  private readonly db: SupabaseClient;

  constructor(db: SupabaseClient) {
    this.db = db;
  }

  /**
   * Append a lineage row. Non-blocking — errors are logged but not re-thrown
   * so a lineage write failure never propagates to the agent's main path.
   */
  async appendLineage(
    data: AgentExecutionLineageWrite
  ): Promise<string | null> {
    const parsed = AgentExecutionLineageWriteSchema.safeParse(data);
    if (!parsed.success) {
      logger.warn("AgentExecutionLineageRepository: invalid write payload", {
        errors: parsed.error.issues,
      });
      return null;
    }

    try {
      const { data: row, error } = await this.db
        .from("agent_execution_lineage")
        .insert(parsed.data)
        .select("id")
        .single();

      if (error) {
        logger.warn("AgentExecutionLineageRepository: insert failed", {
          error: error.message,
        });
        return null;
      }

      return (row as { id: string }).id;
    } catch (err) {
      logger.warn("AgentExecutionLineageRepository: unexpected error", {
        error: err instanceof Error ? err.message : String(err),
      });
      return null;
    }
  }

  /**
   * Fetch paginated lineage rows for a case (session_id = caseId).
   * Tenant-scoped: only rows matching organizationId are returned.
   */
  async getLineageForCase(opts: LineageQueryOptions): Promise<LineagePage> {
    const page = Math.max(1, opts.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, opts.pageSize ?? 20));
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const { data, error, count } = await this.db
      .from("agent_execution_lineage")
      .select("*", { count: "exact" })
      .eq("session_id", opts.caseId)
      .eq("organization_id", opts.organizationId)
      .order("created_at", { ascending: false })
      .range(from, to);

    if (error) {
      logger.error("AgentExecutionLineageRepository: query failed", {
        error: error.message,
        caseId: opts.caseId,
        organizationId: opts.organizationId,
      });
      throw error;
    }

    return {
      rows: (data ?? []) as AgentExecutionLineageRow[],
      total: count ?? 0,
      page,
      pageSize,
    };
  }
}

// No module-level singleton — callers must inject an RLS-scoped SupabaseClient.
// Example: new AgentExecutionLineageRepository(requestScopedClient)
