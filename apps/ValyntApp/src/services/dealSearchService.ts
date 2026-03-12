import { apiClient } from "@/api/client/unified-api-client";

export type CRMProvider = "salesforce" | "hubspot";

export interface CRMDealSearchItem {
  id: string;
  name: string;
  company: string;
  stage: "prospecting" | "qualification" | "proposal" | "negotiation" | "closed_won" | "closed_lost";
  amount?: number;
  closeDate?: string;
  crmId: string;
  crmSource: CRMProvider;
  owner?: string;
  lastActivity?: string;
}

export interface DealSearchResponse {
  deals: CRMDealSearchItem[];
  total: number;
  hasMore: boolean;
  page: number;
  pageSize: number;
}

export interface DealSearchParams {
  query?: string;
  page?: number;
  pageSize?: number;
  tenantId: string;
  valueCaseId: string;
  company?: string;
}

export async function searchCRMDeals(params: DealSearchParams): Promise<DealSearchResponse> {
  const response = await apiClient.get<DealSearchResponse>("/api/crm/deals/search", {
    q: params.query ?? "",
    page: params.page ?? 1,
    pageSize: params.pageSize ?? 10,
    tenantId: params.tenantId,
    valueCaseId: params.valueCaseId,
    company: params.company,
  });

  if (!response.success || !response.data) {
    throw new Error(response.error?.message ?? "Unable to search CRM deals");
  }

  return response.data;
}
