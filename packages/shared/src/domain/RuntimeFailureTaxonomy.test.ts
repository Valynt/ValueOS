import { describe, expect, it } from "vitest";

import { buildRuntimeFailureDetails, RUNTIME_FAILURE_PLAYBOOKS } from "./RuntimeFailureTaxonomy";

describe("RuntimeFailureTaxonomy", () => {
  it("maps policy-blocked to override/escalation playbook actions", () => {
    const details = buildRuntimeFailureDetails({
      class: "policy-blocked",
      severity: "failed",
      machineReasonCode: "POLICY_INTEGRITY_VETO",
      diagnosis: "Integrity check vetoed output",
      confidence: 0.93,
      blastRadiusEstimate: "workflow",
    });

    expect(details.recommendedNextActions).toEqual(RUNTIME_FAILURE_PLAYBOOKS["policy-blocked"].actions);
    expect(details.owner).toBe("policy-admin");
  });

  it("clamps confidence to [0, 1]", () => {
    const details = buildRuntimeFailureDetails({
      class: "transient-degraded",
      severity: "degraded",
      machineReasonCode: "TRANSIENT_RETRY_RECOVERED",
      diagnosis: "Recovered after retry",
      confidence: 2,
      blastRadiusEstimate: "single-stage",
    });

    expect(details.confidence).toBe(1);
  });
});
