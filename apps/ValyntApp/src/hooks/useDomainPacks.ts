/**
 * Domain Pack hooks for React Query.
 *
 * Provides hooks for listing packs, getting merged context,
 * setting a pack on a case, and hardening KPIs.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiClient } from "@/api/client/unified-api-client";
import { logger } from "@/lib/logger";

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

// fetchJSON removed — use apiClient (Phase 8 / ADR-0014)

export class DomainPackApiError extends Error {}

// ============================================================================
// Hooks
// ============================================================================

/** List all available domain packs for the current tenant. */
export function useDomainPacks() {
  return useQuery({
    queryKey: ["domain-packs"],
    queryFn: async () => {
      try {
        const res = await apiClient.get<{ packs: DomainPack[] }>(API_BASE);
        if (res.success) return res.data?.packs ?? [];
        throw new DomainPackApiError(res.error?.message ?? "Domain pack listing failed");
      } catch (err) {
        logger.error("Failed to fetch domain packs:", { error: err });
        throw new DomainPackApiError("Domain packs are unavailable. Check backend orchestration and API health.");
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
      if (caseId === "new") {
        throw new DomainPackApiError(
          "Merged domain-pack context is unavailable for unsaved cases. Create the case before requesting pack context."
        );
      }

      try {
        const res = await apiClient.get<MergedContext>(`${API_BASE}/value-cases/${caseId}/merged-context`);
        if (res.success) return res.data as MergedContext;
        throw new DomainPackApiError(res.error?.message ?? "Merged context request failed");
      } catch (err) {
        logger.error("Failed to fetch merged context:", { error: err });
        if (err instanceof DomainPackApiError) {
          throw err;
        }
        throw new DomainPackApiError("Merged domain-pack context is unavailable. Check backend orchestration.");
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
      apiClient.post(`${API_BASE}/value-cases/${caseId}/set-pack`, { packId }),
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
      apiClient.post(`${API_BASE}/value-cases/${caseId}/harden-kpi`, { kpiKey, baselineValue, targetValue }),
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
      apiClient.post<{ hardenedCount: number }>(`${API_BASE}/value-cases/${caseId}/harden-all-kpis`, {}),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["merged-context", variables.caseId] });
    },
  });
}
