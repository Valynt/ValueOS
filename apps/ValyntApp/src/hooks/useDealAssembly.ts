/**
 * React Query hooks for Deal Assembly operations.
 *
 * Covers: opportunity ingestion, context extraction, gap resolution, and assembly triggering.
 * Reference: openspec/changes/frontend-v1-surfaces/tasks.md §4.1
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/api/client/unified-api-client";
import { useTenant } from "@/contexts/TenantContext";

// ============================================================================
// Types
// ============================================================================

export interface Stakeholder {
  id: string;
  name: string;
  role: string;
  priority: "high" | "medium" | "low";
  source: "CRM-derived" | "call-derived" | "inferred";
}

export interface UseCase {
  id: string;
  name: string;
  description: string;
  valueDrivers: string[];
}

export interface GapItem {
  id: string;
  field: string;
  description: string;
  required: boolean;
  resolved: boolean;
  value?: string | number | boolean;
}

export interface DealContext {
  caseId: string;
  accountName: string;
  industry: string;
  companySize: string;
  stakeholders: Stakeholder[];
  useCases: UseCase[];
  gaps: GapItem[];
  baselineClues: Record<string, unknown>;
  assemblyStatus: "pending" | "assembling" | "review" | "confirmed";
  sources: Array<{
    type: string;
    id: string;
    timestamp: string;
  }>;
}

export interface GapFillInput {
  gapId: string;
  value: string | number | boolean;
}

// ============================================================================
// Query Hooks
// ============================================================================

/**
 * Fetch deal context for a case.
 * GET /api/cases/:caseId/context
 */
export function useDealContext(caseId: string | undefined) {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;

  return useQuery<DealContext>({
    queryKey: ["dealContext", caseId, tenantId],
    queryFn: async () => {
      const response = await api.getDealContext(caseId!);
      if (!response.success || !response.data) {
        throw new Error(response.error?.message || "Failed to fetch deal context");
      }
      return response.data as DealContext;
    },
    enabled: !!caseId && !!tenantId,
    staleTime: 30_000,
  });
}

// ============================================================================
// Mutation Hooks
// ============================================================================

/**
 * Submit gap fill data.
 * PATCH /api/cases/:caseId/context/gaps
 */
export function useSubmitGapFill(caseId: string | undefined) {
  const queryClient = useQueryClient();
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;

  return useMutation({
    mutationFn: async (input: GapFillInput) => {
      const response = await api.submitGapFill(caseId!, input);
      if (!response.success) {
        throw new Error(response.error?.message || "Failed to submit gap fill");
      }
      return response.data;
    },
    onSuccess: () => {
      // Invalidate deal context to refetch with resolved gaps
      queryClient.invalidateQueries({ queryKey: ["dealContext", caseId, tenantId] });
    },
  });
}

/**
 * Trigger deal assembly.
 * POST /api/cases/:caseId/assemble
 */
export function useTriggerAssembly(caseId: string | undefined) {
  const queryClient = useQueryClient();
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;

  return useMutation({
    mutationFn: async () => {
      const response = await api.triggerAssembly(caseId!);
      if (!response.success) {
        throw new Error(response.error?.message || "Failed to trigger assembly");
      }
      return response.data;
    },
    onSuccess: () => {
      // Invalidate deal context to reflect new assembly status
      queryClient.invalidateQueries({ queryKey: ["dealContext", caseId, tenantId] });
    },
  });
}
