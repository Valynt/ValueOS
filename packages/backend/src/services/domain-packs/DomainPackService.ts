/**
 * Domain Pack Service
 *
 * Implements the Layered Resolution Strategy for domain packs.
 * Precedence: Case Override > Domain Pack Default > Base System Fallback.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { logger } from "../../lib/logger.js";

// ============================================================================
// Types
// ============================================================================

export const DomainPackSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid().nullable(),
  name: z.string(),
  slug: z.string(),
  industry: z.string(),
  description: z.string().nullable(),
  version: z.string(),
  status: z.enum(["active", "draft", "archived"]),
  glossary: z.record(z.string()).default({}),
  narrative_templates: z.record(z.unknown()).default({}),
  compliance_rules: z.array(z.string()).default([]),
  created_at: z.string(),
  updated_at: z.string(),
});

export type DomainPack = z.infer<typeof DomainPackSchema>;

export const PackKPISchema = z.object({
  id: z.string().uuid(),
  pack_id: z.string().uuid(),
  kpi_key: z.string(),
  default_name: z.string(),
  description: z.string().nullable(),
  unit: z.string().nullable(),
  direction: z.enum(["up", "down", "neutral"]),
  category: z.string().nullable(),
  baseline_hint: z.string().nullable(),
  target_hint: z.string().nullable(),
  sort_order: z.number(),
});

export type PackKPI = z.infer<typeof PackKPISchema>;

export const PackAssumptionSchema = z.object({
  id: z.string().uuid(),
  pack_id: z.string().uuid(),
  assumption_key: z.string(),
  display_name: z.string(),
  description: z.string().nullable(),
  value_type: z.enum(["number", "bool", "text"]),
  value_number: z.number().nullable(),
  value_bool: z.boolean().nullable(),
  value_text: z.string().nullable(),
  unit: z.string().nullable(),
  category: z.string().nullable(),
  sort_order: z.number(),
});

export type PackAssumption = z.infer<typeof PackAssumptionSchema>;

export interface MergedKPI {
  kpi_key: string;
  name: string;
  description: string | null;
  unit: string | null;
  direction: "up" | "down" | "neutral";
  category: string | null;
  baseline_value: number | null;
  target_value: number | null;
  baseline_hint: string | null;
  target_hint: string | null;
  origin: "manual" | "domain_pack" | "agent";
  /** True if the user has overridden this KPI in the case */
  hardened: boolean;
}

export interface MergedAssumption {
  assumption_key: string;
  display_name: string;
  description: string | null;
  value: number | boolean | string | null;
  value_type: "number" | "bool" | "text";
  unit: string | null;
  category: string | null;
  origin: "manual" | "domain_pack" | "system";
  /** True if the user has overridden this assumption in the case */
  hardened: boolean;
}

export interface MergedContext {
  pack: DomainPack | null;
  kpis: MergedKPI[];
  assumptions: MergedAssumption[];
}

// ============================================================================
// Base System Fallback Defaults
// ============================================================================

const BASE_ASSUMPTIONS: Record<string, { display_name: string; value: number; unit: string; category: string }> = {
  discount_rate: { display_name: "Discount Rate", value: 10, unit: "%", category: "Financial" },
  risk_premium: { display_name: "Risk Premium", value: 3, unit: "%", category: "Risk" },
  payback_tolerance_months: { display_name: "Payback Tolerance", value: 18, unit: "months", category: "Financial" },
  compliance_cost_multiplier: { display_name: "Compliance Cost Multiplier", value: 1.1, unit: "x", category: "Compliance" },
};

// ============================================================================
// Service
// ============================================================================

export class DomainPackService {
  constructor(private supabase: SupabaseClient) {}

