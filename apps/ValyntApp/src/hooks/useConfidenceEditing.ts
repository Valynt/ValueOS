/**
 * React Query hooks for inline confidence score editing.
 *
 * Covers: artifact, hypothesis, and assumption confidence updates.
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { api } from "@/api/client/unified-api-client";
import { useTenant } from "@/contexts/TenantContext";

// ============================================================================
// Types
// ============================================================================

export interface UpdateConfidenceInput {
  confidenceScore: number;
  reason?: string;
  evidenceReference?: string;
}

export interface ConfidenceUpdateResult {
  id: string;
  previousScore: number;
  newScore: number;
  updatedAt: string;
  updatedBy: string;
  reason?: string;
}

// ============================================================================
// Confidence Update Hooks
// ============================================================================

/**
 * Update hypothesis confidence score
 */
export function useUpdateHypothesisConfidence() {
  const queryClient = useQueryClient();
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;

  return useMutation({
    mutationFn: async ({
      caseId,
      hypothesisId,
      input,
    }: {
      caseId: string;
      hypothesisId: string;
      input: UpdateConfidenceInput;
    }) => {
      const response = await api.updateHypothesisConfidence(caseId, hypothesisId, input);
      if (!response.success) {
        throw new Error(response.error?.message || "Failed to update confidence");
      }
      return response.data as ConfidenceUpdateResult;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["hypotheses", variables.caseId, tenantId] });
      queryClient.invalidateQueries({ queryKey: ["journey", variables.caseId, tenantId] });
    },
  });
}

/**
 * Update assumption confidence score
 */
export function useUpdateAssumptionConfidence() {
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
      input: UpdateConfidenceInput;
    }) => {
      const response = await api.updateAssumptionConfidence(caseId, assumptionId, input);
      if (!response.success) {
        throw new Error(response.error?.message || "Failed to update confidence");
      }
      return response.data as ConfidenceUpdateResult;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["assumptions", variables.caseId, tenantId] });
      queryClient.invalidateQueries({ queryKey: ["scenarios", variables.caseId, tenantId] });
      queryClient.invalidateQueries({ queryKey: ["sensitivity", variables.caseId, tenantId] });
      queryClient.invalidateQueries({ queryKey: ["journey", variables.caseId, tenantId] });
    },
  });
}

/**
 * Update artifact confidence score
 */
export function useUpdateArtifactConfidence() {
  const queryClient = useQueryClient();
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;

  return useMutation({
    mutationFn: async ({
      caseId,
      artifactId,
      input,
    }: {
      caseId: string;
      artifactId: string;
      input: UpdateConfidenceInput;
    }) => {
      const response = await api.updateArtifactConfidence(caseId, artifactId, input);
      if (!response.success) {
        throw new Error(response.error?.message || "Failed to update confidence");
      }
      return response.data as ConfidenceUpdateResult;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["artifacts", variables.caseId, tenantId] });
      queryClient.invalidateQueries({ queryKey: ["journey", variables.caseId, tenantId] });
    },
  });
}
