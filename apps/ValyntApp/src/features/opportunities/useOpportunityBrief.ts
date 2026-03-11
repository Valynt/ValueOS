/**
 * useOpportunityBrief
 *
 * Aggregates value case and hypothesis data for the OpportunityValueBrief
 * surface. Uses the existing /api/v1/cases endpoints — the "opportunity"
 * concept maps to a value case in the current persistence model.
 *
 * All queries are tenant-scoped via the backend's tenantContextMiddleware.
 */

import { useQuery } from "@tanstack/react-query";

import { useTenant } from "@/contexts/TenantContext";
import { supabase } from "@/lib/supabase";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BriefAccount {
  name: string;
  industry?: string;
  employee_count?: number;
  arr_usd?: number;
}

export interface BriefOpportunity {
  id: string;
  name: string;
  lifecycle_stage: string;
  status: string;
  close_date?: string | null;
  created_at: string;
  company?: string;
}

export interface BriefHypothesis {
  id: string;
  description: string;
  category: string;
  confidence: "high" | "medium" | "low";
  status: string;
  estimated_value?: {
    low: number;
    high: number;
    unit: string;
    timeframe_months: number;
  } | null;
}

export interface OpportunityBrief {
  account: BriefAccount;
  opportunity: BriefOpportunity;
  hypotheses: BriefHypothesis[];
  totalValueLow: number;
  totalValueHigh: number;
  confidenceSummary: { high: number; medium: number; low: number };
}

// ---------------------------------------------------------------------------
// Raw API shapes
// ---------------------------------------------------------------------------

interface RawValueCase {
  id: string;
  name: string;
  stage?: string | null;
  status?: string | null;
  metadata?: Record<string, unknown> | null;
  created_at: string;
  company_profile?: { company_name?: string } | null;
}

interface RawHypothesisOutput {
  hypotheses?: Array<{
    title?: string;
    description?: string;
    category?: string;
    confidence?: number | string;
    status?: string;
    estimated_impact?: {
      low?: number;
      high?: number;
      unit?: string;
      timeframe_months?: number;
    };
  }>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function getAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (supabase) {
    const { data } = await supabase.auth.getSession();
    if (data.session?.access_token) {
      headers["Authorization"] = `Bearer ${data.session.access_token}`;
    }
  }
  return headers;
}

// Raw fetch retained: apiClient.setAuthToken is not yet wired to the Supabase
// session in app bootstrap, so auth must be attached manually here (see debt.md).
async function fetchJSON<T>(url: string): Promise<T> {
  const headers = await getAuthHeaders();
  const res = await fetch(url, { headers, credentials: "include" });
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as Record<string, string>;
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

function normaliseConfidence(raw: number | string | undefined): BriefHypothesis["confidence"] {
  if (raw === "high" || raw === "medium" || raw === "low") return raw;
  if (typeof raw === "number") {
    if (raw >= 0.75) return "high";
    if (raw >= 0.5) return "medium";
    return "low";
  }
  return "medium";
}

async function fetchOpportunityBrief(caseId: string): Promise<OpportunityBrief> {
  const [caseRes, hypoRes] = await Promise.allSettled([
    fetchJSON<{ data: RawValueCase }>(`/api/v1/cases/${caseId}`),
    fetchJSON<{ data: RawHypothesisOutput | null }>(`/api/v1/cases/${caseId}/hypothesis`),
  ]);

  if (caseRes.status === "rejected") throw caseRes.reason as Error;

  const rawCase = caseRes.value.data;
  const rawHypo = hypoRes.status === "fulfilled" ? hypoRes.value.data : null;

  const meta = rawCase.metadata ?? {};
  const account: BriefAccount = {
    name:
      rawCase.company_profile?.company_name ??
      (meta["company_name"] as string | undefined) ??
      rawCase.name,
    industry: meta["industry"] as string | undefined,
    employee_count: meta["employee_count"] as number | undefined,
    arr_usd: meta["arr_usd"] as number | undefined,
  };

  const opportunity: BriefOpportunity = {
    id: rawCase.id,
    name: rawCase.name,
    lifecycle_stage: rawCase.stage ?? "discovery",
    status: rawCase.status ?? "draft",
    close_date: (meta["close_date"] as string | undefined) ?? null,
    created_at: rawCase.created_at,
    company: account.name,
  };

  const hypotheses: BriefHypothesis[] = (rawHypo?.hypotheses ?? []).map((h, i) => ({
    id: `${caseId}-hyp-${i}`,
    description: h.description ?? h.title ?? "Untitled hypothesis",
    category: h.category ?? "general",
    confidence: normaliseConfidence(h.confidence),
    status: h.status ?? "proposed",
    estimated_value: h.estimated_impact
      ? {
          low: h.estimated_impact.low ?? 0,
          high: h.estimated_impact.high ?? 0,
          unit: h.estimated_impact.unit ?? "usd",
          timeframe_months: h.estimated_impact.timeframe_months ?? 12,
        }
      : null,
  }));

  let totalValueLow = 0;
  let totalValueHigh = 0;
  const confidenceSummary = { high: 0, medium: 0, low: 0 };

  for (const h of hypotheses) {
    if (h.estimated_value?.unit === "usd") {
      totalValueLow += h.estimated_value.low;
      totalValueHigh += h.estimated_value.high;
    }
    confidenceSummary[h.confidence]++;
  }

  return { account, opportunity, hypotheses, totalValueLow, totalValueHigh, confidenceSummary };
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useOpportunityBrief(caseId: string | undefined) {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;

  return useQuery<OpportunityBrief>({
    queryKey: ["opportunity-brief", caseId, tenantId],
    queryFn: () => fetchOpportunityBrief(caseId!),
    enabled: !!caseId && !!tenantId,
    staleTime: 30_000,
    retry: (failureCount, error) => {
      if (error instanceof Error && error.message.includes("HTTP 404")) return false;
      return failureCount < 2;
    },
  });
}
