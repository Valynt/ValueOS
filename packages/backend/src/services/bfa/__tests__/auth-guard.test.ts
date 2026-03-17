import { beforeEach, describe, expect, it, vi } from "vitest";

import { AuthGuard } from "../auth-guard.js";
import { toolRegistry } from "../registry.js";
import {
  type AgentContext,
  AuthorizationError,
  type SemanticTool,
} from "../types.js";

interface TestInput {
  value: string;
}
interface TestOutput {
  ok: boolean;
}

const baseContext: AgentContext = {
  userId: "user-1",
  tenantId: "tenant-1",
  sessionId: "session-1",
  permissions: [],
  requestTime: new Date(),
};

describe("AuthGuard negative authorization paths", () => {
  beforeEach(() => {
    (
      toolRegistry as unknown as {
        tools: Map<string, unknown>;
        toolMetadata: Map<string, unknown>;
      }
    ).tools.clear();
    (
      toolRegistry as unknown as {
        tools: Map<string, unknown>;
        toolMetadata: Map<string, unknown>;
      }
    ).toolMetadata.clear();
  });

  it("blocks unauthorized execution before tool side effects run", async () => {
    const executeSpy = vi
      .fn<SemanticTool<TestInput, TestOutput>["execute"]>()
      .mockResolvedValue({ ok: true });

    toolRegistry.register<TestInput, TestOutput>({
      id: "secure-tool",
      description: "secure",
      inputSchema: { parse: (input: TestInput) => input } as never,
      outputSchema: { parse: (output: TestOutput) => output } as never,
      policy: {
        resource: "secure_resource",
        action: "execute",
        requiredPermissions: ["tool:execute:secure"],
      },
      execute: executeSpy,
    });

    await expect(
      AuthGuard.executeWithAuth("secure-tool", { value: "test" }, baseContext)
    ).rejects.toBeInstanceOf(AuthorizationError);

    expect(executeSpy).not.toHaveBeenCalled();
  });
});
