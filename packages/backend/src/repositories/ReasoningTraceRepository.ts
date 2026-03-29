/**
 * ReasoningTraceRepository
 *
 * Append-only store for per-agent-invocation reasoning traces.
 * Each BaseAgent.secureInvoke call writes one row capturing the 5 UI sections
 * (inputs, transformations, assumptions, confidence_breakdown, evidence_links)
 * plus system quality metrics (grounding_score, latency_ms, token_usage).
 *
 * All operations are scoped to organization_id (tenant isolation).
 * Rows are never updated or deleted by application code — DSR erasure
 * is handled by service_role via the DSR API.
 *
 * Sprint 51.
 */

import type { ReasoningTrace, ReasoningTraceWrite } from "@valueos/shared";
import { ReasoningTraceWriteSchema } from "@valueos/shared";

import { logger } from "../lib/logger.js";
import { supabase } from "../lib/supabase.js";

// ---------------------------------------------------------------------------
// Query options
// ---------------------------------------------------------------------------

export interface ReasoningTraceQueryOptions {
  caseId: string;
  organizationId: string;
  page?: number;
  pageSize?: number;
}

export interface ReasoningTracePage {
  rows: ReasoningTrace[];
  total: number;
  page: number;
  pageSize: number;
}

// ---------------------------------------------------------------------------
// Repository
// ---------------------------------------------------------------------------

export class ReasoningTraceRepository {
  /**
   * Persist a reasoning trace row.
   *
   * Non-blocking by design — callers should fire-and-forget with .catch().
   * Returns the new row's id on success, null on validation or DB failure.
   */
  async create(data: ReasoningTraceWrite): Promise<string | null> {
    const parsed = ReasoningTraceWriteSchema.safeParse(data);
    if (!parsed.success) {
      logger.warn("ReasoningTraceRepository: invalid write payload", {
        errors: parsed.error.issues,
      });
      return null;
    }

    try {
      const { data: row, error } = await supabase
        .from("reasoning_traces")
        .insert(parsed.data)
        .select("id")
        .single();

      if (error) {
        logger.warn("ReasoningTraceRepository: insert failed", {
          error: error.message,
        });
        return null;
      }

      return (row as { id: string }).id;
    } catch (err) {
      logger.warn("ReasoningTraceRepository: unexpected error on create", {
        error: err instanceof Error ? err.message : String(err),
      });
      return null;
    }
  }

  /**
   * Fetch paginated reasoning traces for a case.
   * Queries by value_case_id (maps to :caseId route parameter).
   * Tenant-scoped: only rows matching organizationId are returned.
   */
  async findByCaseId(opts: ReasoningTraceQueryOptions): Promise<ReasoningTracePage> {
    const page = Math.max(1, opts.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, opts.pageSize ?? 20));
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const { data, error, count } = await supabase
      .from("reasoning_traces")
      .select("*", { count: "exact" })
      .eq("value_case_id", opts.caseId)
      .eq("organization_id", opts.organizationId)
      .order("created_at", { ascending: false })
      .range(from, to);

    if (error) {
      logger.error("ReasoningTraceRepository: findByCaseId failed", {
        error: error.message,
        caseId: opts.caseId,
        organizationId: opts.organizationId,
      });
      throw error;
    }

    return {
      rows: (data ?? []) as ReasoningTrace[],
      total: count ?? 0,
      page,
      pageSize,
    };
  }

  /**
   * Fetch a single reasoning trace by trace_id (correlation ID).
   * Used by S2-1 evidence linking to retrieve evidence for numeric values.
   * Tenant-scoped: returns null when the row does not belong to organizationId.
   *
   * SECURITY: organizationId is REQUIRED to prevent cross-tenant data access.
   */
  async getByTraceId(
    traceId: string,
    organizationId: string
  ): Promise<ReasoningTrace | null> {
    const { data, error } = await supabase
      .from("reasoning_traces")
      .select("*")
      .eq("trace_id", traceId)
      .eq("organization_id", organizationId)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        // PostgREST "no rows" — not found
        return null;
      }
      logger.error("ReasoningTraceRepository: getByTraceId failed", {
        error: error.message,
        traceId,
        organizationId,
      });
      throw error;
    }

    return data as ReasoningTrace;
  }

  /**
   * Fetch a single reasoning trace by id.
   * Tenant-scoped: returns null when the row does not belong to organizationId.
   * RLS enforces this at the DB layer; the explicit filter is a defence-in-depth check.
   */
  async findById(
    traceId: string,
    organizationId: string
  ): Promise<ReasoningTrace | null> {
    const { data, error } = await supabase
      .from("reasoning_traces")
      .select("*")
      .eq("id", traceId)
      .eq("organization_id", organizationId)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        // PostgREST "no rows" — not found or wrong tenant
        return null;
      }
      logger.error("ReasoningTraceRepository: findById failed", {
        error: error.message,
        traceId,
        organizationId,
      });
      throw error;
    }

    return data as ReasoningTrace;
  }
}

export const reasoningTraceRepository = new ReasoningTraceRepository();
