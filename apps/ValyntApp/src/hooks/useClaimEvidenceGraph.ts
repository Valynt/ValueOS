import { useQuery } from "@tanstack/react-query";

import {
  fetchClaimCentricView,
  fetchConfidenceDriftView,
  fetchEvidenceCentricView,
  type ClaimCentricViewResponse,
  type ConfidenceDriftViewResponse,
  type EvidenceCentricViewResponse,
} from "@/api/valueGraph";
import { useTenant } from "@/contexts/TenantContext";

export interface ClaimEvidenceGraphData {
  claimCentric: ClaimCentricViewResponse;
  evidenceCentric: EvidenceCentricViewResponse;
  confidenceDrift: ConfidenceDriftViewResponse;
}

export function useClaimEvidenceGraph(opportunityId: string | undefined | null) {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;

  return useQuery<ClaimEvidenceGraphData, Error>({
    queryKey: ["claim-evidence-graph", opportunityId, tenantId],
    queryFn: async () => {
      if (!opportunityId) throw new Error("opportunityId is required");
      const [claimCentric, evidenceCentric, confidenceDrift] = await Promise.all([
        fetchClaimCentricView(opportunityId),
        fetchEvidenceCentricView(opportunityId),
        fetchConfidenceDriftView(opportunityId),
      ]);

      return {
        claimCentric,
        evidenceCentric,
        confidenceDrift,
      };
    },
    enabled: !!opportunityId && !!tenantId,
    staleTime: 15_000,
  });
}
