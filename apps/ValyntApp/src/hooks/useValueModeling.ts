/**
 * React Query hooks for Value Modeling operations.
 *
 * Covers: value hypotheses, assumption management, financial scenarios, sensitivity analysis.
 * Reference: openspec/changes/frontend-v1-surfaces/tasks.md §4.2
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/api/client/unified-api-client";
import { useTenant } from "@/contexts/TenantContext";

// ============================================================================
// Types
// ============================================================================

export type EvidenceTier = "tier1" | "tier2" | "tier3";
export type SourceType =
  | "customer-confirmed"
  | "CRM-derived"
  | "call-derived"
  | "note-derived"
  | "benchmark-derived"
  | "externally-researched"
  | "inferred"
  | "manually-overridden";

export interface Hypothesis {
  id: string;
  valueDriver: string;
  impactRange: {
    low: number;
    high: number;
  };
  evidenceTier: EvidenceTier;
  confidenceScore: number;
  status: "pending" | "accepted" | "rejected" | "modified";
  benchmarkReference?: {
    source: string;
    p25: number;
    p50: number;
    p75: number;
  };
}

export interface Assumption {
  id: string;
  name: string;
  value: number;
  unit: string;
  source: SourceType;
  confidenceScore: number;
  benchmarkReference?: string;
  unsupported: boolean;
  plausibility: "plausible" | "aggressive" | "weakly-supported";
  lastModified: string;
  modifiedBy?: string;
}

export interface Scenario {
  id: string;
  name: "conservative" | "base" | "upside";
  roi: number;
  npv: number;
  paybackMonths: number;
  evfDecomposition: {
    revenueUplift: number;
    costReduction: number;
    riskMitigation: number;
    efficiencyGain: number;
  };
  isBase: boolean;
}

export interface SensitivityItem {
  assumptionId: string;
  assumptionName: string;
  impactPositive: number;
  impactNegative: number;
  leverage: number;
}

export interface SensitivityAnalysis {
  caseId: string;
  tornadoData: SensitivityItem[];
  baseScenario: string;
}

export interface UpdateAssumptionInput {
  value: number;
  reason: string;
}

// ============================================================================
// Hypothesis Hooks
// ============================================================================

/**
 * Fetch value hypotheses for a case.
 * GET /api/cases/:caseId/hypotheses
 */
export function useHypotheses(caseId: string | undefined) {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;

  return useQuery<Hypothesis[]>({
    queryKey: ["hypotheses", caseId, tenantId],
    queryFn: async () => {
      const response = await api.getHypotheses(caseId!);
      if (!response.success || !response.data) {
        throw new Error(response.error?.message || "Failed to fetch hypotheses");
      }
      return response.data as Hypothesis[];
    },
    enabled: !!caseId && !!tenantId,
    staleTime: 30_000,
  });
}

/**
 * Accept a value hypothesis.
 * POST /api/cases/:caseId/hypotheses/:hypothesisId/accept
 */
export function useAcceptHypothesis() {
  const queryClient = useQueryClient();
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;

  return useMutation({
    mutationFn: async ({ caseId, hypothesisId }: { caseId: string; hypothesisId: string }) => {
      const response = await api.acceptHypothesis(caseId, hypothesisId);
      if (!response.success) {
        throw new Error(response.error?.message || "Failed to accept hypothesis");
      }
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["hypotheses", variables.caseId, tenantId] });
      // Also invalidate scenarios and sensitivity as they depend on hypotheses
      queryClient.invalidateQueries({ queryKey: ["scenarios", variables.caseId, tenantId] });
      queryClient.invalidateQueries({ queryKey: ["sensitivity", variables.caseId, tenantId] });
    },
  });
}

/**
 * Reject a value hypothesis.
 * POST /api/cases/:caseId/hypotheses/:hypothesisId/reject
 */
export function useRejectHypothesis() {
  const queryClient = useQueryClient();
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;

  return useMutation({
    mutationFn: async ({ caseId, hypothesisId }: { caseId: string; hypothesisId: string }) => {
      const response = await api.rejectHypothesis(caseId, hypothesisId);
      if (!response.success) {
        throw new Error(response.error?.message || "Failed to reject hypothesis");
      }
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["hypotheses", variables.caseId, tenantId] });
    },
  });
}

