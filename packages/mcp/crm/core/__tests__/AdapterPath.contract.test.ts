import { describe, expect, it } from "vitest";

import { CRM_TOOLS as canonicalTools, MCPCRMServer as CanonicalMCPCRMServer } from "../MCPCRMServer";
import {
  CRM_TOOLS as appTools,
  MCPCRMServer as AppMCPCRMServer,
} from "../../../../../apps/ValyntApp/src/mcp-crm/core/MCPCRMServer";

describe("MCP CRM canonical/runtime adapter contract", () => {
  it("adapter path and canonical runtime expose the same tool catalog", () => {
    expect(appTools).toEqual(canonicalTools);
  });

  it("adapter and canonical classes provide compatible public methods", () => {
    const adapter = new AppMCPCRMServer({
      tenantId: "tenant-contract",
      userId: "user-contract",
      enabledProviders: ["hubspot"],
      refreshTokensAutomatically: true,
    });

    const canonical = new CanonicalMCPCRMServer({
      tenantId: "tenant-contract",
      userId: "user-contract",
      enabledProviders: ["hubspot"],
      refreshTokensAutomatically: true,
    });

    expect(typeof adapter.initialize).toBe("function");
    expect(typeof adapter.executeTool).toBe("function");
    expect(typeof canonical.initialize).toBe("function");
    expect(typeof canonical.executeTool).toBe("function");
  });
});
