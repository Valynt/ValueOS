import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../llm/secureServiceInvocation.js", () => ({
  secureServiceInvoke: vi.fn(),
}));

vi.mock("../../../events/DomainEventBus.js", () => ({
  buildEventEnvelope: vi.fn(() => ({ traceId: "trace-1", tenantId: "tenant-1", actorId: "system" })),
  getDomainEventBus: vi.fn(() => ({ publish: vi.fn().mockResolvedValue(undefined) })),
}));

vi.mock("../../../lib/logger.js", () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
}));

import { secureServiceInvoke } from "../../llm/secureServiceInvocation.js";
import { HandoffNotesGenerator } from "../HandoffNotesGenerator.js";

describe("HandoffNotesGenerator", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("routes handoff note generation through secureServiceInvoke", async () => {
    vi.mocked(secureServiceInvoke).mockResolvedValueOnce({
      parsed: {
        deal_context: "Deal context with enough detail for the success team.",
        buyer_priorities: "Buyer priorities explain the operational outcomes and success metrics.",
        implementation_assumptions: "Implementation assumptions capture staffing and timeline dependencies.",
        key_risks: "Key risks highlight adoption blockers and mitigation owners for onboarding.",
      },
      hallucinationCheck: true,
      tokenUsage: { input_tokens: 12, output_tokens: 34, total_tokens: 46 },
      rawContent: "{}",
    });

    const llmGateway = { complete: vi.fn() };
    const generator = new HandoffNotesGenerator(llmGateway as never, {} as never);

    const result = await generator["generateWithLLM"]("prompt", "baseline-1", "tenant-1");

    expect(secureServiceInvoke).toHaveBeenCalledOnce();
    expect(llmGateway.complete).not.toHaveBeenCalled();
    expect(result.deal_context).toContain("Deal context");
  });

  it("returns fallback notes when secureServiceInvoke fails", async () => {
    vi.mocked(secureServiceInvoke).mockRejectedValueOnce(new Error("llm unavailable"));

    const llmGateway = { complete: vi.fn() };
    const generator = new HandoffNotesGenerator(llmGateway as never, {} as never);

    const result = await generator["generateWithLLM"]("prompt", "baseline-1", "tenant-1");

    expect(secureServiceInvoke).toHaveBeenCalledOnce();
    expect(llmGateway.complete).not.toHaveBeenCalled();
    expect(result.deal_context).toContain("Please review");
  });
});
