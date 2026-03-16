import { beforeEach, describe, expect, it, vi } from "vitest";

import { DomainPackService } from "../DomainPackService.js";

// ============================================================================
// Mock Supabase client
// ============================================================================

function createMockSupabase(responses: Record<string, unknown>) {
  const chainable = (data: unknown, error: unknown = null) => ({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data, error }),
    upsert: vi.fn().mockResolvedValue({ data: null, error: null }),
    update: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: null, error: null }),
      }),
    }),
    then: (resolve: (v: unknown) => void) => resolve({ data, error }),
  });

  return {
    from: vi.fn((table: string) => {
      const resp = responses[table];
      if (Array.isArray(resp)) {
        // Array response — for list queries
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          or: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: resp[0], error: null }),
          upsert: vi.fn().mockResolvedValue({ data: null, error: null }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
          then: (resolve: (v: unknown) => void) => resolve({ data: resp, error: null }),
        };
      }
      return chainable(resp);
    }),
  };
}

// ============================================================================
// Test data
// ============================================================================

const PACK_ID = "00000000-0000-0000-0000-000000000001";
const CASE_ID = "00000000-0000-0000-0000-000000000010";
const TENANT_ID = "00000000-0000-0000-0000-000000000099";

const mockPack = {
  id: PACK_ID,
  tenant_id: null,
  name: "Banking",
  slug: "banking",
  industry: "Banking",
  description: "Banking pack",
  version: "1.0.0",
  status: "active",
  glossary: { revenue_uplift: "NII Expansion" },
  narrative_templates: {},
  compliance_rules: [],
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

const mockPackKpis = [
  {
    id: "kpi-1",
    pack_id: PACK_ID,
    kpi_key: "core_modernization_savings",
    default_name: "Core System Modernization Savings",
    description: "Annual savings from replacing legacy systems",
    unit: "USD",
    direction: "up",
    category: "Cost",
    baseline_hint: "Typical: $15M–$50M/year",
    target_hint: "Target: 30–50% reduction",
    sort_order: 1,
  },
  {
    id: "kpi-2",
    pack_id: PACK_ID,
    kpi_key: "fraud_exposure_reduction",
    default_name: "Fraud Exposure Reduction",
    description: "Reduction in annual fraud losses",
    unit: "USD",
    direction: "up",
    category: "Risk",
    baseline_hint: "Typical: 0.1–0.3%",
    target_hint: "Target: 30–50% reduction",
    sort_order: 2,
  },
];

const mockPackAssumptions = [
  {
    id: "asn-1",
    pack_id: PACK_ID,
    assumption_key: "discount_rate",
    display_name: "Discount Rate",
    description: "WACC for banking",
    value_type: "number",
    value_number: 12,
    value_bool: null,
    value_text: null,
    unit: "%",
    category: "Financial",
    sort_order: 1,
  },
];

// ============================================================================
// Tests
// ============================================================================

describe("DomainPackService.getMergedContext", () => {
  it("returns pack KPIs as ghost (unhardened) when no case overrides exist", async () => {
    // Build a mock that returns the right data for each table query
    const mockClient = {
      from: vi.fn((table: string) => {
        if (table === "value_cases") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: { id: CASE_ID, domain_pack_id: PACK_ID },
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }
        if (table === "kpi_hypotheses") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          };
        }
        if (table === "assumptions") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          };
        }
        if (table === "domain_packs") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                or: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({ data: mockPack, error: null }),
                }),
              }),
            }),
          };
        }
        if (table === "domain_pack_kpis") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({ data: mockPackKpis, error: null }),
              }),
            }),
          };
        }
        if (table === "domain_pack_assumptions") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({ data: mockPackAssumptions, error: null }),
              }),
            }),
          };
        }
        return { select: vi.fn().mockReturnThis() };
      }),
    };

    const service = new DomainPackService(mockClient as any);
    const result = await service.getMergedContext(CASE_ID, TENANT_ID);

    // Pack should be returned
    expect(result.pack).not.toBeNull();
    expect(result.pack?.slug).toBe("banking");

    // KPIs should be ghost (not hardened)
    expect(result.kpis).toHaveLength(2);
    expect(result.kpis[0].kpi_key).toBe("core_modernization_savings");
    expect(result.kpis[0].hardened).toBe(false);
    expect(result.kpis[0].origin).toBe("domain_pack");
    expect(result.kpis[0].baseline_hint).toBe("Typical: $15M–$50M/year");

    expect(result.kpis[1].kpi_key).toBe("fraud_exposure_reduction");
    expect(result.kpis[1].hardened).toBe(false);

    // Assumptions: pack discount_rate (12%) should override base system (10%)
    const discountRate = result.assumptions.find(a => a.assumption_key === "discount_rate");
    expect(discountRate).toBeDefined();
    expect(discountRate!.value).toBe(12);
    expect(discountRate!.origin).toBe("domain_pack");
    expect(discountRate!.hardened).toBe(false);

    // Base system fallbacks should fill in missing assumptions
    const riskPremium = result.assumptions.find(a => a.assumption_key === "risk_premium");
    expect(riskPremium).toBeDefined();
    expect(riskPremium!.value).toBe(3);
    expect(riskPremium!.origin).toBe("system");
  });

  it("case overrides take precedence over pack defaults", async () => {
    const mockClient = {
      from: vi.fn((table: string) => {
        if (table === "value_cases") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: { id: CASE_ID, domain_pack_id: PACK_ID },
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }
        if (table === "kpi_hypotheses") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: [{
                  kpi_name: "core_modernization_savings",
                  baseline_value: 20000000,
                  target_value: 10000000,
                  unit: "USD",
                  confidence_level: "high",
                  origin: "manual",
                }],
                error: null,
              }),
            }),
          };
        }
        if (table === "assumptions") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: [{
                  assumption_type: "discount_rate",
                  assumption_text: "14",
                  source: "CFO input",
                  confidence_level: "high",
                }],
                error: null,
              }),
            }),
          };
        }
        if (table === "domain_packs") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                or: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({ data: mockPack, error: null }),
                }),
              }),
            }),
          };
        }
        if (table === "domain_pack_kpis") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({ data: mockPackKpis, error: null }),
              }),
            }),
          };
        }
        if (table === "domain_pack_assumptions") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({ data: mockPackAssumptions, error: null }),
              }),
            }),
          };
        }
        return { select: vi.fn().mockReturnThis() };
      }),
    };

    const service = new DomainPackService(mockClient as any);
    const result = await service.getMergedContext(CASE_ID, TENANT_ID);

    // KPI with user override should be hardened
    const coreKpi = result.kpis.find(k => k.kpi_key === "core_modernization_savings");
    expect(coreKpi).toBeDefined();
    expect(coreKpi!.hardened).toBe(true);
    expect(coreKpi!.origin).toBe("manual");
    expect(coreKpi!.baseline_value).toBe(20000000);
    expect(coreKpi!.target_value).toBe(10000000);

    // KPI without override should still be ghost
    const fraudKpi = result.kpis.find(k => k.kpi_key === "fraud_exposure_reduction");
    expect(fraudKpi).toBeDefined();
    expect(fraudKpi!.hardened).toBe(false);

    // Assumption with user override: 14% instead of pack's 12%
    const discountRate = result.assumptions.find(a => a.assumption_key === "discount_rate");
    expect(discountRate).toBeDefined();
    expect(discountRate!.value).toBe(14);
    expect(discountRate!.origin).toBe("manual");
    expect(discountRate!.hardened).toBe(true);
  });

  it("returns base system fallbacks when no pack is selected", async () => {
    const mockClient = {
      from: vi.fn((table: string) => {
        if (table === "value_cases") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: { id: CASE_ID, domain_pack_id: null },
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }
        if (table === "kpi_hypotheses") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          };
        }
        if (table === "assumptions") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          };
        }
        return { select: vi.fn().mockReturnThis() };
      }),
    };

    const service = new DomainPackService(mockClient as any);
    const result = await service.getMergedContext(CASE_ID, TENANT_ID);

    expect(result.pack).toBeNull();
    expect(result.kpis).toHaveLength(0);

    // Should still have base system assumptions
    expect(result.assumptions.length).toBeGreaterThan(0);
    const discountRate = result.assumptions.find(a => a.assumption_key === "discount_rate");
    expect(discountRate).toBeDefined();
    expect(discountRate!.value).toBe(10); // base system default
    expect(discountRate!.origin).toBe("system");
    expect(discountRate!.hardened).toBe(false);
  });
});
