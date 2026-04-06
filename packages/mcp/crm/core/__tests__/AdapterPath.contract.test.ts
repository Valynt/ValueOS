import { describe, expect, it } from "vitest";

import {
  MCPCRMServer as AppMCPCRMServer,
  CRM_TOOLS as appTools,
} from "../../../../../apps/ValyntApp/src/mcp-crm/core/MCPCRMServer";
import {
  MCPCRMServer as CanonicalMCPCRMServer,
  CRM_TOOLS as canonicalTools,
} from "../MCPCRMServer";

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
