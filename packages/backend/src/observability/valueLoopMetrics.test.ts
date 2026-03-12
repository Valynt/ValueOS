import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockHistogramRecord, mockCounterAdd } = vi.hoisted(() => ({
  mockHistogramRecord: vi.fn(),
  mockCounterAdd: vi.fn(),
}));

vi.mock("../lib/observability/index.js", () => ({
  createHistogram: vi.fn(() => ({ record: mockHistogramRecord })),
  createCounter: vi.fn(() => ({ add: mockCounterAdd })),
}));

vi.mock("@shared/lib/logger", () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
}));

import {
  recordAgentInvocation,
  recordFinancialCalculation,
  recordHypothesisConfidence,
  recordLoopCompletion,
  recordStageTransition,
  recordUsageEvent,
} from "./valueLoopMetrics.js";

describe("valueLoopMetrics tenant labels", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("adds organization_id label to stage transition histogram", () => {
    recordStageTransition({
      fromStage: "signal",
      toStage: "hypothesis",
      organizationId: "org-123",
      durationMs: 500,
    });

    expect(mockHistogramRecord).toHaveBeenCalledWith(0.5, {
      organization_id: "org-123",
      from_stage: "signal",
      to_stage: "hypothesis",
    });
  });

  it("adds organization_id label to agent invocation counter", () => {
    recordAgentInvocation({
      agentName: "OpportunityAgent",
      stage: "hypothesis",
      outcome: "success",
      organizationId: "org-123",
      durationMs: 1000,
    });

    expect(mockCounterAdd).toHaveBeenCalledWith(1, {
      organization_id: "org-123",
      agent: "OpportunityAgent",
      stage: "hypothesis",
      outcome: "success",
    });
  });

  it("adds organization_id label to hypothesis confidence histogram", () => {
    recordHypothesisConfidence({
      agentName: "TargetAgent",
      confidence: 0.83,
      organizationId: "org-123",
    });

    expect(mockHistogramRecord).toHaveBeenCalledWith(0.83, {
      organization_id: "org-123",
      agent: "TargetAgent",
    });
  });

  it("adds organization_id label to financial calculations counter", () => {
    recordFinancialCalculation({
      calculationType: "roi",
      validated: true,
      organizationId: "org-123",
    });

    expect(mockCounterAdd).toHaveBeenCalledWith(1, {
      organization_id: "org-123",
      type: "roi",
      validated: "true",
    });
  });

  it("adds organization_id label to loop completion histogram", () => {
    recordLoopCompletion({
      organizationId: "org-123",
      sessionId: "session-1",
      durationMs: 4250,
      completedStages: ["signal", "hypothesis", "business_case", "realization", "expansion"],
    });

    expect(mockHistogramRecord).toHaveBeenCalledWith(4.25, {
      organization_id: "org-123",
      stages: "signal,hypothesis,business_case,realization,expansion",
    });
  });

  it("uses organization_id as the usage-event tenant label key", () => {
    recordUsageEvent({
      tenantId: "tenant-456",
      metric: "requests",
      quantity: 3,
    });

    expect(mockCounterAdd).toHaveBeenCalledWith(3, {
      metric: "requests",
      organization_id: "tenant-456",
    });
  });
});
