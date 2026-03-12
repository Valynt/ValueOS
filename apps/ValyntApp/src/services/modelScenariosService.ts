import { apiClient } from "@/api/client/unified-api-client";

export interface ModelScenario {
  id: string;
  name: string;
  description?: string;
  assumptions: Array<{ key: string; value: number; unit?: string }>;
  roiPercent: number;
  paybackMonths: number;
  annualSavings: number;
  updatedAt: string;
}

export interface ModelScenariosResponse {
  scenarios: ModelScenario[];
}

export interface UpsertModelScenarioInput {
  name: string;
  description?: string;
  assumptions: Array<{ key: string; value: number; unit?: string }>;
}

export async function fetchModelScenarios(modelId: string): Promise<ModelScenario[]> {
  const response = await apiClient.get<ModelScenariosResponse>(`/api/value-models/${modelId}/scenarios`);
  if (!response.success || !response.data) {
    throw new Error(response.error?.message ?? "Unable to load model scenarios");
  }

  return response.data.scenarios;
}

export async function createModelScenario(modelId: string, payload: UpsertModelScenarioInput): Promise<void> {
  const response = await apiClient.post(`/api/value-models/${modelId}/scenarios`, payload);
  if (!response.success) {
    throw new Error(response.error?.message ?? "Unable to create scenario");
  }
}
