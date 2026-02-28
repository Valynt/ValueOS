import { beforeEach, describe, expect, it, vi } from "vitest";

// --- Mocks ---

vi.mock("../../lib/logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("../../config/llm.js", () => ({
  llmConfig: { provider: "custom", gatingEnabled: false },
}));

vi.mock("../../lib/agent-fabric/LLMGateway", () => ({
  LLMGateway: class MockLLMGateway {
    constructor(..._args: unknown[]) {}
    complete = vi.fn();
  },
}));

const { mockAddMessage } = vi.hoisted(() => ({
  mockAddMessage: vi.fn().mockResolvedValue({
    role: "assistant",
    content: "test response",
    timestamp: Date.now(),
  }),
}));

vi.mock("../ConversationHistoryService", () => ({
  conversationHistoryService: {
    addMessage: mockAddMessage,
    getHistory: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock("../../repositories/WorkflowStateRepository", () => ({
  WorkflowStateRepository: class {
    save = vi.fn();
    get = vi.fn();
  },
}));

vi.mock("../../data/valueModelExamples", () => ({
  getRelevantExamples: vi.fn().mockReturnValue([]),
  formatExampleForPrompt: vi.fn().mockReturnValue(""),
}));

vi.mock("../MCPTools.js", () => ({
  createToolExecutor: vi.fn(),
  getAllTools: vi.fn().mockReturnValue([]),
}));

vi.mock("../../config/chatWorkflowConfig.js", () => ({
  checkStageTransition: vi.fn().mockReturnValue(null),
}));

vi.mock("@sdui/templates/chat-templates", () => ({
  generateChatSDUIPage: vi.fn().mockReturnValue({ type: "page", version: 1, sections: [] }),
  hasTemplateForStage: vi.fn().mockReturnValue(false),
}));

vi.mock("../../lib/agent-fabric/ContextFabric", () => ({
  contextFabric: {
    buildContext: vi.fn().mockResolvedValue({}),
  },
}));

vi.mock("../../data/industryTemplates", () => ({
  detectIndustry: vi.fn().mockReturnValue({
    name: "Technology",
    role: "Technology Value Consultant",
    focusAreas: ["Digital Transformation"],
    metrics: ["ARR"],
    typicalPainPoints: ["Legacy systems"],
  }),
}));

const { mockGenerateContent } = vi.hoisted(() => ({
  mockGenerateContent: vi.fn(),
}));

vi.mock("../GeminiProxyService.js", () => ({
  geminiProxyService: {
    generateContent: mockGenerateContent,
  },
}));

vi.mock("../FallbackAIService.js", () => ({
  FallbackAIService: {
    shouldUseFallback: vi.fn().mockReturnValue(false),
    getCachedAnalysis: vi.fn().mockReturnValue(null),
    generateFallbackAnalysis: vi.fn().mockReturnValue({
      analysisSummary: "Fallback analysis",
      identifiedIndustry: "General",
      valueHypotheses: [],
      keyMetrics: [],
      recommendedActions: [],
    }),
    cacheAnalysis: vi.fn(),
  },
}));

vi.mock("../RetryService.js", () => ({
  RetryService: {
    executeWithRetry: vi.fn(),
  },
}));

// --- Imports ---

import { AgentChatService } from "../AgentChatService";
import type { ChatRequest } from "../AgentChatService";
import { RetryService } from "../RetryService.js";
import { checkStageTransition } from "../../config/chatWorkflowConfig.js";
import type { WorkflowState } from "../../repositories/WorkflowStateRepository";

// --- Helpers ---

function makeWorkflowState(overrides: Partial<WorkflowState> = {}): WorkflowState {
  return {
    id: "wf-1",
    workflow_id: "wf-def-1",
    execution_id: "exec-1",
    workspace_id: "ws-1",
    organization_id: "org-123",
    lifecycle_stage: "opportunity",
    status: "running",
    current_step: "discovery",
    currentStage: "opportunity",
    completed_steps: [],
    state_data: {},
    context: {},
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function makeChatRequest(overrides: Partial<ChatRequest> = {}): ChatRequest {
  return {
    query: "Analyze Acme Corp for cost reduction",
    caseId: "case-1",
    userId: "user-1",
    sessionId: "sess-1",
    tenantId: "org-123",
    workflowState: makeWorkflowState(),
    ...overrides,
  };
}

const VALID_AI_RESPONSE = JSON.stringify({
  analysisSummary: "Acme Corp has opportunities in supply chain optimization.",
  identifiedIndustry: "Manufacturing",
  valueHypotheses: [
    {
      title: "Supply Chain Optimization",
      description: "Reduce procurement costs",
      impact: "High",
      confidence: 85,
    },
  ],
  keyMetrics: [
    { label: "Cost Savings", value: "$1.2M", trend: "up" },
  ],
  recommendedActions: ["Schedule discovery call", "Request vendor data"],
});

// --- Tests ---

describe("AgentChatService", () => {
  let service: AgentChatService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AgentChatService();

    // Default: RetryService succeeds with valid AI response
    (RetryService.executeWithRetry as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
      result: VALID_AI_RESPONSE,
      attempts: 1,
      totalDelay: 0,
    });
  });

  describe("chat", () => {
    it("returns structured ChatResponse with message, SDUI page, and traceId", async () => {
      const result = await service.chat(makeChatRequest());

      expect(result).toHaveProperty("message");
      expect(result).toHaveProperty("sduiPage");
      expect(result).toHaveProperty("nextState");
      expect(result).toHaveProperty("traceId");
      expect(result.traceId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );
    });

    it("stores assistant message in conversation history", async () => {
      await service.chat(makeChatRequest());

      expect(mockAddMessage).toHaveBeenCalledWith(
        "case-1",
        expect.objectContaining({
          role: "assistant",
          content: expect.any(String),
          confidence: expect.any(Number),
        }),
      );
    });

    it("preserves workflow state context with lastQuery and lastResponse", async () => {
      const result = await service.chat(makeChatRequest({
        query: "What are the cost drivers?",
      }));

      expect(result.nextState.context).toMatchObject({
        lastQuery: "What are the cost drivers?",
        lastResponse: expect.any(String),
        lastUpdated: expect.any(String),
      });
    });

    it("persists structured analysis in workflow context for refinement loop", async () => {
      const result = await service.chat(makeChatRequest());

      expect(result.nextState.context?.lastAnalysis).toBeDefined();
      expect(result.nextState.context?.lastAnalysis).toHaveProperty("analysisSummary");
      expect(result.nextState.context?.lastAnalysis).toHaveProperty("valueHypotheses");
    });

    it("returns error SDUI page when API call fails completely", async () => {
      (RetryService.executeWithRetry as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: false,
        error: new Error("All retries exhausted"),
        attempts: 3,
        totalDelay: 5000,
      });

      const result = await service.chat(makeChatRequest());

      expect(result.message.content).toContain("Error");
      expect(result.sduiPage).toBeDefined();
      // Workflow state should be unchanged on error
      expect(result.nextState.currentStage).toBe("opportunity");
    });

    it("passes tenantId to context fabric for tenant-scoped context", async () => {
      const { contextFabric } = await import("../../lib/agent-fabric/ContextFabric");

      await service.chat(makeChatRequest({ tenantId: "org-tenant-42" }));

      expect(contextFabric.buildContext).toHaveBeenCalledWith(
        "user-1",
        "org-tenant-42",
        expect.any(Object),
      );
    });
  });

  describe("workflow state transitions", () => {
    it("transitions stage when checkStageTransition returns a new stage", async () => {
      (checkStageTransition as ReturnType<typeof vi.fn>).mockReturnValue("target");

      const result = await service.chat(makeChatRequest());

      expect(result.nextState.currentStage).toBe("target");
      expect(result.nextState.completed_steps).toContain("opportunity");
    });

    it("does not transition when checkStageTransition returns null", async () => {
      (checkStageTransition as ReturnType<typeof vi.fn>).mockReturnValue(null);

      const result = await service.chat(makeChatRequest());

      expect(result.nextState.currentStage).toBe("opportunity");
      expect(result.nextState.completed_steps).toEqual([]);
    });

    it("does not duplicate completed_steps on repeated transitions", async () => {
      (checkStageTransition as ReturnType<typeof vi.fn>).mockReturnValue("target");

      const state = makeWorkflowState({
        completed_steps: ["opportunity"],
      });

      const result = await service.chat(makeChatRequest({ workflowState: state }));

      const opportunityCount = result.nextState.completed_steps.filter(
        (s: string) => s === "opportunity",
      ).length;
      expect(opportunityCount).toBe(1);
    });
  });

  describe("AIResponseSchema validation", () => {
    it("rejects response missing required fields", async () => {
      (RetryService.executeWithRetry as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        result: JSON.stringify({ analysisSummary: "partial" }),
        attempts: 1,
        totalDelay: 0,
      });

      // Should fall through to error handling
      const result = await service.chat(makeChatRequest());
      expect(result.message.content).toContain("Error");
    });

    it("rejects response with invalid impact enum", async () => {
      (RetryService.executeWithRetry as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        result: JSON.stringify({
          analysisSummary: "test",
          identifiedIndustry: "Tech",
          valueHypotheses: [
            { title: "H1", description: "D1", impact: "INVALID", confidence: 50 },
          ],
          keyMetrics: [],
          recommendedActions: [],
        }),
        attempts: 1,
        totalDelay: 0,
      });

      const result = await service.chat(makeChatRequest());
      expect(result.message.content).toContain("Error");
    });
  });
});