  /**
   * List all domain packs available to a tenant (system packs + tenant-owned).
   */
  async listPacks(tenantId: string): Promise<DomainPack[]> {
    const { data, error } = await this.supabase
      .from("domain_packs")
      .select("*")
      .or(`tenant_id.is.null,tenant_id.eq.${tenantId}`)
      .eq("status", "active")
      .order("name");

    if (error) {
      logger.error("Failed to list domain packs", { error: error.message, tenantId });
      throw new Error(`Failed to list domain packs: ${error.message}`);
    }

    return (data ?? []) as DomainPack[];
  }

  /**
   * Get a single domain pack with its KPIs and assumptions.
   */
  async getPackWithLayers(packId: string): Promise<{
    pack: DomainPack;
    kpis: PackKPI[];
    assumptions: PackAssumption[];
  }> {
    const [packResult, kpisResult, assumptionsResult] = await Promise.all([
      this.supabase.from("domain_packs").select("*").eq("id", packId).single(),
      this.supabase.from("domain_pack_kpis").select("*").eq("pack_id", packId).order("sort_order"),
      this.supabase.from("domain_pack_assumptions").select("*").eq("pack_id", packId).order("sort_order"),
    ]);

    if (packResult.error) {
      throw new Error(`Domain pack not found: ${packResult.error.message}`);
    }

    return {
      pack: packResult.data as DomainPack,
      kpis: (kpisResult.data ?? []) as PackKPI[],
      assumptions: (assumptionsResult.data ?? []) as PackAssumption[],
    };
  }

  /**
   * Set the domain pack for a value case.
   * Creates a point-in-time snapshot for reproducibility.
   */
  async setPackForCase(caseId: string, packId: string, organizationId: string): Promise<void> {
    // Load the pack with all layers to create a snapshot
    const packData = await this.getPackWithLayers(packId);

    const snapshot = {
      schemaVersion: 1,
      packId: packData.pack.id,
      parentPackId: null,
      name: packData.pack.name,
      industry: packData.pack.industry,
      version: packData.pack.version,
      kpis: packData.kpis.map((k) => ({
        kpiKey: k.kpi_key,
        defaultName: k.default_name,
        description: k.description,
        unit: k.unit,
        direction: k.direction,
        baselineHint: k.baseline_hint,
        targetHint: k.target_hint,
        defaultConfidence: 0.8,
        sortOrder: k.sort_order,
      })),
      assumptions: packData.assumptions.map((a) => ({
        assumptionKey: a.assumption_key,
        valueType: a.value_type,
        valueNumber: a.value_number,
        valueText: a.value_text,
        valueBool: a.value_bool,
        unit: a.unit,
        defaultConfidence: 0.9,
      })),
      glossary: packData.pack.glossary ?? {},
      complianceRules: packData.pack.compliance_rules ?? [],
      snapshotCreatedAt: new Date().toISOString(),
    };

    const { error } = await this.supabase
      .from("value_cases")
      .update({
        domain_pack_id: packId,
        domain_pack_version: packData.pack.version,
        domain_pack_snapshot: snapshot,
      })
      .eq("id", caseId)
      .eq("organization_id", organizationId);

    if (error) {
      logger.error("Failed to set domain pack for case", { error: error.message, caseId, packId });
      throw new Error(`Failed to set domain pack: ${error.message}`);
    }

    logger.info("Domain pack set for case with snapshot", { caseId, packId, version: packData.pack.version, organizationId });
  }

