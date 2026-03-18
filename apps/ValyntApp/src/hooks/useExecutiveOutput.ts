/**
 * React Query hooks for Executive Output operations.
 *
 * Covers: artifact generation, inline editing, provenance tracing.
 * Reference: openspec/changes/frontend-v1-surfaces/tasks.md §4.4
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/api/client/unified-api-client";
import { useTenant } from "@/contexts/TenantContext";

// ============================================================================
// Types
// ============================================================================

export type ArtifactType = "executive-memo" | "cfo-recommendation" | "customer-narrative" | "internal-case";
export type ArtifactStatus = "draft" | "ready" | "archived";

export interface Artifact {
  id: string;
  type: ArtifactType;
  status: ArtifactStatus;
  title: string;
  content: string;
  claimIds: string[];
  generatedAt: string;
  modifiedAt?: string;
  modifiedBy?: string;
  readinessAtGeneration: number;
}

export interface ProvenanceNode {
  id: string;
  type: "source" | "formula" | "agent" | "confidence" | "evidence";
  label: string;
  value: string | number;
  sourceBadge?: string;
  timestamp?: string;
  children?: ProvenanceNode[];
}

export interface ProvenanceChain {
  claimId: string;
  claimValue: string | number;
  nodes: ProvenanceNode[];
}

export interface EditArtifactInput {
  content: string;
  reason: string;
  sectionId?: string;
}

// ============================================================================
// Artifact Hooks
// ============================================================================

/**
 * Fetch all artifacts for a case.
 * GET /api/cases/:caseId/artifacts
 */
export function useArtifacts(caseId: string | undefined) {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;

  return useQuery<Artifact[]>({
    queryKey: ["artifacts", caseId, tenantId],
    queryFn: async () => {
      const response = await api.getArtifacts(caseId!);
      if (!response.success || !response.data) {
        throw new Error(response.error?.message || "Failed to fetch artifacts");
      }
      return response.data as Artifact[];
    },
    enabled: !!caseId && !!tenantId,
    staleTime: 30_000,
  });
}

/**
 * Fetch a single artifact by ID.
 * GET /api/cases/:caseId/artifacts/:artifactId
 */
export function useArtifact(caseId: string | undefined, artifactId: string | undefined) {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;

  return useQuery<Artifact>({
    queryKey: ["artifact", caseId, artifactId, tenantId],
    queryFn: async () => {
      const response = await api.getArtifact(caseId!, artifactId!);
      if (!response.success || !response.data) {
        throw new Error(response.error?.message || "Failed to fetch artifact");
      }
      return response.data as Artifact;
    },
    enabled: !!caseId && !!artifactId && !!tenantId,
    staleTime: 30_000,
  });
}

/**
 * Edit an artifact with audit trail.
 * PATCH /api/cases/:caseId/artifacts/:artifactId
 */
export function useEditArtifact() {
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
      input: EditArtifactInput;
    }) => {
      const response = await api.editArtifact(caseId, artifactId, input);
      if (!response.success) {
        throw new Error(response.error?.message || "Failed to edit artifact");
      }
      return response.data;
    },
    onSuccess: (_, variables) => {
      // Invalidate specific artifact and artifacts list
      queryClient.invalidateQueries({
        queryKey: ["artifact", variables.caseId, variables.artifactId, tenantId],
      });
      queryClient.invalidateQueries({ queryKey: ["artifacts", variables.caseId, tenantId] });
    },
  });
}

/**
 * Generate artifacts for a case.
 * POST /api/cases/:caseId/artifacts/generate
 */
export function useGenerateArtifacts(caseId: string | undefined) {
  const queryClient = useQueryClient();
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;

  return useMutation({
    mutationFn: async () => {
      const response = await api.generateArtifacts(caseId!);
      if (!response.success) {
        throw new Error(response.error?.message || "Failed to generate artifacts");
      }
      return response.data;
    },
    onSuccess: () => {
      // Invalidate artifacts list
      queryClient.invalidateQueries({ queryKey: ["artifacts", caseId, tenantId] });
    },
  });
}

// ============================================================================
// Provenance Hooks
// ============================================================================

/**
 * Fetch provenance chain for a claim.
 * GET /api/cases/:caseId/provenance/:claimId
 */
export function useProvenance(caseId: string | undefined, claimId: string | undefined) {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;

  return useQuery<ProvenanceChain>({
    queryKey: ["provenance", caseId, claimId, tenantId],
    queryFn: async () => {
      const response = await api.getProvenance(caseId!, claimId!);
      if (!response.success || !response.data) {
        throw new Error(response.error?.message || "Failed to fetch provenance");
      }
      return response.data as ProvenanceChain;
    },
    enabled: !!caseId && !!claimId && !!tenantId,
    staleTime: 60_000, // Provenance rarely changes
  });
}
