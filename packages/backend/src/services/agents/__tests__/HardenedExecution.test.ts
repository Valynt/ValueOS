import { describe, expect, it } from "vitest";

import {
  mapGovernanceVetoStatus,
  requiresHardenedExecution,
  resolveHardeningRiskTier,
} from "../HardenedExecution.js";
import { GovernanceVetoError } from "../../../lib/agent-fabric/hardening/index.js";

describe("HardenedExecution helper", () => {
  it("maps financial, commitment, and narrative agents to hardened execution", () => {
    expect(requiresHardenedExecution("financial-modeling")).toBe(true);
    expect(requiresHardenedExecution("communicator")).toBe(true);
    expect(requiresHardenedExecution("company-intelligence")).toBe(true);
    expect(requiresHardenedExecution("value-eval")).toBe(true);
    expect(requiresHardenedExecution("narrative")).toBe(true);
    expect(requiresHardenedExecution("opportunity")).toBe(false);
  });

  it("maps agent type to expected risk tier", () => {
    expect(resolveHardeningRiskTier("financial-modeling")).toBe("financial");
    expect(resolveHardeningRiskTier("communicator")).toBe("commitment");
    expect(resolveHardeningRiskTier("narrative")).toBe("narrative");
    expect(resolveHardeningRiskTier("opportunity")).toBe("discovery");
  });

  it("maps governance vetoes to deterministic API statuses", () => {
    const pendingStatus = mapGovernanceVetoStatus(
      new GovernanceVetoError(
        "NarrativeAgent",
        "pending_human",
        "Requires reviewer",
        "cp-1"
      )
    );
    expect(pendingStatus).toEqual({
      httpStatus: 423,
      apiStatus: "pending_human_review",
      errorCode: "AGENT_GOVERNANCE_PENDING_HUMAN",
    });

    const blockedStatus = mapGovernanceVetoStatus(
      new GovernanceVetoError("NarrativeAgent", "vetoed", "Low confidence")
    );
    expect(blockedStatus).toEqual({
      httpStatus: 422,
      apiStatus: "blocked",
      errorCode: "AGENT_GOVERNANCE_VETOED",
    });
  });
});
