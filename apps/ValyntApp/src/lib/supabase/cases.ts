/**
 * Case query service — Supabase queries for value_cases.
 *
 * Replaces MOCK_CASES in CasesPage.tsx and inline mock data in CaseWorkspace.tsx.
 * All queries enforce tenant isolation via tenant_id filter.
 */

import { createClient } from "@supabase/supabase-js";

import type {
  PortfolioValue,
  ValueCaseInsert,
  ValueCaseRow,
  ValueCaseWithRelations,
} from "./types";


import { supabase } from "@/lib/supabase";

class CaseQueryError extends Error {
  constructor(
    operation: string,
    public readonly pgError: { message: string; code?: string }
  ) {
    super(`CasesService.${operation} failed: ${pgError.message}`);
    this.name = "CaseQueryError";
  }
}

// The Supabase client may be null during SSR.
// We cast to a specific client type so callers can use `.from()` with
// proper typings. Supabase is initialized with `createClient` and
// the exported `supabase` variable is `ReturnType<typeof createClient> | null`.
function getClient(): ReturnType<typeof createClient> {
  if (!supabase) {
    throw new CaseQueryError("getClient", {
      message: "Supabase client not available (server-side rendering?)",
    });
  }
  return supabase;
}

const CASES_WITH_RELATIONS_SELECT = `
  *,
  company_profiles:company_profile_id (
    id,
    company_name
  ),
  domain_packs:domain_pack_id (
    id,
    name,
    industry,
    slug
  )
`;

export const CasesService = {
  /**
   * Fetch all cases for the current tenant.
   * Replaces MOCK_CASES in CasesPage.tsx.
   */
  async listCases(tenantId: string): Promise<ValueCaseWithRelations[]> {
    const client = getClient();
    const { data, error } = await client
      .from("value_cases")
      .select(CASES_WITH_RELATIONS_SELECT)
      .eq("tenant_id", tenantId)
      .order("updated_at", { ascending: false });

    if (error) throw new CaseQueryError("listCases", error);
    return (data ?? []) as unknown as ValueCaseWithRelations[];
  },

  /**
   * Fetch a single case with related data.
   * Replaces inline mock data in CaseWorkspace.tsx.
   */
  async getCase(
    caseId: string,
    tenantId: string
  ): Promise<ValueCaseWithRelations> {
    const client = getClient();
    const { data, error } = await client
      .from("value_cases")
      .select(CASES_WITH_RELATIONS_SELECT)
      .eq("id", caseId)
      .eq("tenant_id", tenantId)
      .single();

    if (error) throw new CaseQueryError("getCase", error);
    return data as unknown as ValueCaseWithRelations;
  },

  /**
   * Create a new case linked to a domain pack.
   */
  async createCase(input: ValueCaseInsert): Promise<ValueCaseRow> {
    const client = getClient();
    const insertPayload: Record<string, unknown> = {
      name: input.name,
      description: input.description ?? null,
      tenant_id: input.tenant_id,
      organization_id: input.organization_id ?? null,
      company_profile_id: input.company_profile_id ?? null,
      domain_pack_id: input.domain_pack_id ?? null,
      status: input.status ?? "draft",
      stage: input.stage ?? "discovery",
      metadata: input.metadata ?? {},
    };

    const { data, error } = await client
      .from("value_cases")
      .insert(insertPayload)
      .select()
      .single();

    if (error) throw new CaseQueryError("createCase", error);
    return data as unknown as ValueCaseRow;
  },

  /**
   * Update case stage progression.
   */
  async updateStage(
    caseId: string,
    tenantId: string,
    stage: string
  ): Promise<void> {
    const client = getClient();
    const updatePayload: Record<string, unknown> = {
      stage,
      updated_at: new Date().toISOString(),
    };

    const { error } = await client
      .from("value_cases")
      .update(updatePayload)
      .eq("id", caseId)
      .eq("tenant_id", tenantId);

    if (error) throw new CaseQueryError("updateStage", error);
  },

  /**
   * Compute portfolio value rollup from real case data.
   *
   * Falls back to client-side aggregation if the RPC doesn't exist yet.
   */
  async getPortfolioValue(tenantId: string): Promise<PortfolioValue> {
    const client = getClient();

    try {
      const { data, error } = await client.rpc(
        "compute_portfolio_value",
        { p_tenant_id: tenantId } as Record<string, unknown>
      );

      if (!error && data) {
        return data as unknown as PortfolioValue;
      }
    } catch {
      // RPC may not exist yet — fall through to client-side aggregation
    }

    // Fallback: count cases and return zero-value portfolio
    const { data: cases, error: listError } = await client
      .from("value_cases")
      .select("id, quality_score")
      .eq("tenant_id", tenantId)
      .neq("status", "archived");

    if (listError) throw new CaseQueryError("getPortfolioValue", listError);

    const rows = (cases ?? []) as unknown as Array<{
      id: string;
      quality_score: number | null;
    }>;
    const caseCount = rows.length;
    const avgConfidence =
      caseCount > 0
        ? rows.reduce((sum, c) => sum + (c.quality_score ?? 0), 0) / caseCount
        : 0;

    return {
      totalValue: 0,
      caseCount,
      avgConfidence,
    };
  },
};

export { CaseQueryError };
