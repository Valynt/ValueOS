import { apiClient } from "./client/unified-api-client";

export interface ClientCapabilitiesResponse {
  llm: {
    togetherConfigured: boolean;
  };
}

export async function getClientCapabilities(): Promise<ClientCapabilitiesResponse> {
  const response = await apiClient.get<ClientCapabilitiesResponse>("/runtime/client-capabilities");

  if (!response.success || !response.data) {
    throw new Error(response.error?.message || "Failed to load runtime client capabilities");
  }

  return response.data;
}
