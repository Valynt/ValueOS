/**
 * useIntegrity
 *
 * Fetches the latest integrity result for a value case and provides
 * a mutation to invoke the IntegrityAgent.
 *
 * Also includes V1 surface hooks for readiness, evidence gaps, and plausibility.
 * Reference: openspec/changes/frontend-v1-surfaces/tasks.md §4.3
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, apiClient } from "@/api/client/unified-api-client";
import { useTenant } from "@/contexts/TenantContext";

// ---------------------------------------------------------------------------
// Legacy Types
// ---------------------------------------------------------------------------

export interface ClaimValidation {
  claim_id: string;
  claim_text: string;
  verdict: "supported" | "partially_supported" | "unsupported" | "insufficient_evidence";
  confidence: number;
  evidence_assessment: string;
  issues: Array<{ type: string; severity: string; description: string }>;
  suggested_fix?: string;
}

export interface IntegrityResult {
  id: string;
  organization_id: string;
  value_case_id: string;
  session_id: string | null;
  claims: ClaimValidation[];
  veto_decision: "pass" | "veto" | "re_refine" | null;
  overall_score: number | null;
  data_quality_score: number | null;
  logic_score: number | null;
  evidence_score: number | null;
  hallucination_check: boolean | null;
  source_agent: string;
  created_at: string;
  updated_at: string;
}

export interface AgentRunResponse {
  jobId: string;
  agentId: string;
  status: string;
  result?: Record<string, unknown>;
  confidence?: string;
  duration_ms?: number;
}

// ---------------------------------------------------------------------------
// V1 Surface Types
// ---------------------------------------------------------------------------

export interface ReadinessComponent {
  name: string;
  score: number;
  weight: number;
}

export interface ReadinessData {
  compositeScore: number;
  status: "presentation-ready" | "draft" | "blocked";
  blockers: string[];
  components: {
    validationRate: ReadinessComponent;
    grounding: ReadinessComponent;
    benchmarkCoverage: ReadinessComponent;
    unsupportedCount: ReadinessComponent;
  };
  confidenceDistribution: {
    high: number; // >= 0.8
    medium: number; // >= 0.5
    low: number; // < 0.5
  };
}

export interface EvidenceGap {
  id: string;
  claimId: string;
  field: string;
  currentTier: "tier1" | "tier2" | "tier3" | "none";
  requiredTier: "tier1" | "tier2" | "tier3";
  suggestedAction: string;
  impact: "high" | "medium" | "low";
}

export interface PlausibilityFlag {
  id: string;
  assumptionId: string;
  assumptionName: string;
  classification: "plausible" | "aggressive" | "weakly-supported";
  benchmarkRange: {
    p25: number;
    p50: number;
    p75: number;
    p90: number;
  };
  currentValue: number;
  rationale: string;
}

export interface PlausibilityData {
  flags: PlausibilityFlag[];
  benchmarkContext: {
    industry: string;
    companySize: string;
    sources: string[];
  };
}

// ---------------------------------------------------------------------------
// Legacy Hooks — Phase 8: use UnifiedApiClient (ADR-0014)
// ---------------------------------------------------------------------------

export function useIntegrityResult(caseId: string | undefined) {
  return useQuery<IntegrityResult | null>({
    queryKey: ["integrity", caseId],
    queryFn: async () => {
      const res = await apiClient.get<{ data: IntegrityResult }>(
        `/api/v1/cases/${caseId}/integrity`,
      );
      if (!res.success) throw new Error(res.error?.message ?? "Request failed");
      return res.data?.data ?? null;
    },
    enabled: !!caseId,
    staleTime: 30_000,
    retry: (failureCount, error) => {
      if (error instanceof Error && error.message.includes("404")) return false;
      return failureCount < 2;
    },
  });
}

export function useRunIntegrityAgent(caseId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation<AgentRunResponse, Error, Record<string, unknown> | undefined>({
    mutationFn: async (context) => {
      const res = await apiClient.post<{ data: AgentRunResponse }>(
        `/api/v1/cases/${caseId}/integrity/run`,
        { context: context ?? {} },
      );
      if (!res.success) throw new Error(res.error?.message ?? "Request failed");
      if (!res.data?.data) throw new Error("No data in response");
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["integrity", caseId] });
    },
  });
}

// ---------------------------------------------------------------------------
// V1 Surface Hooks — Readiness, Evidence Gaps, Plausibility
// ---------------------------------------------------------------------------

/**
 * Fetch defense readiness data for a case.
 * GET /api/cases/:caseId/readiness
 */
export function useReadiness(caseId: string | undefined) {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;

  return useQuery<ReadinessData>({
    queryKey: ["readiness", caseId, tenantId],
    queryFn: async () => {
      const response = await api.getReadiness(caseId!);
      if (!response.success || !response.data) {
        throw new Error(response.error?.message || "Failed to fetch readiness data");
      }
      return response.data as ReadinessData;
    },
    enabled: !!caseId && !!tenantId,
    staleTime: 30_000,
  });
}

/**
 * Derive evidence gaps from readiness data.
 * This is a derived query that filters and transforms readiness data.
 */
export function useEvidenceGaps(caseId: string | undefined) {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;
  const { data: readinessData, ...rest } = useReadiness(caseId);

  // Derive gaps from readiness components
  const gaps: EvidenceGap[] | undefined = readinessData
    ? [
        // Generate gaps based on readiness component scores
        ...(readinessData.components.validationRate.score < 0.8
          ? [
              {
                id: "gap-validation",
                claimId: "composite",
                field: "Assumption Validation",
                currentTier: "tier3" as const,
                requiredTier: "tier2" as const,
                suggestedAction: "Validate more assumptions with customer data or CRM sources",
                impact: "high" as const,
              },
            ]
          : []),
        ...(readinessData.components.grounding.score < 0.8
          ? [
              {
                id: "gap-grounding",
                claimId: "composite",
                field: "Evidence Grounding",
                currentTier: "tier3" as const,
                requiredTier: "tier2" as const,
                suggestedAction: "Attach supporting evidence to high-confidence claims",
                impact: "high" as const,
              },
            ]
          : []),
        ...(readinessData.components.benchmarkCoverage.score < 0.8
          ? [
              {
                id: "gap-benchmarks",
                claimId: "composite",
                field: "Benchmark Coverage",
                currentTier: "tier3" as const,
                requiredTier: "tier2" as const,
                suggestedAction: "Link assumptions to industry benchmarks",
                impact: "medium" as const,
              },
            ]
          : []),
        ...(readinessData.components.unsupportedCount.score < 0.8
          ? [
              {
                id: "gap-unsupported",
                claimId: "composite",
                field: "Unsupported Assumptions",
                currentTier: "tier3" as const,
                requiredTier: "tier1" as const,
                suggestedAction: "Provide evidence for unsupported assumptions",
                impact: "high" as const,
              },
            ]
          : []),
      ]
    : undefined;

  return {
    ...rest,
    data: gaps,
  };
}

/**
 * Fetch plausibility testing results for a case.
 * GET /api/cases/:caseId/plausibility
 */
export function usePlausibility(caseId: string | undefined) {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;

  return useQuery<PlausibilityData>({
    queryKey: ["plausibility", caseId, tenantId],
    queryFn: async () => {
      const response = await api.getPlausibility(caseId!);
      if (!response.success || !response.data) {
        throw new Error(response.error?.message || "Failed to fetch plausibility data");
      }
      return response.data as PlausibilityData;
    },
    enabled: !!caseId && !!tenantId,
    staleTime: 30_000,
  });
}

