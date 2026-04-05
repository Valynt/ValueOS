import { describe, expect, it, vi } from "vitest";

import { CRM_TOOLS } from "./MCPCRMServer";
import type { MCPCRMToolResult } from "../types";

describe("Valynt MCPCRMServer adapter contract", () => {
  it("exposes a non-empty tool catalog from canonical runtime", () => {
    expect(Array.isArray(CRM_TOOLS)).toBe(true);
    expect(CRM_TOOLS.length).toBeGreaterThan(0);
  });

  it("preserves app-specific crm_check_connection status field", async () => {
    vi.resetModules();
    vi.doMock("../../../../../packages/mcp/crm/index.ts", () => ({
      CRM_TOOLS,
      getMCPCRMServer: vi.fn(async () => ({
        initialize: vi.fn(async () => {}),
        isConnected: vi.fn(() => true),
        getTools: vi.fn(() => CRM_TOOLS),
        getConnectedProviders: vi.fn(() => ["hubspot"]),
        executeTool: vi.fn(async () => ({
          success: true,
          data: {
            providers: [{ provider: "hubspot", status: "active" }],
          },
        } satisfies MCPCRMToolResult)),
      })),
    }));

    const { MCPCRMServer } = await import("./MCPCRMServer");
    const server = new MCPCRMServer({
      tenantId: "tenant-1",
      userId: "user-1",
      enabledProviders: ["hubspot"],
      refreshTokensAutomatically: true,
    });

    const result = await server.executeTool("crm_check_connection", {});
    expect(result.success).toBe(true);
    expect((result.data as { status?: string }).status).toBe("connected");
  });
});