  /**
   * Core resolver: merges case overrides, domain pack defaults, and base system fallbacks.
   *
   * Precedence: Case Override > Domain Pack Default > Base System Fallback
   */
  async getMergedContext(caseId: string, organizationId: string): Promise<MergedContext> {
    // 1. Get the value case to find its domain_pack_id
    const { data: caseData, error: caseError } = await this.supabase
      .from("value_cases")
      .select("id, domain_pack_id")
      .eq("id", caseId)
      .eq("organization_id", organizationId)
      .single();

    if (caseError) {
      throw new Error(`Value case not found: ${caseError.message}`);
    }

    const packId = caseData.domain_pack_id as string | null;

    // 2. Load case-level overrides
    const [caseKpis, caseAssumptions] = await Promise.all([
      this.supabase
        .from("kpi_hypotheses")
        .select("*")
        .eq("value_case_id", caseId),
      this.supabase
        .from("assumptions")
        .select("*")
        .eq("value_case_id", caseId),
    ]);

    const userKpiMap = new Map<string, {
      kpi_name: string;
      baseline_value: number | null;
      target_value: number | null;
      unit: string | null;
      confidence_level: string | null;
      origin: string;
    }>();
    for (const kpi of (caseKpis.data ?? [])) {
      userKpiMap.set(kpi.kpi_name, kpi);
    }

    const userAssumptionMap = new Map<string, {
      assumption_type: string;
      assumption_text: string;
      source: string | null;
      confidence_level: string | null;
    }>();
    for (const assumption of (caseAssumptions.data ?? [])) {
      userAssumptionMap.set(assumption.assumption_type, assumption);
    }

    // 3. Load domain pack layers (if a pack is selected)
    let pack: DomainPack | null = null;
    let packKpis: PackKPI[] = [];
    let packAssumptions: PackAssumption[] = [];

    if (packId) {
      const packData = await this.getPackWithLayers(packId);
      pack = packData.pack;
      packKpis = packData.kpis;
      packAssumptions = packData.assumptions;
    }

    // 4. Merge KPIs: case overrides > pack defaults
    const mergedKpis: MergedKPI[] = [];
    const seenKpiKeys = new Set<string>();

    // First: all pack KPIs (with case overrides applied)
    for (const packKpi of packKpis) {
      const userOverride = userKpiMap.get(packKpi.kpi_key);
      seenKpiKeys.add(packKpi.kpi_key);

      mergedKpis.push({
        kpi_key: packKpi.kpi_key,
        name: packKpi.default_name,
        description: packKpi.description,
        unit: packKpi.unit,
        direction: packKpi.direction,
        category: packKpi.category,
        baseline_value: userOverride?.baseline_value ?? null,
        target_value: userOverride?.target_value ?? null,
        baseline_hint: packKpi.baseline_hint,
        target_hint: packKpi.target_hint,
        origin: userOverride ? (userOverride.origin as "manual" | "domain_pack" | "agent") : "domain_pack",
        hardened: !!userOverride,
      });
    }

    // Second: any user KPIs not in the pack
    for (const [kpiName, userKpi] of userKpiMap) {
      if (!seenKpiKeys.has(kpiName)) {
        mergedKpis.push({
          kpi_key: kpiName,
          name: kpiName,
          description: null,
          unit: userKpi.unit,
          direction: "up",
          category: null,
          baseline_value: userKpi.baseline_value,
          target_value: userKpi.target_value,
          baseline_hint: null,
          target_hint: null,
          origin: (userKpi.origin as "manual" | "domain_pack" | "agent") ?? "manual",
          hardened: true,
        });
      }
    }

    // 5. Merge Assumptions: case overrides > pack defaults > base system
    const mergedAssumptions: MergedAssumption[] = [];
    const seenAssumptionKeys = new Set<string>();

    // Pack assumptions first
    for (const packAssumption of packAssumptions) {
      const userOverride = userAssumptionMap.get(packAssumption.assumption_key);
      seenAssumptionKeys.add(packAssumption.assumption_key);

      const packValue = packAssumption.value_type === "number"
        ? packAssumption.value_number
        : packAssumption.value_type === "bool"
          ? packAssumption.value_bool
          : packAssumption.value_text;

      mergedAssumptions.push({
        assumption_key: packAssumption.assumption_key,
        display_name: packAssumption.display_name,
        description: packAssumption.description,
        value: userOverride ? parseAssumptionValue(userOverride.assumption_text) : packValue,
        value_type: packAssumption.value_type,
        unit: packAssumption.unit,
        category: packAssumption.category,
        origin: userOverride ? "manual" : "domain_pack",
        hardened: !!userOverride,
      });
    }

    // User assumptions not in pack
    for (const [key, userAssumption] of userAssumptionMap) {
      if (!seenAssumptionKeys.has(key)) {
        seenAssumptionKeys.add(key);
        mergedAssumptions.push({
          assumption_key: key,
          display_name: key,
          description: null,
          value: parseAssumptionValue(userAssumption.assumption_text),
          value_type: "text",
          unit: null,
          category: null,
          origin: "manual",
          hardened: true,
        });
      }
    }

    // Base system fallbacks for anything still missing
    for (const [key, base] of Object.entries(BASE_ASSUMPTIONS)) {
      if (!seenAssumptionKeys.has(key)) {
        mergedAssumptions.push({
          assumption_key: key,
          display_name: base.display_name,
          description: null,
          value: base.value,
          value_type: "number",
          unit: base.unit,
          category: base.category,
          origin: "system",
          hardened: false,
        });
      }
    }

    return { pack, kpis: mergedKpis, assumptions: mergedAssumptions };
  }

