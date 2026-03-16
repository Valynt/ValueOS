/**
 * useTenantContext
 *
 * Reads and writes tenant company context via POST/GET /api/v1/tenant/context.
 * The backend stores context as semantic memory entries used by agents.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiClient } from "@/api/client/unified-api-client";

export interface TenantContextPayload {
  websiteUrl?: string;
  productDescription: string;
  icpDefinition: string;
  competitorList: string[];
}

export interface TenantContextSummary {
  organizationId: string;
  entryCount: number;
  labels: string[];
  lastIngestedAt: string | null;
}

export interface IngestResult {
  stored: true;
  memoryEntries: number;
}

const QUERY_KEY = "tenant-context-summary";

export function useTenantContextSummary() {
  return useQuery<TenantContextSummary | null>({
    queryKey: [QUERY_KEY],
    queryFn: async () => {
      const res = await apiClient.get<{ data: TenantContextSummary | null }>("/api/v1/tenant/context");
      if (!res.success) {
        throw new Error(res.error?.message ?? "Failed to fetch tenant context");
      }
      return res.data?.data ?? null;
    },
    staleTime: 60_000,
  });
}

export function useIngestTenantContext() {
  const queryClient = useQueryClient();

  return useMutation<IngestResult, Error, TenantContextPayload>({
    mutationFn: async (payload) => {
      const res = await apiClient.post<IngestResult>("/api/v1/tenant/context", payload);
      if (!res.success || !res.data) {
        throw new Error(res.error?.message ?? "Ingestion failed");
      }
      return res.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
    },
  });
}
