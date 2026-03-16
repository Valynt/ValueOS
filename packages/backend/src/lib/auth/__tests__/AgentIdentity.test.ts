import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../services/policy/AgentPolicyService.js", () => ({
  getAgentPolicyService: vi.fn(() => ({
    getPolicy: vi.fn((agentType: string) => {
      const policies: Record<string, { allowedTools: string[]; version: string }> = {
        "compliance-auditor-agent": {
          allowedTools: ["document_lookup"],
          version: "2026-07-01",
        },
        "opportunity-agent": {
          allowedTools: ["web_search", "document_lookup", "calculator"],
          version: "2026-07-01",
        },
        default: {
          allowedTools: ["web_search", "document_lookup", "calculator"],
          version: "2026-07-01",
        },
      };
      const policy = policies[agentType] ?? policies.default;
      if (!policy) throw new Error(`No policy for ${agentType}`);
      return policy;
    }),
  })),
}));

import { canUseTool, createAgentIdentity, PermissionDeniedError } from "../AgentIdentity.js";

describe("AgentIdentity permissions (F-013)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("populates permissions from policy allowedTools", () => {
    const identity = createAgentIdentity("agent-1", "opportunity-agent", "org-abc");
    expect(identity.permissions).toContain("tool:web_search");
    expect(identity.permissions).toContain("tool:document_lookup");
    expect(identity.permissions).toContain("tool:calculator");
  });

  it("ComplianceAuditorAgent only gets document_lookup", () => {
    const identity = createAgentIdentity("agent-2", "compliance-auditor-agent", "org-abc");
    expect(identity.permissions).toContain("tool:document_lookup");
    expect(identity.permissions).not.toContain("tool:web_search");
  });

  it("canUseTool returns true for an allowed tool", () => {
    const identity = createAgentIdentity("agent-3", "opportunity-agent", "org-abc");
    expect(canUseTool(identity, "web_search")).toBe(true);
  });

  it("canUseTool returns false for a disallowed tool", () => {
    const identity = createAgentIdentity("agent-4", "compliance-auditor-agent", "org-abc");
    expect(canUseTool(identity, "web_search")).toBe(false);
  });

  it("PermissionDeniedError has correct message", () => {
    const err = new PermissionDeniedError("compliance-auditor-agent", "web_search");
    expect(err.message).toContain("compliance-auditor-agent");
    expect(err.message).toContain("web_search");
    expect(err.name).toBe("PermissionDeniedError");
  });

  it("falls back to empty permissions when policy service throws", async () => {
    const { getAgentPolicyService } = await import("../../../services/policy/AgentPolicyService.js");
    vi.mocked(getAgentPolicyService).mockReturnValueOnce({
      getPolicy: vi.fn().mockImplementation(() => { throw new Error("no policy"); }),
    } as never);

    const identity = createAgentIdentity("agent-5", "unknown-agent", "org-abc");
    expect(identity.permissions).toEqual([]);
  });
});
