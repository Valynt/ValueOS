/**
 * Domain Pack hooks for React Query.
 *
 * Provides hooks for listing packs, getting merged context,
 * setting a pack on a case, and hardening KPIs.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

// ============================================================================
// Types (mirrored from backend)
// ============================================================================

export interface DomainPack {
  id: string;
  tenant_id: string | null;
  name: string;
  slug: string;
  industry: string;
  description: string | null;
  version: string;
  status: "active" | "draft" | "archived";
  glossary: Record<string, string>;
}

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
  hardened: boolean;
}

export interface MergedContext {
  pack: DomainPack | null;
  kpis: MergedKPI[];
  assumptions: MergedAssumption[];
}

// ============================================================================
// API helpers
// ============================================================================

const API_BASE = "/api/v1/domain-packs";

async function fetchJSON<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as Record<string, string>).error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

// ============================================================================
// Demo fallback data — used when the backend API is unavailable
// ============================================================================

const DEMO_PACKS: DomainPack[] = [
  {
    id: "demo-pack-banking",
    tenant_id: null,
    name: "Banking & Financial Services",
    slug: "banking",
    industry: "Banking",
    description: "KPI overlay for regulated financial institutions",
    version: "1.0.0",
    status: "active",
    glossary: { revenue_uplift: "Net Interest Margin Expansion", cost_reduction: "Core System Modernization Savings" },
  },
  {
    id: "demo-pack-saas",
    tenant_id: null,
    name: "SaaS / HiTech",
    slug: "saas",
    industry: "SaaS",
    description: "KPI overlay for SaaS and high-tech software companies",
    version: "1.0.0",
    status: "active",
    glossary: { revenue_uplift: "ARR Expansion", cost_reduction: "OpEx Optimization" },
  },
];

const DEMO_BANKING_CONTEXT: MergedContext = {
  pack: DEMO_PACKS[0],
  kpis: [
    { kpi_key: "core_modernization_savings", name: "Core System Modernization Savings", description: "Annual cost reduction from replacing legacy core banking systems", unit: "USD", direction: "up", category: "Cost", baseline_value: null, target_value: null, baseline_hint: "Typical legacy maintenance: $15M–$50M/year", target_hint: "Target: 30–50% reduction in first 3 years", origin: "domain_pack", hardened: false },
    { kpi_key: "regulatory_reporting_cost", name: "Regulatory Reporting Cost Impact", description: "Change in cost of producing regulatory reports (Basel, CCAR, DFAST)", unit: "USD", direction: "down", category: "Compliance", baseline_value: null, target_value: null, baseline_hint: "Typical: $5M–$20M annually", target_hint: "Automation target: 40–60% reduction", origin: "domain_pack", hardened: false },
    { kpi_key: "basel_capital_efficiency", name: "Basel III Capital Efficiency Delta", description: "Improvement in risk-weighted asset calculations reducing capital reserve requirements", unit: "bps", direction: "up", category: "Revenue", baseline_value: null, target_value: null, baseline_hint: "Current RWA ratio: typically 10–14%", target_hint: "Target: 20–50 bps improvement", origin: "domain_pack", hardened: false },
    { kpi_key: "fraud_exposure_reduction", name: "Fraud Exposure Reduction", description: "Reduction in annual fraud losses through improved detection and prevention", unit: "USD", direction: "up", category: "Risk", baseline_value: null, target_value: null, baseline_hint: "Typical fraud losses: 0.1–0.3% of transaction volume", target_hint: "Target: 30–50% reduction in false negatives", origin: "domain_pack", hardened: false },
    { kpi_key: "audit_automation_savings", name: "Audit Automation Savings", description: "Cost reduction from automating internal and external audit preparation", unit: "USD", direction: "up", category: "Efficiency", baseline_value: null, target_value: null, baseline_hint: "Typical audit prep: 2,000–5,000 person-hours/year", target_hint: "Automation target: 50–70% reduction", origin: "domain_pack", hardened: false },
    { kpi_key: "stp_rate", name: "Straight-Through Processing Rate", description: "Percentage of transactions processed without manual intervention", unit: "%", direction: "up", category: "Efficiency", baseline_value: null, target_value: null, baseline_hint: "Typical: 70–85%", target_hint: "Best-in-class: >95%", origin: "domain_pack", hardened: false },
  ],
  assumptions: [
    { assumption_key: "discount_rate", display_name: "Discount Rate", description: "WACC — higher for regulated financial institutions", value: 12, value_type: "number", unit: "%", category: "Financial", origin: "domain_pack", hardened: false },
    { assumption_key: "risk_premium", display_name: "Risk Premium", description: "Additional risk adjustment for regulatory and operational risk", value: 4, value_type: "number", unit: "%", category: "Risk", origin: "domain_pack", hardened: false },
    { assumption_key: "payback_tolerance_months", display_name: "Payback Tolerance", description: "Maximum acceptable payback period — longer for banking due to regulatory cycles", value: 21, value_type: "number", unit: "months", category: "Financial", origin: "domain_pack", hardened: false },
    { assumption_key: "compliance_cost_multiplier", display_name: "Compliance Cost Multiplier", description: "Multiplier for regulatory compliance overhead (SOX, Basel, PCI-DSS)", value: 1.35, value_type: "number", unit: "x", category: "Compliance", origin: "domain_pack", hardened: false },
  ],
};

const DEMO_SAAS_CONTEXT: MergedContext = {
  pack: DEMO_PACKS[1],
  kpis: [
    { kpi_key: "arr_expansion", name: "ARR Expansion", description: "Net new annual recurring revenue from upsell, cross-sell, and price increases", unit: "USD", direction: "up", category: "Revenue", baseline_value: null, target_value: null, baseline_hint: "Current ARR: typically $5M–$50M", target_hint: "Target: 120–140% net revenue retention", origin: "domain_pack", hardened: false },
    { kpi_key: "cac_payback", name: "CAC Payback Period", description: "Months to recover fully-loaded customer acquisition cost", unit: "months", direction: "down", category: "Efficiency", baseline_value: null, target_value: null, baseline_hint: "Typical: 12–18 months", target_hint: "Top quartile: <12 months", origin: "domain_pack", hardened: false },
    { kpi_key: "gross_churn_rate", name: "Gross Churn Rate", description: "Annual percentage of ARR lost to cancellations and downgrades", unit: "%", direction: "down", category: "Risk", baseline_value: null, target_value: null, baseline_hint: "Typical: 8–15% annually", target_hint: "Best-in-class: <5%", origin: "domain_pack", hardened: false },
    { kpi_key: "ndr", name: "Net Dollar Retention", description: "Revenue retained from existing customers including expansion, net of churn", unit: "%", direction: "up", category: "Revenue", baseline_value: null, target_value: null, baseline_hint: "Typical: 100–110%", target_hint: "Top quartile: >120%", origin: "domain_pack", hardened: false },
    { kpi_key: "ltv_cac_ratio", name: "LTV:CAC Ratio", description: "Lifetime value divided by customer acquisition cost", unit: "ratio", direction: "up", category: "Efficiency", baseline_value: null, target_value: null, baseline_hint: "Typical: 3:1", target_hint: "Target: >5:1", origin: "domain_pack", hardened: false },
    { kpi_key: "rule_of_40", name: "Rule of 40 Score", description: "Revenue growth rate + profit margin — measures balanced growth", unit: "%", direction: "up", category: "Revenue", baseline_value: null, target_value: null, baseline_hint: "Typical: 20–35%", target_hint: "Elite: >40%", origin: "domain_pack", hardened: false },
  ],
  assumptions: [
    { assumption_key: "discount_rate", display_name: "Discount Rate", description: "Weighted average cost of capital for NPV calculations", value: 9, value_type: "number", unit: "%", category: "Financial", origin: "domain_pack", hardened: false },
    { assumption_key: "risk_premium", display_name: "Risk Premium", description: "Additional risk adjustment for SaaS revenue volatility", value: 2, value_type: "number", unit: "%", category: "Risk", origin: "domain_pack", hardened: false },
    { assumption_key: "payback_tolerance_months", display_name: "Payback Tolerance", description: "Maximum acceptable payback period for investment approval", value: 15, value_type: "number", unit: "months", category: "Financial", origin: "domain_pack", hardened: false },
    { assumption_key: "compliance_cost_multiplier", display_name: "Compliance Cost Multiplier", description: "Multiplier for regulatory compliance overhead", value: 1.05, value_type: "number", unit: "x", category: "Compliance", origin: "domain_pack", hardened: false },
  ],
};

// ============================================================================
// Hooks
// ============================================================================

/** List all available domain packs for the current tenant. */
export function useDomainPacks() {
  return useQuery({
    queryKey: ["domain-packs"],
    queryFn: async () => {
      try {
        return await fetchJSON<{ packs: DomainPack[] }>(API_BASE).then(r => r.packs);
      } catch {
        // Fallback to demo data when backend is unavailable
        return DEMO_PACKS;
      }
    },
    staleTime: 5 * 60 * 1000,
  });
}