// ============================================================================
// Assumption Hooks
// ============================================================================

/**
 * Fetch assumptions for a case.
 * GET /api/cases/:caseId/assumptions
 */
export function useAssumptions(caseId: string | undefined) {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;

  return useQuery<Assumption[]>({
    queryKey: ["assumptions", caseId, tenantId],
    queryFn: async () => {
      const response = await api.getAssumptions(caseId!);
      if (!response.success || !response.data) {
        throw new Error(response.error?.message || "Failed to fetch assumptions");
      }
      return response.data as Assumption[];
    },
    enabled: !!caseId && !!tenantId,
    staleTime: 30_000,
  });
}

/**
 * Update an assumption with optimistic update.
 * PATCH /api/cases/:caseId/assumptions/:assumptionId
 */
export function useUpdateAssumption() {
  const queryClient = useQueryClient();
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;

  return useMutation({
    mutationFn: async ({
      caseId,
      assumptionId,
      input,
    }: {
      caseId: string;
      assumptionId: string;
      input: UpdateAssumptionInput;
    }) => {
      const response = await api.updateAssumption(caseId, assumptionId, input);
      if (!response.success) {
        throw new Error(response.error?.message || "Failed to update assumption");
      }
      return response.data;
    },
    onMutate: async (variables) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["assumptions", variables.caseId, tenantId] });

      // Snapshot previous value
      const previousAssumptions = queryClient.getQueryData<Assumption[]>([
        "assumptions",
        variables.caseId,
        tenantId,
      ]);

      // Optimistically update
      if (previousAssumptions) {
        queryClient.setQueryData<Assumption[]>(
          ["assumptions", variables.caseId, tenantId],
          previousAssumptions.map((a) =>
            a.id === variables.assumptionId
              ? {
                  ...a,
                  value: variables.input.value,
                  source: "manually-overridden" as SourceType,
                  lastModified: new Date().toISOString(),
                }
              : a
          )
        );
      }

      return { previousAssumptions };
    },
    onError: (err, variables, context) => {
      // Rollback on error
      if (context?.previousAssumptions) {
        queryClient.setQueryData(
          ["assumptions", variables.caseId, tenantId],
          context.previousAssumptions
        );
      }
    },
    onSettled: (data, error, variables) => {
      // Always refetch after error or success
      queryClient.invalidateQueries({ queryKey: ["assumptions", variables.caseId, tenantId] });
      // Invalidate dependent data
      queryClient.invalidateQueries({ queryKey: ["scenarios", variables.caseId, tenantId] });
      queryClient.invalidateQueries({ queryKey: ["sensitivity", variables.caseId, tenantId] });
    },
  });
}

// ============================================================================
// Scenario & Sensitivity Hooks
// ============================================================================

/**
 * Fetch financial scenarios for a case.
 * GET /api/cases/:caseId/scenarios
 */
export function useScenarios(caseId: string | undefined) {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;

  return useQuery<Scenario[]>({
    queryKey: ["scenarios", caseId, tenantId],
    queryFn: async () => {
      const response = await api.getScenarios(caseId!);
      if (!response.success || !response.data) {
        throw new Error(response.error?.message || "Failed to fetch scenarios");
      }
      return response.data as Scenario[];
    },
    enabled: !!caseId && !!tenantId,
    staleTime: 30_000,
  });
}

/**
 * Fetch sensitivity analysis for a case.
 * GET /api/cases/:caseId/sensitivity
 */
export function useSensitivity(caseId: string | undefined) {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;

  return useQuery<SensitivityAnalysis>({
    queryKey: ["sensitivity", caseId, tenantId],
    queryFn: async () => {
      const response = await api.getSensitivity(caseId!);
      if (!response.success || !response.data) {
        throw new Error(response.error?.message || "Failed to fetch sensitivity analysis");
      }
      return response.data as SensitivityAnalysis;
    },
    enabled: !!caseId && !!tenantId,
    staleTime: 30_000,
  });
}
