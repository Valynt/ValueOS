import { describe, expect, it, vi, beforeEach } from "vitest";
import { z } from "zod";

vi.mock("../../../lib/llm/secureLLMWrapper.js", () => ({
  secureLLMComplete: vi.fn(),
}));

const mockLogLLMInvocation = vi.fn();

vi.mock("../../../lib/agent-fabric/AuditLogger.js", () => ({
  getAuditLogger: () => ({
    logLLMInvocation: mockLogLLMInvocation,
  }),
}));

import { secureLLMComplete } from "../../../lib/llm/secureLLMWrapper.js";
import { secureServiceInvoke } from "../secureServiceInvocation.js";

const schema = z.object({ result: z.string() });
const mockLogger = {
  error: vi.fn(),
  warn: vi.fn(),
};

describe("secureServiceInvoke", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("delegates to secureLLMComplete and records audit metadata", async () => {
    vi.mocked(secureLLMComplete).mockResolvedValueOnce({
      content: JSON.stringify({ result: "ok" }),
      model: "gpt-4o-mini",
      usage: {
        prompt_tokens: 10,
        completion_tokens: 5,
        total_tokens: 15,
      },
    });

    const result = await secureServiceInvoke({
      gateway: { complete: vi.fn() },
      messages: [{ role: "user", content: "hello" }],
      schema,
      request: { organizationId: "org-1", tenantId: "tenant-1" },
      logger: mockLogger,
      actorName: "TestService",
      sessionId: "session-1",
      tenantId: "org-1",
      invalidJsonMessage: "bad json",
      invalidJsonLogMessage: "parse failed",
    });

    expect(secureLLMComplete).toHaveBeenCalledOnce();
    expect(result.parsed.result).toBe("ok");
    expect(result.tokenUsage?.total_tokens).toBe(15);
    expect(mockLogLLMInvocation).toHaveBeenCalledWith(
      expect.objectContaining({
        agentName: "TestService",
        sessionId: "session-1",
        tenantId: "org-1",
        model: "gpt-4o-mini",
        hallucinationPassed: true,
      }),
    );
  });

  it("logs an escalation when hallucination check fails", async () => {
    vi.mocked(secureLLMComplete).mockResolvedValueOnce({
      content: JSON.stringify({ result: "needs review" }),
      model: "gpt-4o-mini",
    });

    const result = await secureServiceInvoke({
      gateway: { complete: vi.fn() },
      messages: [{ role: "user", content: "hello" }],
      schema,
      request: { organizationId: "org-1", tenantId: "tenant-1" },
      logger: mockLogger,
      actorName: "TestService",
      sessionId: "session-1",
      tenantId: "org-1",
      invalidJsonMessage: "bad json",
      invalidJsonLogMessage: "parse failed",
      hallucinationCheck: () => false,
      escalationLogMessage: "hallucination escalation",
    });

    expect(result.hallucinationCheck).toBe(false);
    expect(mockLogger.warn).toHaveBeenCalledWith("hallucination escalation", undefined);
    expect(mockLogLLMInvocation).toHaveBeenCalledWith(
      expect.objectContaining({
        groundingScore: 0.4,
        hallucinationPassed: false,
      }),
    );
  });
});
