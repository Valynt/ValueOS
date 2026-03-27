import type { SupabaseClient } from "@supabase/supabase-js";
import type { Request } from "express";

import { createUserSupabaseClient } from "../../lib/supabase.js";

export interface StoredScenario {
  id: string;
  name: string;
  description?: string;
  assumptions: Array<{ key: string; value: number; unit?: string }>;
  roiPercent: number;
  npv: number | null;
  paybackMonths: number;
  annualSavings: number;
  costInputUsd: number | null;
  timelineYears: number | null;
  investmentSource: "explicit" | "assumptions_register" | "default" | null;
  updatedAt: string;
}

interface ScenarioRow {
  id: string;
  organization_id: string;
  case_id: string;
  scenario_type: "conservative" | "base" | "upside";
  assumptions_snapshot_json: {
    // Metadata is stored under __meta to avoid collisions with user-supplied
    // assumption keys (see ScenarioBuilder.buildAssumptionSnapshot).
    __meta?: { name?: string | null; description?: string | null };
    assumptions?: Array<{ key: string; value: number; unit?: string }>;
    annualSavings?: number;
  };
  roi: string | number | null;
  npv: string | number | null;
  payback_months: string | number | null;
  cost_input_usd: string | number | null;
  timeline_years: string | number | null;
  investment_source: "explicit" | "assumptions_register" | "default" | null;
  created_at: string;
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
  const meta = snapshot.__meta;
  return {
    id: row.id,
    name: meta?.name ?? "Unnamed Scenario",
    description: meta?.description ?? undefined,
    assumptions: snapshot.assumptions ?? [],
    annualSavings: snapshot.annualSavings ?? 0,
    roiPercent: toNumber(row.roi),
    npv: row.npv !== null && row.npv !== undefined ? toNumber(row.npv) : null,
    paybackMonths: toNumber(row.payback_months),
    costInputUsd: row.cost_input_usd !== null && row.cost_input_usd !== undefined ? toNumber(row.cost_input_usd) : null,
    timelineYears: row.timeline_years !== null && row.timeline_years !== undefined ? toNumber(row.timeline_years) : null,
    investmentSource: row.investment_source ?? null,
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
      .select("id, organization_id, case_id, scenario_type, assumptions_snapshot_json, roi, npv, payback_months, cost_input_usd, timeline_years, investment_source, created_at")
      .eq("organization_id", tenantId)
      .eq("case_id", modelId)
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch scenarios: ${error.message}`);
    }

    return (data ?? []).map((row) => mapScenarioRow(row as ScenarioRow));
  }

  async loadById(tenantId: string, modelId: string, scenarioId: string): Promise<StoredScenario> {
    const { data, error } = await this.supabase
      .from("scenarios")
      .select("id, organization_id, case_id, scenario_type, assumptions_snapshot_json, roi, npv, payback_months, cost_input_usd, timeline_years, investment_source, created_at")
      .eq("organization_id", tenantId)
      .eq("case_id", modelId)
      .eq("id", scenarioId)
      .single();

    if (error || !data) {
      throw new Error(`Failed to load scenario ${scenarioId}: ${error?.message ?? "not found"}`);
    }

    return mapScenarioRow(data as ScenarioRow);
  }

}