  /**
   * Harden a ghost KPI: write a pack-suggested KPI into kpi_hypotheses.
   */
  async hardenKPI(
    caseId: string,
    kpiKey: string,
    values: { baseline_value?: number; target_value?: number },
    organizationId: string
  ): Promise<void> {
    const { error } = await this.supabase
      .from("kpi_hypotheses")
      .upsert({
        value_case_id: caseId,
        kpi_name: kpiKey,
        baseline_value: values.baseline_value ?? null,
        target_value: values.target_value ?? null,
        origin: "domain_pack",
        confidence_level: "medium",
      }, {
        onConflict: "value_case_id,kpi_name",
      });

    if (error) {
      logger.error("Failed to harden KPI", { error: error.message, caseId, kpiKey });
      throw new Error(`Failed to harden KPI: ${error.message}`);
    }

    logger.info("KPI hardened from domain pack", { caseId, kpiKey, organizationId });
  }

  /**
   * Bulk-harden all ghost KPIs from the domain pack into the case.
   */
  async hardenAllKPIs(caseId: string, organizationId: string): Promise<number> {
    const merged = await this.getMergedContext(caseId, organizationId);
    const ghostKpis = merged.kpis.filter(k => !k.hardened);

    if (ghostKpis.length === 0) return 0;

    const rows = ghostKpis.map(kpi => ({
      value_case_id: caseId,
      kpi_name: kpi.kpi_key,
      baseline_value: null,
      target_value: null,
      origin: "domain_pack" as const,
      confidence_level: "medium",
    }));

    const { error } = await this.supabase
      .from("kpi_hypotheses")
      .upsert(rows, { onConflict: "value_case_id,kpi_name" });

    if (error) {
      throw new Error(`Failed to bulk-harden KPIs: ${error.message}`);
    }

    logger.info("Bulk-hardened KPIs from domain pack", { caseId, count: ghostKpis.length, organizationId });
    return ghostKpis.length;
  }

  /**
   * Get the KPI definitions from a pack for injection into agent prompts.
   * Returns a formatted string suitable for system message context.
   */
  async getAgentKPIContext(packId: string): Promise<string> {
    const { kpis } = await this.getPackWithLayers(packId);

    if (kpis.length === 0) return "";

    const lines = kpis.map(k =>
      `- ${k.kpi_key}: ${k.default_name} (${k.unit ?? "unitless"}, direction: ${k.direction})${k.description ? ` — ${k.description}` : ""}`
    );

    return `Preferred KPI vocabulary for this industry:\n${lines.join("\n")}`;
  }
}

// ============================================================================
// Helpers
// ============================================================================

function parseAssumptionValue(text: string): number | boolean | string {
  if (text === "true") return true;
  if (text === "false") return false;
  const num = Number(text);
  if (!isNaN(num)) return num;
  return text;
}
