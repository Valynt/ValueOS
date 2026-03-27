import type { StoredScenario, ValueModelScenariosRepository } from "./repository.js";
import { ScenarioBuilder } from "../../services/value/ScenarioBuilder.js";

export interface ScenarioUpsertInput {
  organizationId: string;
  modelId: string;
  name: string;
  description?: string;
  assumptions: Array<{ key: string; value: number; unit?: string }>;
  /** Explicit investment cost in USD. Required unless an 'implementation_cost' assumption is present. */
  estimatedCostUsd?: number;
  /** Benefit realization horizon in years. Defaults to 3. */
  timelineYears?: number;
  /** Discount rate as decimal. Defaults to 0.10. */
  discountRate?: number;
}

export class ValueModelScenariosService {
  private readonly scenarioBuilder: ScenarioBuilder;

  constructor(
    private readonly repository: ValueModelScenariosRepository,
    scenarioBuilder?: ScenarioBuilder,
  ) {
    this.scenarioBuilder = scenarioBuilder ?? new ScenarioBuilder();
  }

  async list(input: { organizationId: string; modelId: string }): Promise<StoredScenario[]> {
    return this.repository.listByModel(input.organizationId, input.modelId);
  }

  async create(input: ScenarioUpsertInput): Promise<StoredScenario> {
    // Map API assumptions (key/value/unit) to the domain model (id/name/value/source_type)
    const domainAssumptions = input.assumptions.map((a) => ({
      id: crypto.randomUUID(),
      name: a.key,
      value: a.value,
      source_type: "inferred" as const,
    }));

    // ScenarioBuilder is the single source of truth for all financial math.
    // It throws if cost cannot be resolved from explicit input or assumptions register.
    const result = await this.scenarioBuilder.buildScenarios({
      organizationId: input.organizationId,
      caseId: input.modelId,
      name: input.name,
      description: input.description,
      acceptedHypotheses: [],
      assumptions: domainAssumptions,
      estimatedCostUsd: input.estimatedCostUsd,
      timelineYears: input.timelineYears,
      discountRate: input.discountRate,
    });

    // Return the base scenario as the canonical created record, then load
    // the persisted row through the repository so the caller gets DB-generated fields.
    return this.repository.loadById(input.organizationId, input.modelId, result.base.id);
  }
}
