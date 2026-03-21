/**
 * useValueGraph
 *
 * Fetches the Value Graph (nodes + edges) and all traversable value paths for
 * an opportunity. Data is pre-sorted by path_confidence descending.
 *
 * Tenant context is injected automatically by the UnifiedApiClient auth
 * interceptor — no manual header wiring needed here.
 *
 * Sprint 50: Initial implementation.
 */

import { useQuery } from "@tanstack/react-query";

import { useTenant } from "@/contexts/TenantContext";
import { fetchValueGraph } from "@/api/valueGraph";
import type { ValueGraphResponse } from "@/api/valueGraph";

export type { ValueGraphResponse };

/**
 * Fetch the Value Graph and value paths for an opportunity.
 *
 * @param opportunityId - UUID of the opportunity. Pass undefined/null to
 *   disable the query (e.g. while the parent is still loading route params).
 */
export function useValueGraph(opportunityId: string | undefined | null) {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;

  return useQuery<ValueGraphResponse, Error>({
    queryKey: ["value-graph", opportunityId, tenantId],
    queryFn: () => {
      if (!opportunityId) throw new Error("opportunityId is required");
      return fetchValueGraph(opportunityId);
    },
    enabled: !!opportunityId && !!tenantId,
    staleTime: 30_000, // 30 s — graph data changes only when agents write
    retry: 2,
  });
}
