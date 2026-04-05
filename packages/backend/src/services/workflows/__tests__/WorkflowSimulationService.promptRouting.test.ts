import { describe, expect, it } from "vitest";

import { resolvePromptTemplate } from "../../../lib/agent-fabric/promptRegistry.js";
import { resolveWorkflowSimulationPromptKey } from "../WorkflowSimulationService.js";
import type { WorkflowStage } from "../../../types/workflow.js";

function makeStage(overrides: Partial<WorkflowStage>): WorkflowStage {
  return {
    id: "stage-id",
    name: "Stage",
    agent_type: "target",
    timeout_seconds: 60,
    ...overrides,
  };
}

describe("WorkflowSimulationService prompt routing", () => {
  it("routes value modeling stage ids to dedicated prompt keys", () => {
    const routes = [
      { stageId: "baseline_establishment", promptKey: "value_modeling_baseline_establishment" },
      { stageId: "assumption_registration", promptKey: "value_modeling_assumption_registration" },
      { stageId: "scenario_building", promptKey: "value_modeling_scenario_building" },
      { stageId: "sensitivity_analysis", promptKey: "value_modeling_sensitivity_analysis" },
    ] as const;

    for (const route of routes) {
      const stage = makeStage({ id: route.stageId });
      const promptKey = resolveWorkflowSimulationPromptKey(stage);

      expect(promptKey).toBe(route.promptKey);
      const resolved = resolvePromptTemplate(promptKey!);
      expect(resolved.version).toBe("1.0.0");
    }
  });

  it("falls back to capability mapping when stage id is non-canonical", () => {
    const stage = makeStage({
      id: "custom_stage",
      required_capabilities: ["evf_decomposition"],
    });
    expect(resolveWorkflowSimulationPromptKey(stage)).toBe("value_modeling_scenario_building");
  });
});
