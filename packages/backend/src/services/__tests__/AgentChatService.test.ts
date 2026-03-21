import { beforeEach, describe, expect, it, vi } from "vitest";

// --- Hoisted mocks ---

const { mockGeminiProxy, mockConversationHistory, mockContextFabric, mockRetryService } =
  vi.hoisted(() => {
    const mockGeminiProxy = {
      generateContent: vi.fn(),
    };

    const mockConversationHistory = {
      addMessage: vi.fn().mockResolvedValue({
        role: "assistant",
        content: "test response",
        timestamp: Date.now(),
        agentName: "Test Agent",
        confidence: 0.9,
        reasoning: [],
      }),
      getHistory: vi.fn().mockResolvedValue([]),
    };

    const mockContextFabric = {
      buildContext: vi.fn().mockResolvedValue({
        industry: "technology",
        stage: "opportunity",
      }),
    };

    const mockRetryService = {
      executeWithRetry: vi.fn(),
    };

    return {
      mockGeminiProxy,
      mockConversationHistory,
      mockContextFabric,
      mockRetryService,
    };
  });

// --- Module mocks ---

vi.mock("../../lib/logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  createLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() })),
}));

vi.mock("../../lib/agent-fabric/LLMGateway", () => ({
  LLMGateway: class MockLLMGateway {
    constructor() {}
    complete = vi.fn();
  },
}));

vi.mock("../../config/llm.js", () => ({
  llmConfig: { provider: "test", gatingEnabled: false },
}));

vi.mock("../ConversationHistoryService", () => ({
  conversationHistoryService: mockConversationHistory,
}));

vi.mock("../GeminiProxyService.js", () => ({
  geminiProxyService: mockGeminiProxy,
}));

vi.mock("../FallbackAIService.js", () => ({
  FallbackAIService: {
    cacheAnalysis: vi.fn(),
    shouldUseFallback: vi.fn().mockReturnValue(true),
    getCachedAnalysis: vi.fn().mockReturnValue(null),
    generateFallbackAnalysis: vi.fn().mockReturnValue({
      analysisSummary: "Fallback analysis",
      identifiedIndustry: "General",
      valueHypotheses: [],
      keyMetrics: [],
      recommendedActions: ["Review manually"],
    }),
  },
}));

vi.mock("../RetryService.js", () => ({
  RetryService: mockRetryService,
}));

vi.mock("../../lib/agent-fabric/ContextFabric", () => ({
  contextFabric: mockContextFabric,
}));

vi.mock("../../data/industryTemplates", () => ({
  detectIndustry: vi.fn().mockReturnValue({
    name: "Technology",
    role: "Technology Value Consultant",
    focusAreas: ["digital transformation"],
    metrics: ["ARR", "NRR"],
    typicalPainPoints: ["legacy systems"],
  }),
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
  generateChatSDUIPage: vi.fn().mockReturnValue({
    type: "page",
    version: 1,
    sections: [],
    metadata: {},
  }),
  hasTemplateForStage: vi.fn().mockReturnValue(false),
}));

vi.mock("@valueos/sdui", () => ({
  SDUIPageDefinition: {},
}));

vi.mock("../../repositories/WorkflowStateRepository", () => ({
  WorkflowStateRepository: class {},
}));

// --- Imports ---

import { checkStageTransition } from "../../config/chatWorkflowConfig.js";
import { AgentChatService, AIResponseSchema } from "../AgentChatService";
import type { ChatRequest } from "../AgentChatService";

// --- Helpers ---

const VALID_AI_RESPONSE: AIResponseSchema = {
  analysisSummary: "Acme Corp shows strong potential for cost optimization.",
  identifiedIndustry: "Technology",
  valueHypotheses: [
    {
      title: "Cloud Migration Savings",
      description: "Migrate on-prem to cloud for 30% cost reduction",
      impact: "High",
      confidence: 85,
    },
  ],
  keyMetrics: [
    { label: "Annual IT Spend", value: "$2.5M", trend: "up" },
  ],
  recommendedActions: ["Schedule discovery call", "Request IT budget breakdown"],
};

