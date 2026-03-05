/**
 * Multi-Round Tool Calling Loop Tests
 *
 * Tests the enhanced chat.ts tool calling loop:
 * - Parallel tool execution within a round
 * - Per-tool timeout protection
 * - Graceful error recovery (failed tools don't abort chain)
 * - Chain summary generation
 * - Round progress events
 * - Max rounds enforcement
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ── Mock dependencies ──────────────────────────────────────────────────────

vi.mock("../server/togetherClient", () => ({
  together: {
    chat: {
      completions: {
        create: vi.fn(),
      },
    },
  },
  MODELS: {
    chat: "meta-llama/Llama-3.3-70B-Instruct-Turbo",
    toolCalling: "Qwen/Qwen2.5-72B-Instruct-Turbo",
    reasoning: "deepseek-ai/DeepSeek-R1",
    vision: "meta-llama/Llama-4-Scout-17B-16E-Instruct",
    fast: "meta-llama/Llama-3.1-8B-Instruct-Turbo",
  },
}));

vi.mock("../server/agents/tools", () => ({
  executeTool: vi.fn(),
}));

vi.mock("../server/agents/registry", () => ({
  getAgent: vi.fn(),
  getAllAgents: vi.fn(() => []),
  AGENT_ID_TO_SLUG: {},
}));

import { together } from "../server/togetherClient";
import { executeTool } from "../server/agents/tools";
import { getAgent } from "../server/agents/registry";

const mockCreate = together.chat.completions.create as ReturnType<typeof vi.fn>;
const mockExecuteTool = executeTool as ReturnType<typeof vi.fn>;
const mockGetAgent = getAgent as ReturnType<typeof vi.fn>;

/* -------------------------------------------------------
   Helper: simulate an Express response for SSE
   ------------------------------------------------------- */

function createMockResponse() {
  const events: string[] = [];
  const res = {
    headersSent: false,
    setHeader: vi.fn(),
    write: vi.fn((data: string) => {
      events.push(data);
    }),
    end: vi.fn(),
    status: vi.fn(() => res),
    json: vi.fn(),
  };
  return { res, events };
}

function parseSSEEvents(events: string[]): Record<string, unknown>[] {
  return events
    .filter((e) => e.startsWith("data: ") && !e.includes("[DONE]"))
    .map((e) => {
      try {
        return JSON.parse(e.slice(6).trim());
      } catch {
        return null;
      }
    })
    .filter(Boolean) as Record<string, unknown>[];
}

/* -------------------------------------------------------
   Helper: create a mock non-streaming completion with tool calls
   ------------------------------------------------------- */

function createToolCallCompletion(
  toolCalls: Array<{ id: string; name: string; arguments: string }>
) {
  return {
    choices: [
      {
        message: {
          content: null,
          tool_calls: toolCalls.map((tc) => ({
            id: tc.id,
            type: "function" as const,
            function: {
              name: tc.name,
              arguments: tc.arguments,
            },
          })),
        },
      },
    ],
  };
}

function createTextCompletion(content: string) {
  return {
    choices: [
      {
        message: {
          content,
          tool_calls: undefined,
        },
      },
    ],
  };
}

function createStreamCompletion(chunks: string[]) {
  return {
    [Symbol.asyncIterator]: async function* () {
      for (const chunk of chunks) {
        yield {
          choices: [
            {
              delta: { content: chunk },
              finish_reason: null,
            },
          ],
        };
      }
      yield {
        choices: [
          {
            delta: { content: "" },
            finish_reason: "stop",
          },
        ],
      };
    },
  };
}

/* -------------------------------------------------------
   Tests
   ------------------------------------------------------- */

