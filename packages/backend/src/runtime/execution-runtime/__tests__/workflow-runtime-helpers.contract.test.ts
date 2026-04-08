import { describe, expect, it } from "vitest";

import { validateWorkflowDAGSchema } from "../workflow-dag-validation.js";
import { buildRecoveredRetryRuntimeFailure } from "../workflow-retry-decisioning.js";

describe("execution-runtime helpers contract", () => {
  it("validates dag schemas consistently", () => {
    const dag = validateWorkflowDAGSchema({
      initial_stage: "s1",
      final_stages: ["s1"],
      stages: [{ id: "s1", agent_type: "discovery" }],
      transitions: [],
    });

    expect(dag.initial_stage).toBe("s1");
  });

  it("only returns degraded runtime failure for retry recoveries", () => {
    expect(buildRecoveredRetryRuntimeFailure(1)).toBeUndefined();

    expect(buildRecoveredRetryRuntimeFailure(2)).toMatchInlineSnapshot(`
      {
        "blastRadiusEstimate": "single-stage",
        "class": "transient-degraded",
        "confidence": 0.72,
        "diagnosis": "Stage recovered after 2 attempts.",
        "machineReasonCode": "TRANSIENT_RETRY_RECOVERED",
        "owner": "workflow-owner",
        "playbookGuidance": "Retry automatically first; reroute to workflow owner if retries are exhausted.",
        "playbookTitle": "Transient degradation",
        "recommendedNextActions": [
          "retry",
          "reroute-owner",
        ],
        "severity": "degraded",
      }
    `);
  });
});
