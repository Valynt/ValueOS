import { beforeEach, describe, expect, it, vi } from "vitest";

import { secureLLMComplete } from "../../../lib/llm/secureLLMWrapper.js";
import { logSecurityEvent } from "../../security/auditLogger.js";
import { HandoffNotesGenerator } from "../HandoffNotesGenerator.js";

vi.mock("../../../lib/llm/secureLLMWrapper.js", () => ({
  secureLLMComplete: vi.fn(),
}));

vi.mock("../../security/auditLogger.js", () => ({
  logSecurityEvent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../../events/DomainEventBus.js", () => ({
  buildEventEnvelope: vi.fn(() => ({})),
  getDomainEventBus: vi.fn(() => ({ publish: vi.fn().mockResolvedValue(undefined) })),
}));

vi.mock("../../../lib/logger.js", () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

describe("HandoffNotesGenerator", () => {
  const mockSupabase = {
    from: vi.fn(),
  } as any;

  const mockGateway = {
    complete: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(logSecurityEvent).mockResolvedValue(undefined);
  });

  it("uses secureLLMComplete for handoff note generation", async () => {
    vi.mocked(secureLLMComplete).mockResolvedValue({
      content: JSON.stringify({
        deal_context: "Deal context",
        buyer_priorities: "Buyer priorities",
        implementation_assumptions: "Implementation assumptions",
        key_risks: "Key risks",
      }),
      usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
    });

    const generator = new HandoffNotesGenerator({
      supabase: mockSupabase,
      llmGateway: mockGateway,
    });

    const result = await (generator as any).generateWithLLM("Prompt text", "baseline-1", "tenant-1");

    expect(result).toEqual({
      deal_context: "Deal context",
      buyer_priorities: "Buyer priorities",
      implementation_assumptions: "Implementation assumptions",
      key_risks: "Key risks",
    });
    expect(secureLLMComplete).toHaveBeenCalledWith(
      mockGateway,
      expect.any(Array),
      expect.objectContaining({
        tenantId: "tenant-1",
        serviceName: "HandoffNotesGenerator",
        operation: "generateHandoffNotes",
        sessionId: "baseline-1",
      }),
    );
    expect(mockGateway.complete).not.toHaveBeenCalled();
    expect(logSecurityEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: "handoff:notes_generated" }),
    );
  });

  it("returns fallback notes when secureLLMComplete fails", async () => {
    vi.mocked(secureLLMComplete).mockRejectedValue(new Error("gateway failed"));

    const generator = new HandoffNotesGenerator({
      supabase: mockSupabase,
      llmGateway: mockGateway,
    });

    const result = await (generator as any).generateWithLLM("Prompt text", "baseline-2", "tenant-2");

    expect(result).toEqual({
      deal_context: "Please review the value case directly for deal context.",
      buyer_priorities: "Please review stakeholder notes for buyer priorities.",
      implementation_assumptions: "Please validate all assumptions with the customer success team.",
      key_risks: "Schedule a risk review meeting with the value engineering team.",
    });
    expect(logSecurityEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: "handoff:notes_generation_failed" }),
    );
    expect(mockGateway.complete).not.toHaveBeenCalled();
  });
});
