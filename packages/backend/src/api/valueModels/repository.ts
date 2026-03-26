import type { SupabaseClient } from "@supabase/supabase-js";
import type { Request } from "express";

import { createUserSupabaseClient } from "../../lib/supabase.js";

export interface StoredScenario {
  id: string;
  name: string;
  description?: string;
  assumptions: Array<{ key: string; value: number; unit?: string }>;
  roiPercent: number;
  paybackMonths: number;
  annualSavings: number;
  updatedAt: string;
}

interface ScenarioRow {
  id: string;
  organization_id: string;
  case_id: string;
  scenario_type: "conservative" | "base" | "upside";
  assumptions_snapshot_json: {
    name?: string;
    description?: string;
    assumptions?: Array<{ key: string; value: number; unit?: string }>;
    annualSavings?: number;
  };
  roi: string | number | null;
  payback_months: string | number | null;
  created_at: string;
}

export interface ScenarioInsert {
  tenantId: string;
  modelId: string;
  name: string;
  description?: string;
  assumptions: Array<{ key: string; value: number; unit?: string }>;
  annualSavings: number;
  roiPercent: number;
  paybackMonths: number;
}

function toNumber(value: string | number | null): number {
  if (typeof value === "number") {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function mapScenarioRow(row: ScenarioRow): StoredScenario {
  const snapshot = row.assumptions_snapshot_json ?? {};
  return {
    id: row.id,
    name: snapshot.name ?? "Unnamed Scenario",
    description: snapshot.description,
    assumptions: snapshot.assumptions ?? [],
    annualSavings: snapshot.annualSavings ?? 0,
    roiPercent: toNumber(row.roi),
    paybackMonths: toNumber(row.payback_months),
    updatedAt: row.created_at,
  };
}

export class ValueModelScenariosRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  static fromRequest(req: Request): ValueModelScenariosRepository {
    if (req.supabase) {
      return new ValueModelScenariosRepository(req.supabase);
    }

    const token = (req.session as Record<string, unknown> | undefined)?.access_token;
    if (typeof token === "string") {
      return new ValueModelScenariosRepository(createUserSupabaseClient(token));
    }

    throw new Error("ValueModelScenariosRepository.fromRequest: no user-scoped Supabase client available on request");
  }

  async listByModel(tenantId: string, modelId: string): Promise<StoredScenario[]> {
    const { data, error } = await this.supabase
      .from("scenarios")
      .select("id, organization_id, case_id, scenario_type, assumptions_snapshot_json, roi, payback_months, created_at")
      .eq("organization_id", tenantId)
      .eq("case_id", modelId)
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch scenarios: ${error.message}`);
    }

    return (data ?? []).map((row) => mapScenarioRow(row as ScenarioRow));
  }

  async createScenario(insert: ScenarioInsert): Promise<StoredScenario> {
    const { data: inserted, error: insertError } = await this.supabase
      .from("scenarios")
      .insert({
        organization_id: insert.tenantId,
        case_id: insert.modelId,
        scenario_type: "base",
        assumptions_snapshot_json: {
          name: insert.name,
          description: insert.description,
          assumptions: insert.assumptions,
          annualSavings: insert.annualSavings,
        },
        roi: insert.roiPercent,
        payback_months: insert.paybackMonths,
      })
      .select("id")
      .single();

    if (insertError) {
      throw new Error(`Failed to create scenario: ${insertError.message}`);
    }

    const { data, error } = await this.supabase
      .from("scenarios")
      .select("id, organization_id, case_id, scenario_type, assumptions_snapshot_json, roi, payback_months, created_at")
      .eq("organization_id", insert.tenantId)
      .eq("case_id", insert.modelId)
      .eq("id", inserted.id)
      .single();

    if (error || !data) {
      throw new Error(`Failed to load created scenario: ${error?.message ?? "not found"}`);
    }

    return mapScenarioRow(data as ScenarioRow);
  }
}
