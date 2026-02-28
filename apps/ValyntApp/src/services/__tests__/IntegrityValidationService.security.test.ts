import { describe, expect, it, vi } from "vitest";
import {
  CheckType,
  ContentType,
  IntegrityValidationService,
  ValidationLevel,
} from "../IntegrityValidationService";

const baseRequest = {
  content: {},
  contentType: ContentType.MEMORY_CONTENT,
  agentType: "sales-agent",
  traceId: "trace-123",
  validationLevel: ValidationLevel.COMPREHENSIVE,
};

describe("IntegrityValidationService cross-agent tenant safety", () => {
  it("fails closed when tenant context is missing", async () => {
    const agentMemoryService = {
      queryMemoriesStrict: vi.fn(),
    } as any;

    const service = new IntegrityValidationService(agentMemoryService, "url", "key");

    const result = await service.validateIntegrity({
      ...baseRequest,
      context: { caseId: "case-1" },
    });

    const crossAgentCheck = result.checks.find((check) => check.type === CheckType.CROSS_AGENT_CONSISTENCY);
    const crossAgentViolation = result.violations.find((violation) => violation.type === CheckType.CROSS_AGENT_CONSISTENCY);

    expect(crossAgentCheck?.status).toBe("fail");
    expect(crossAgentViolation?.severity).toBe("high");
    expect(agentMemoryService.queryMemoriesStrict).not.toHaveBeenCalled();
  });

  it("passes tenant scope to strict memory queries for consistency checks", async () => {
    const agentMemoryService = {
      queryMemoriesStrict: vi.fn().mockResolvedValue({
        memories: [],
        totalCount: 0,
        hasMore: false,
        queryTime: 1,
      }),
    } as any;

    const service = new IntegrityValidationService(agentMemoryService, "url", "key");

    await service.validateIntegrity({
      ...baseRequest,
      context: { caseId: "case-1", tenantId: "tenant-a" },
    });

    expect(agentMemoryService.queryMemoriesStrict).toHaveBeenCalledWith(
      {
        caseId: "case-1",
        tenantId: "tenant-a",
        agentType: "sales-agent",
        limit: 10,
      },
      "IntegrityValidationService.checkCrossAgentConsistency"
    );
  });
});