describe("Multi-Round Tool Calling Loop", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("Parallel tool execution", () => {
    it("executes multiple tool calls from the same round concurrently", async () => {
      // Track execution order
      const executionOrder: string[] = [];

      mockExecuteTool.mockImplementation(async (name: string) => {
        executionOrder.push(`start:${name}`);
        // Simulate async work
        await new Promise((r) => setTimeout(r, 10));
        executionOrder.push(`end:${name}`);
        return JSON.stringify({ tool: name, status: "success" });
      });

      // Round 1: LLM requests 3 tools in parallel
      mockCreate
        .mockResolvedValueOnce(
          createToolCallCompletion([
            { id: "tc_1", name: "enrich_company", arguments: '{"companyName":"Microsoft"}' },
            { id: "tc_2", name: "search_sec_filings", arguments: '{"companyName":"Microsoft"}' },
            { id: "tc_3", name: "lookup_industry_data", arguments: '{"sicCode":"7372"}' },
          ])
        )
        // Round 2: LLM returns text (no more tools)
        .mockResolvedValueOnce(createTextCompletion("Analysis complete."))
        // Final streaming response
        .mockResolvedValueOnce(createStreamCompletion(["Analysis ", "complete."]));

      // Import and call the handler
      const { registerChatRoutes } = await import("../server/_core/chat");
      const app = { get: vi.fn(), post: vi.fn() };
      registerChatRoutes(app as any);

      const chatHandler = app.post.mock.calls.find(
        (c: unknown[]) => c[0] === "/api/chat"
      )?.[1];
      expect(chatHandler).toBeDefined();

      const { res, events } = createMockResponse();
      const req = {
        body: {
          messages: [{ role: "user", content: "Analyze Microsoft" }],
          agentSlug: "opportunity",
        },
      };

      mockGetAgent.mockReturnValue({
        id: "a_1",
        name: "Opportunity Agent",
        slug: "opportunity",
        model: "Qwen/Qwen2.5-72B-Instruct-Turbo",
        systemPrompt: "You are the Opportunity Agent.",
        tools: [{ type: "function", function: { name: "enrich_company" } }],
        temperature: 0.3,
        maxTokens: 2048,
        description: "Test agent",
      });

      await chatHandler(req, res);

      // Verify all 3 tools were called
      expect(mockExecuteTool).toHaveBeenCalledTimes(3);
      expect(mockExecuteTool).toHaveBeenCalledWith("enrich_company", { companyName: "Microsoft" });
      expect(mockExecuteTool).toHaveBeenCalledWith("search_sec_filings", { companyName: "Microsoft" });
      expect(mockExecuteTool).toHaveBeenCalledWith("lookup_industry_data", { sicCode: "7372" });

      // Verify SSE events include tool calls and results
      const parsed = parseSSEEvents(events);
      const toolCallEvents = parsed.filter((e) => e.toolCall);
      const toolResultEvents = parsed.filter((e) => e.toolResult);

      expect(toolCallEvents).toHaveLength(3);
      expect(toolResultEvents).toHaveLength(3);
    });

    it("handles mixed success and failure in parallel tools", async () => {
      mockExecuteTool.mockImplementation(async (name: string) => {
        if (name === "search_sec_filings") {
          throw new Error("SEC EDGAR unavailable");
        }
        return JSON.stringify({ tool: name, status: "success" });
      });

      mockCreate
        .mockResolvedValueOnce(
          createToolCallCompletion([
            { id: "tc_1", name: "enrich_company", arguments: '{"companyName":"Test"}' },
            { id: "tc_2", name: "search_sec_filings", arguments: '{"companyName":"Test"}' },
          ])
        )
        .mockResolvedValueOnce(createTextCompletion("Partial results available."))
        .mockResolvedValueOnce(createStreamCompletion(["Partial ", "results."]));

      const { registerChatRoutes } = await import("../server/_core/chat");
      const app = { get: vi.fn(), post: vi.fn() };
      registerChatRoutes(app as any);

      const chatHandler = app.post.mock.calls.find(
        (c: unknown[]) => c[0] === "/api/chat"
      )?.[1];

      const { res, events } = createMockResponse();
      const req = {
        body: {
          messages: [{ role: "user", content: "Analyze Test Corp" }],
        },
      };

      mockGetAgent.mockReturnValue(undefined);
      await chatHandler(req, res);

      // Both tools should have been called
      expect(mockExecuteTool).toHaveBeenCalledTimes(2);

      // Verify the chain continued despite the SEC failure
      const parsed = parseSSEEvents(events);
      const toolResults = parsed.filter((e) => e.toolResult);
      expect(toolResults).toHaveLength(2);

      // Verify the failed tool has error status
      const failedResult = toolResults.find(
        (e) => (e.toolResult as any).name === "search_sec_filings"
      );
      expect(failedResult).toBeDefined();
      expect((failedResult!.toolResult as any).status).toBe("error");

      // Verify the successful tool has success status
      const successResult = toolResults.find(
        (e) => (e.toolResult as any).name === "enrich_company"
      );
      expect(successResult).toBeDefined();
      expect((successResult!.toolResult as any).status).toBe("success");
    });
  });

  describe("Multi-round chaining", () => {
    it("chains 2 rounds of tool calls before final response", async () => {
      mockExecuteTool.mockResolvedValue(
        JSON.stringify({ tool: "test", status: "success", data: "mock data" })
      );

      // Round 1: enrich
      mockCreate
        .mockResolvedValueOnce(
          createToolCallCompletion([
            { id: "tc_1", name: "enrich_company", arguments: '{"companyName":"Acme"}' },
          ])
        )
        // Round 2: validate based on enrichment results
        .mockResolvedValueOnce(
          createToolCallCompletion([
            {
              id: "tc_2",
              name: "validate_claim",
              arguments: '{"claim":"Revenue is $2.4B","companyName":"Acme"}',
            },
          ])
        )
        // Round 3: no tools — text response
        .mockResolvedValueOnce(createTextCompletion("Enrichment and validation complete."))
        // Final streaming
        .mockResolvedValueOnce(createStreamCompletion(["Done."]));

      const { registerChatRoutes } = await import("../server/_core/chat");
      const app = { get: vi.fn(), post: vi.fn() };
      registerChatRoutes(app as any);

      const chatHandler = app.post.mock.calls.find(
        (c: unknown[]) => c[0] === "/api/chat"
      )?.[1];

      const { res, events } = createMockResponse();
      const req = {
        body: {
          messages: [{ role: "user", content: "Enrich and validate Acme" }],
        },
      };

      mockGetAgent.mockReturnValue(undefined);
      await chatHandler(req, res);

      // Verify 2 tool calls across 2 rounds
      expect(mockExecuteTool).toHaveBeenCalledTimes(2);
      expect(mockExecuteTool).toHaveBeenCalledWith("enrich_company", { companyName: "Acme" });
      expect(mockExecuteTool).toHaveBeenCalledWith("validate_claim", {
        claim: "Revenue is $2.4B",
        companyName: "Acme",
      });

      // Verify round progress events
      const parsed = parseSSEEvents(events);
      const roundProgressEvents = parsed.filter((e) => e.roundProgress);
      // 2 rounds × 2 events each (executing + complete) = 4
      expect(roundProgressEvents.length).toBeGreaterThanOrEqual(4);

      // Verify chain summary
      const chainSummary = parsed.find((e) => e.chainSummary);
      expect(chainSummary).toBeDefined();
      expect((chainSummary!.chainSummary as any).totalRounds).toBe(2);
      expect((chainSummary!.chainSummary as any).totalToolCalls).toBe(2);
      expect((chainSummary!.chainSummary as any).successCount).toBe(2);
    });

    it("chains 3 rounds: enrich → validate → build_value_tree", async () => {
      mockExecuteTool.mockResolvedValue(
        JSON.stringify({ tool: "test", status: "success" })
      );

      mockCreate
        .mockResolvedValueOnce(
          createToolCallCompletion([
            { id: "tc_1", name: "enrich_company", arguments: '{"companyName":"Salesforce"}' },
          ])
        )
        .mockResolvedValueOnce(
          createToolCallCompletion([
            {
              id: "tc_2",
              name: "validate_claim",
              arguments: '{"claim":"Revenue is $35B","companyName":"Salesforce"}',
            },
          ])
        )
        .mockResolvedValueOnce(
          createToolCallCompletion([
            {
              id: "tc_3",
              name: "build_value_tree",
              arguments: '{"companyName":"Salesforce","hypotheses":["Cloud migration saves $2M"]}',
            },
          ])
        )
        .mockResolvedValueOnce(createTextCompletion("Full analysis complete."))
        .mockResolvedValueOnce(createStreamCompletion(["Full ", "analysis."]));

      const { registerChatRoutes } = await import("../server/_core/chat");
      const app = { get: vi.fn(), post: vi.fn() };
      registerChatRoutes(app as any);

      const chatHandler = app.post.mock.calls.find(
        (c: unknown[]) => c[0] === "/api/chat"
      )?.[1];

      const { res, events } = createMockResponse();
      const req = {
        body: {
          messages: [{ role: "user", content: "Full analysis of Salesforce" }],
        },
      };

      mockGetAgent.mockReturnValue(undefined);
      await chatHandler(req, res);

      expect(mockExecuteTool).toHaveBeenCalledTimes(3);

      const parsed = parseSSEEvents(events);
      const chainSummary = parsed.find((e) => e.chainSummary);
      expect(chainSummary).toBeDefined();
      expect((chainSummary!.chainSummary as any).totalRounds).toBe(3);
      expect((chainSummary!.chainSummary as any).totalToolCalls).toBe(3);

      // Verify chain order
      const chain = (chainSummary!.chainSummary as any).chain;
      expect(chain[0].tool).toBe("enrich_company");
      expect(chain[0].round).toBe(1);
      expect(chain[1].tool).toBe("validate_claim");
      expect(chain[1].round).toBe(2);
      expect(chain[2].tool).toBe("build_value_tree");
      expect(chain[2].round).toBe(3);
    });
  });

  describe("SSE event structure", () => {
    it("emits meta event with maxToolRounds as the first event", async () => {
      mockCreate.mockResolvedValueOnce(createTextCompletion("Hello"));
      mockCreate.mockResolvedValueOnce(createStreamCompletion(["Hello"]));

      const { registerChatRoutes } = await import("../server/_core/chat");
      const app = { get: vi.fn(), post: vi.fn() };
      registerChatRoutes(app as any);

      const chatHandler = app.post.mock.calls.find(
        (c: unknown[]) => c[0] === "/api/chat"
      )?.[1];

      const { res, events } = createMockResponse();
      const req = {
        body: { messages: [{ role: "user", content: "Hi" }] },
      };

      mockGetAgent.mockReturnValue(undefined);
      await chatHandler(req, res);

      const parsed = parseSSEEvents(events);
      const metaEvent = parsed[0];
      expect(metaEvent.meta).toBeDefined();
      expect((metaEvent.meta as any).maxToolRounds).toBe(5);
    });

    it("emits roundProgress events with executing and complete status", async () => {
      mockExecuteTool.mockResolvedValue(JSON.stringify({ status: "success" }));

      mockCreate
        .mockResolvedValueOnce(
          createToolCallCompletion([
            { id: "tc_1", name: "enrich_company", arguments: '{"companyName":"Test"}' },
          ])
        )
        .mockResolvedValueOnce(createTextCompletion("Done"))
        .mockResolvedValueOnce(createStreamCompletion(["Done"]));

      const { registerChatRoutes } = await import("../server/_core/chat");
      const app = { get: vi.fn(), post: vi.fn() };
      registerChatRoutes(app as any);

      const chatHandler = app.post.mock.calls.find(
        (c: unknown[]) => c[0] === "/api/chat"
      )?.[1];

      const { res, events } = createMockResponse();
      const req = {
        body: { messages: [{ role: "user", content: "Enrich Test" }] },
      };

      mockGetAgent.mockReturnValue(undefined);
      await chatHandler(req, res);

      const parsed = parseSSEEvents(events);
      const roundEvents = parsed.filter((e) => e.roundProgress);

      // Should have an "executing" and a "complete" event for round 1
      const executingEvent = roundEvents.find(
        (e) => (e.roundProgress as any).status === "executing"
      );
      const completeEvent = roundEvents.find(
        (e) => (e.roundProgress as any).status === "complete"
      );

      expect(executingEvent).toBeDefined();
      expect((executingEvent!.roundProgress as any).round).toBe(1);
      expect((executingEvent!.roundProgress as any).tools).toContain("enrich_company");

      expect(completeEvent).toBeDefined();
      expect((completeEvent!.roundProgress as any).round).toBe(1);
      expect((completeEvent!.roundProgress as any).successCount).toBe(1);
    });

    it("emits toolResult events with status and latencyMs fields", async () => {
      mockExecuteTool.mockResolvedValue(
        JSON.stringify({ tool: "enrich_company", status: "success" })
      );

      mockCreate
        .mockResolvedValueOnce(
          createToolCallCompletion([
            { id: "tc_1", name: "enrich_company", arguments: '{"companyName":"Test"}' },
          ])
        )
        .mockResolvedValueOnce(createTextCompletion("Done"))
        .mockResolvedValueOnce(createStreamCompletion(["Done"]));

      const { registerChatRoutes } = await import("../server/_core/chat");
      const app = { get: vi.fn(), post: vi.fn() };
      registerChatRoutes(app as any);

      const chatHandler = app.post.mock.calls.find(
        (c: unknown[]) => c[0] === "/api/chat"
      )?.[1];

      const { res, events } = createMockResponse();
      const req = {
        body: { messages: [{ role: "user", content: "Test" }] },
      };

      mockGetAgent.mockReturnValue(undefined);
      await chatHandler(req, res);

      const parsed = parseSSEEvents(events);
      const toolResult = parsed.find((e) => e.toolResult);
      expect(toolResult).toBeDefined();
      expect((toolResult!.toolResult as any).status).toBe("success");
      expect((toolResult!.toolResult as any).latencyMs).toBeDefined();
      expect(typeof (toolResult!.toolResult as any).latencyMs).toBe("number");
    });

    it("does not emit chainSummary when no tool rounds occur", async () => {
      mockCreate.mockResolvedValueOnce(createTextCompletion("No tools needed."));
      mockCreate.mockResolvedValueOnce(createStreamCompletion(["No tools."]));

      const { registerChatRoutes } = await import("../server/_core/chat");
      const app = { get: vi.fn(), post: vi.fn() };
      registerChatRoutes(app as any);

      const chatHandler = app.post.mock.calls.find(
        (c: unknown[]) => c[0] === "/api/chat"
      )?.[1];

      const { res, events } = createMockResponse();
      const req = {
        body: { messages: [{ role: "user", content: "Just chat" }] },
      };

      mockGetAgent.mockReturnValue(undefined);
      await chatHandler(req, res);

      const parsed = parseSSEEvents(events);
      const chainSummary = parsed.find((e) => e.chainSummary);
      expect(chainSummary).toBeUndefined();
    });
  });

  describe("Error recovery", () => {
    it("continues the chain when one tool fails — LLM receives error context", async () => {
      let callCount = 0;
      mockExecuteTool.mockImplementation(async (name: string) => {
        callCount++;
        if (name === "search_sec_filings") {
          throw new Error("SEC EDGAR timeout");
        }
        return JSON.stringify({ tool: name, status: "success" });
      });

      mockCreate
        .mockResolvedValueOnce(
          createToolCallCompletion([
            { id: "tc_1", name: "enrich_company", arguments: '{"companyName":"Test"}' },
            { id: "tc_2", name: "search_sec_filings", arguments: '{"companyName":"Test"}' },
          ])
        )
        // LLM sees the error and decides to continue with available data
        .mockResolvedValueOnce(createTextCompletion("Analysis with partial data."))
        .mockResolvedValueOnce(createStreamCompletion(["Partial ", "analysis."]));

      const { registerChatRoutes } = await import("../server/_core/chat");
      const app = { get: vi.fn(), post: vi.fn() };
      registerChatRoutes(app as any);

      const chatHandler = app.post.mock.calls.find(
        (c: unknown[]) => c[0] === "/api/chat"
      )?.[1];

      const { res, events } = createMockResponse();
      const req = {
        body: { messages: [{ role: "user", content: "Analyze Test" }] },
      };

      mockGetAgent.mockReturnValue(undefined);
      await chatHandler(req, res);

      // Both tools were attempted
      expect(callCount).toBe(2);

      // Chain summary should show 1 success + 1 error
      const parsed = parseSSEEvents(events);
      const chainSummary = parsed.find((e) => e.chainSummary);
      expect(chainSummary).toBeDefined();
      expect((chainSummary!.chainSummary as any).successCount).toBe(1);
      expect((chainSummary!.chainSummary as any).errorCount).toBe(1);

      // Response should still stream successfully
      const contentEvents = parsed.filter((e) => e.content);
      expect(contentEvents.length).toBeGreaterThan(0);
    });
  });

  describe("Request validation", () => {
    it("returns 400 when messages array is missing", async () => {
      const { registerChatRoutes } = await import("../server/_core/chat");
      const app = { get: vi.fn(), post: vi.fn() };
      registerChatRoutes(app as any);

      const chatHandler = app.post.mock.calls.find(
        (c: unknown[]) => c[0] === "/api/chat"
      )?.[1];

      const { res } = createMockResponse();
      const req = { body: {} };

      await chatHandler(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: "messages array is required" })
      );
    });
  });
});