/** Get the merged context (pack + case overrides + system fallbacks) for a case. */
export function useMergedContext(caseId: string | undefined) {
  return useQuery({
    queryKey: ["merged-context", caseId],
    queryFn: async () => {
      // For demo/new cases, return demo data directly
      if (caseId === "new") {
        const params = new URLSearchParams(window.location.search);
        const packId = params.get("packId");
        if (packId === "demo-pack-saas") return DEMO_SAAS_CONTEXT;
        return DEMO_BANKING_CONTEXT;
      }

      try {
        return await fetchJSON<MergedContext>(`${API_BASE}/value-cases/${caseId}/merged-context`);
      } catch {
        // Fallback to demo data when backend is unavailable
        const params = new URLSearchParams(window.location.search);
        const packId = params.get("packId");
        if (packId === "demo-pack-saas") return DEMO_SAAS_CONTEXT;
        return DEMO_BANKING_CONTEXT;
      }
    },
    enabled: !!caseId,
  });
}

/** Set the domain pack for a value case. */
export function useSetDomainPack() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ caseId, packId }: { caseId: string; packId: string }) =>
      fetchJSON(`${API_BASE}/value-cases/${caseId}/set-pack`, {
        method: "POST",
        body: JSON.stringify({ packId }),
      }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["merged-context", variables.caseId] });
    },
  });
}

/** Harden a single ghost KPI into the case. */
export function useHardenKPI() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      caseId,
      kpiKey,
      baselineValue,
      targetValue,
    }: {
      caseId: string;
      kpiKey: string;
      baselineValue?: number;
      targetValue?: number;
    }) =>
      fetchJSON(`${API_BASE}/value-cases/${caseId}/harden-kpi`, {
        method: "POST",
        body: JSON.stringify({ kpiKey, baselineValue, targetValue }),
      }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["merged-context", variables.caseId] });
    },
  });
}

/** Bulk-harden all ghost KPIs from the domain pack. */
export function useHardenAllKPIs() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ caseId }: { caseId: string }) =>
      fetchJSON<{ hardenedCount: number }>(`${API_BASE}/value-cases/${caseId}/harden-all-kpis`, {
        method: "POST",
      }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["merged-context", variables.caseId] });
    },
  });
}
