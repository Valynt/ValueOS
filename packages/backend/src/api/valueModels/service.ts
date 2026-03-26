import type { StoredScenario, ValueModelScenariosRepository } from "./repository.js";

export interface ScenarioUpsertInput {
  tenantId: string;
  modelId: string;
  name: string;
  description?: string;
  assumptions: Array<{ key: string; value: number; unit?: string }>;
}

export class ValueModelScenariosService {
  constructor(private readonly repository: ValueModelScenariosRepository) {}

  async list(input: { tenantId: string; modelId: string }): Promise<StoredScenario[]> {
    return this.repository.listByModel(input.tenantId, input.modelId);
  }

  async create(input: ScenarioUpsertInput): Promise<StoredScenario> {
    const annualSavings = input.assumptions.reduce((sum, assumption) => sum + assumption.value, 0);
    const roiPercent = Math.max(0, Math.round(annualSavings / 10000));
    const paybackMonths = Math.max(1, Math.round(36 - Math.min(30, roiPercent / 5)));

    return this.repository.createScenario({
      ...input,
      annualSavings,
      roiPercent,
      paybackMonths,
    });
  }
}