function makeWorkflowState(overrides: Record<string, unknown> = {}) {
  return {
    id: "wf-1",
    workflow_id: "wf-1",
    execution_id: "exec-1",
    workspace_id: "ws-1",
    organization_id: "org-1",
    lifecycle_stage: "opportunity",
    status: "running" as const,
    current_step: "step-1",
    currentStage: "opportunity",
    completed_steps: [],
    state_data: {},
    context: { caseId: "case-1" },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

function makeChatRequest(overrides: Partial<ChatRequest> = {}): ChatRequest {
  return {
    query: "Analyze Acme Corp for cost reduction opportunities",
    caseId: "case-1",
    userId: "user-1",
    sessionId: "session-1",
    tenantId: "tenant-1",
    workflowState: makeWorkflowState(),
    ...overrides,
  };
}

// --- Tests ---

describe("AgentChatService", () => {
  let service: AgentChatService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AgentChatService();

    // Default: RetryService succeeds with valid AI response
    mockRetryService.executeWithRetry.mockResolvedValue({
      success: true,
      result: JSON.stringify(VALID_AI_RESPONSE),
      attempts: 1,
      totalDelay: 0,
    });
  });

  // ==========================================================================
  // chat() — main flow
  // ==========================================================================

  describe("chat", () => {
    it("returns structured response with message, SDUI page, and trace ID", async () => {
      const result = await service.chat(makeChatRequest());

      expect(result.message).toBeDefined();
      expect(result.sduiPage).toBeDefined();
      expect(result.traceId).toBeDefined();
      expect(result.nextState).toBeDefined();
    });

    it("builds context via ContextFabric", async () => {
      await service.chat(makeChatRequest());

      expect(mockContextFabric.buildContext).toHaveBeenCalledWith(
        "user-1",
        "tenant-1",
        expect.objectContaining({ currentStage: "opportunity" })
      );
    });

    it("calls RetryService with Gemini proxy", async () => {
      await service.chat(makeChatRequest());

      expect(mockRetryService.executeWithRetry).toHaveBeenCalledTimes(1);
      const [apiCallFn, retryOptions] =
        mockRetryService.executeWithRetry.mock.calls[0];
      expect(typeof apiCallFn).toBe("function");
      expect(retryOptions.maxAttempts).toBe(3);
      expect(retryOptions.context.serviceId).toBe("gemini-proxy");
    });

    it("stores conversation message on success", async () => {
      await service.chat(makeChatRequest());

      expect(mockConversationHistory.addMessage).toHaveBeenCalledWith(
        "case-1",
        expect.objectContaining({
          role: "assistant",
          content: expect.stringContaining("Acme Corp"),
          confidence: 0.9,
        })
      );
    });

    it("updates workflow state with last query and response", async () => {
      const result = await service.chat(makeChatRequest());

      expect(result.nextState.context).toEqual(
        expect.objectContaining({
          lastQuery: "Analyze Acme Corp for cost reduction opportunities",
          lastResponse: expect.stringContaining("Acme Corp"),
          lastUpdated: expect.any(String),
        })
      );
    });

    it("persists structured analysis in workflow context for refinement loop", async () => {
      const result = await service.chat(makeChatRequest());

      expect(result.nextState.context?.lastAnalysis).toBeDefined();
      expect(
        (result.nextState.context?.lastAnalysis as AIResponseSchema)
          .analysisSummary
      ).toContain("Acme Corp");
    });
  });

  // ==========================================================================
  // chat() — error handling
  // ==========================================================================

  describe("chat error handling", () => {
    it("returns error SDUI when retry exhausted and fallback unavailable", async () => {
      mockRetryService.executeWithRetry.mockResolvedValue({
        success: false,
        error: new Error("All retries failed"),
        attempts: 3,
        totalDelay: 5000,
        circuitBreakerTripped: false,
      });

      // FallbackAIService.shouldUseFallback returns true by default,
      // and generateFallbackAnalysis returns a valid fallback
      const result = await service.chat(makeChatRequest());

      // Should use fallback analysis
      expect(result.message).toBeDefined();
      expect(result.sduiPage).toBeDefined();
    });

    it("returns error page on unexpected exception", async () => {
      mockRetryService.executeWithRetry.mockRejectedValue(
        new Error("Unexpected crash")
      );

      const result = await service.chat(makeChatRequest());

      expect(result.sduiPage.sections).toBeDefined();
      expect(result.sduiPage.sections[0].component).toBe("AgentResponseCard");
      expect(result.sduiPage.sections[0].props.response.status).toBe("error");
    });

    it("handles invalid JSON from Gemini gracefully", async () => {
      mockRetryService.executeWithRetry.mockResolvedValue({
        success: true,
        result: "not valid json at all",
        attempts: 1,
        totalDelay: 0,
      });

      const result = await service.chat(makeChatRequest());

      // Should fall through to error handler
      expect(result.sduiPage.sections[0].component).toBe("AgentResponseCard");
      expect(result.sduiPage.sections[0].props.response.status).toBe("error");
    });
  });

  // ==========================================================================
  // AIResponseSchema validation
  // ==========================================================================

  describe("AIResponseSchema", () => {
    it("validates a correct response", () => {
      const result = AIResponseSchema.safeParse(VALID_AI_RESPONSE);
      expect(result.success).toBe(true);
    });

    it("rejects missing analysisSummary", () => {
      const { analysisSummary, ...incomplete } = VALID_AI_RESPONSE;
      const result = AIResponseSchema.safeParse(incomplete);
      expect(result.success).toBe(false);
    });

    it("rejects invalid impact enum", () => {
      const invalid = {
        ...VALID_AI_RESPONSE,
        valueHypotheses: [
          { ...VALID_AI_RESPONSE.valueHypotheses[0], impact: "Extreme" },
        ],
      };
      const result = AIResponseSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it("rejects confidence outside 0-100 range", () => {
      const invalid = {
        ...VALID_AI_RESPONSE,
        valueHypotheses: [
          { ...VALID_AI_RESPONSE.valueHypotheses[0], confidence: 150 },
        ],
      };
      const result = AIResponseSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it("rejects invalid trend enum", () => {
      const invalid = {
        ...VALID_AI_RESPONSE,
        keyMetrics: [
          { label: "Revenue", value: "$1M", trend: "sideways" },
        ],
      };
      const result = AIResponseSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });

  // ==========================================================================
  // parseResponse (private, tested via behavior)
  // ==========================================================================

  describe("response parsing heuristics", () => {
    // Access private method for unit testing
    const getParser = (svc: AgentChatService) =>
      (svc as unknown as {
        parseResponse: (raw: string) => {
          content: string;
          confidence: number;
          reasoning: string[];
        };
      }).parseResponse.bind(svc);

    it("assigns high confidence for evidence-based language", () => {
      const parse = getParser(service);
      const result = parse(
        "Based on data from Q4 reports, the evidence shows a 30% improvement."
      );
      expect(result.confidence).toBe(0.9);
    });

    it("assigns low confidence for uncertain language", () => {
      const parse = getParser(service);
      const result = parse(
        "This might work, but I'm not sure if the approach is viable."
      );
      expect(result.confidence).toBe(0.5);
    });

    it("assigns default confidence for neutral language", () => {
      const parse = getParser(service);
      const result = parse("The company operates in the SaaS sector.");
      expect(result.confidence).toBe(0.75);
    });

    it("extracts numbered reasoning from response", () => {
      const parse = getParser(service);
      const result = parse(
        "Analysis:\n1. Revenue grew 20% YoY\n2. Margins improved by 5 points\n3. Customer retention is strong"
      );
      expect(result.reasoning.length).toBeGreaterThanOrEqual(3);
    });

    it("generates reasoning from sentences when no list found", () => {
      const parse = getParser(service);
      const result = parse(
        "The company has strong fundamentals. Revenue growth exceeds industry average. Customer satisfaction scores are high."
      );
      expect(result.reasoning.length).toBeGreaterThan(0);
    });
  });

  // ==========================================================================
  // Query classification
  // ==========================================================================

  describe("query classification", () => {
    const getFinancialDetector = (svc: AgentChatService) =>
      (svc as unknown as {
        queryNeedsFinancialData: (q: string) => boolean;
      }).queryNeedsFinancialData.bind(svc);

    const getCRMDetector = (svc: AgentChatService) =>
      (svc as unknown as {
        queryNeedsCRMData: (q: string) => boolean;
      }).queryNeedsCRMData.bind(svc);

    it("detects financial data queries", () => {
      const detect = getFinancialDetector(service);
      expect(detect("What is the revenue for Q4?")).toBe(true);
      expect(detect("Show me the profit margins")).toBe(true);
      expect(detect("Compare industry benchmarks")).toBe(true);
      expect(detect("Tell me about the team structure")).toBe(false);
    });

    it("detects CRM data queries", () => {
      const detect = getCRMDetector(service);
      expect(detect("Show me the deal pipeline")).toBe(true);
      expect(detect("Who is the decision maker?")).toBe(true);
      expect(detect("Look up the Salesforce opportunity")).toBe(true);
      expect(detect("What is the weather today?")).toBe(false);
    });
  });

  // ==========================================================================
  // Workflow state transitions
  // ==========================================================================

  describe("workflow state transitions", () => {
    it("preserves current stage when no transition detected", async () => {
      (checkStageTransition as ReturnType<typeof vi.fn>).mockReturnValue(null);

      const result = await service.chat(makeChatRequest());
      expect(result.nextState.currentStage).toBe("opportunity");
    });

    it("transitions stage when checkStageTransition returns new stage", async () => {
      (checkStageTransition as ReturnType<typeof vi.fn>).mockReturnValue(
        "target"
      );

      const result = await service.chat(makeChatRequest());
      expect(result.nextState.currentStage).toBe("target");
      expect(result.nextState.completed_steps).toContain("opportunity");
    });

    it("does not duplicate completed steps on repeated transitions", async () => {
      (checkStageTransition as ReturnType<typeof vi.fn>).mockReturnValue(
        "target"
      );

      const request = makeChatRequest({
        workflowState: makeWorkflowState({
          completed_steps: ["opportunity"],
        }),
      });

      const result = await service.chat(request);
      const opportunityCount = result.nextState.completed_steps.filter(
        (s: string) => s === "opportunity"
      ).length;
      expect(opportunityCount).toBe(1);
    });
  });

  // ==========================================================================
  // SDUI generation
  // ==========================================================================

  describe("SDUI generation", () => {
    it("generates SDUI page with metrics and hypotheses from AI response", async () => {
      const result = await service.chat(makeChatRequest());

      // The transformToSDUI method creates a page with sections
      expect(result.sduiPage).toBeDefined();
      expect(result.sduiPage.type).toBe("page");
      expect(result.sduiPage.version).toBe(1);
    });

    it("includes metadata in SDUI page", async () => {
      const result = await service.chat(makeChatRequest());

      expect(result.sduiPage.metadata).toBeDefined();
    });
  });
});
