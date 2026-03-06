/**
 * Chat API Handler — Together.ai with Multi-Round Agent Tool Calling
 *
 * Express endpoint for streaming chat with ValueOS agents.
 * Routes to the correct agent based on `agentId` parameter,
 * applying the agent's system prompt, tools, and model.
 *
 * Multi-round tool calling loop:
 * 1. Send user message with agent's tools
 * 2. If response includes tool_calls, execute them in parallel
 * 3. Feed tool results back and continue until text response
 * 4. Stream final text response via SSE
 * 5. Emit chain summary after all rounds complete
 *
 * Features:
 * - Parallel tool execution within each round
 * - Per-tool timeout protection (30s default)
 * - Graceful error recovery — failed tools don't abort the chain
 * - Round progress events for frontend visibility
 * - Chain summary event after all tool rounds complete
 */

import type { Express, Request, Response } from "express";
import { together } from "../togetherClient";
import {
  getAgent,
  getAllAgents,
  AGENT_ID_TO_SLUG,
  type AgentDefinition,
} from "../agents/registry";
import { executeTool } from "../agents/tools";
import type {
  ChatCompletionMessageParam,
  ChatCompletionToolMessageParam,
  ChatCompletionMessageFunctionToolCall,
  ChatCompletionFunctionTool,
} from "openai/resources/chat/completions";

/** Default system prompt when no specific agent is selected */
const VALUE_ARCHITECT_PROMPT = `You are the VALYNT Value Architect, an expert AI assistant embedded in the ValueOS enterprise value engineering platform.

Your role is to help users:
- Build and refine business cases for technology investments
- Analyze company data from SEC filings, BLS labor statistics, and Census economic data
- Identify value engineering opportunities and quantify ROI
- Validate value hypotheses against source data
- Summarize case progress and suggest next steps

Context about the platform:
- ValueOS manages "Value Cases" — structured analyses of enterprise technology deals
- Each case goes through stages: Opportunity → Research → Integrity → Target
- The enrichment pipeline pulls data from SEC EDGAR, Yahoo Finance, LinkedIn, BLS, and Census
- Integrity checks validate that claims are supported by source data
- Users are enterprise sales engineers and value consultants

Available specialist agents (suggest these when appropriate):
- Opportunity Agent: Data extraction and opportunity identification
- Research Agent: Deep competitive analysis and market research
- Integrity Agent: Claim validation and evidence classification
- Target Agent: Value tree modeling and ROI projections
- Narrative Agent: Executive-ready business writing
- Red Team Agent: Adversarial stress-testing of value cases

Guidelines:
- Be concise and data-driven. Avoid generic advice.
- When discussing financial metrics, use specific numbers when available.
- If you don't have enough context, ask clarifying questions.
- Format responses with markdown for readability.
- Never fabricate financial data.
- Keep responses under 300 words unless the user asks for a deep dive.
- When a task is better suited for a specialist agent, recommend switching.
- When you need data, use your tools proactively — chain multiple tool calls to gather, validate, and analyze in a single turn.`;

const MAX_TOOL_ROUNDS = 5;
const TOOL_TIMEOUT_MS = 30_000; // 30 seconds per tool call
const ROUND_TIMEOUT_MS = 60_000; // 60 seconds per round (all tools combined)

/* -------------------------------------------------------
   Tool execution with timeout
   ------------------------------------------------------- */

interface ToolExecutionResult {
  toolCallId: string;
  toolName: string;
  result: string;
  latencyMs: number;
  status: "success" | "error" | "timeout";
}

/**
 * Execute a single tool call with timeout protection.
 */
async function executeToolWithTimeout(
  toolCallId: string,
  toolName: string,
  args: Record<string, unknown>,
  timeoutMs: number = TOOL_TIMEOUT_MS
): Promise<ToolExecutionResult> {
  const startMs = Date.now();

  try {
    const result = await Promise.race([
      executeTool(toolName, args),
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error(`Tool "${toolName}" timed out after ${timeoutMs}ms`)),
          timeoutMs
        )
      ),
    ]);

    return {
      toolCallId,
      toolName,
      result,
      latencyMs: Date.now() - startMs,
      status: "success",
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Tool execution failed";
    const isTimeout = msg.includes("timed out");
    console.error(`[Tool Loop] ${toolName} ${isTimeout ? "TIMEOUT" : "ERROR"}: ${msg}`);

    return {
      toolCallId,
      toolName,
      result: JSON.stringify({
        error: msg,
        tool: toolName,
        status: isTimeout ? "timeout" : "error",
      }),
      latencyMs: Date.now() - startMs,
      status: isTimeout ? "timeout" : "error",
    };
  }
}

/**
 * Execute multiple tool calls in parallel with a round-level timeout.
 */
async function executeToolsInParallel(
  toolCalls: Array<{
    id: string;
    name: string;
    args: Record<string, unknown>;
  }>,
  roundTimeoutMs: number = ROUND_TIMEOUT_MS
): Promise<ToolExecutionResult[]> {
  const executions = toolCalls.map((tc) =>
    executeToolWithTimeout(tc.id, tc.name, tc.args)
  );

  try {
    const results = await Promise.race([
      Promise.allSettled(executions),
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error(`Round timed out after ${roundTimeoutMs}ms`)),
          roundTimeoutMs
        )
      ),
    ]);

    return results.map((r, i) => {
      if (r.status === "fulfilled") return r.value;
      return {
        toolCallId: toolCalls[i].id,
        toolName: toolCalls[i].name,
        result: JSON.stringify({
          error: r.reason?.message || "Tool execution failed",
          tool: toolCalls[i].name,
          status: "error",
        }),
        latencyMs: 0,
        status: "error" as const,
      };
    });
  } catch {
    // Round-level timeout — return timeout results for all pending tools
    return toolCalls.map((tc) => ({
      toolCallId: tc.id,
      toolName: tc.name,
      result: JSON.stringify({
        error: `Round timed out after ${roundTimeoutMs}ms`,
        tool: tc.name,
        status: "timeout",
      }),
      latencyMs: roundTimeoutMs,
      status: "timeout" as const,
    }));
  }
}

/* -------------------------------------------------------
   SSE event helpers
   ------------------------------------------------------- */

function sendSSE(res: Response, data: Record<string, unknown>) {
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

/* -------------------------------------------------------
   Chain summary types
   ------------------------------------------------------- */

interface ToolChainStep {
  round: number;
  toolName: string;
  status: "success" | "error" | "timeout";
  latencyMs: number;
}

/**
 * Registers the /api/chat endpoint for streaming AI responses
 * and /api/agents for listing available agents.
 */
export function registerChatRoutes(app: Express) {
  /* -------------------------------------------------------
     GET /api/agents — list all available agents
     ------------------------------------------------------- */
  app.get("/api/agents", (_req: Request, res: Response) => {
    const agents = getAllAgents().map((a) => ({
      id: a.id,
      slug: a.slug,
      name: a.name,
      description: a.description,
      model: a.model,
      toolCount: a.tools.length,
      tools: (
        a.tools.filter(
          (t): t is ChatCompletionFunctionTool => t.type === "function"
        ) as ChatCompletionFunctionTool[]
      ).map((t) => ({
        name: t.function.name,
        description: t.function.description,
      })),
    }));
    res.json({ agents });
  });

  /* -------------------------------------------------------
     POST /api/chat — streaming chat with multi-round tool calling
     ------------------------------------------------------- */
  app.post("/api/chat", async (req: Request, res: Response) => {
    try {
      const { messages, agentId, agentSlug } = req.body;

      if (!messages || !Array.isArray(messages)) {
        res.status(400).json({ error: "messages array is required" });
        return;
      }

      // Resolve the agent — by slug, by ID, or fall back to Value Architect
      let agent: AgentDefinition | undefined;
      if (agentSlug) {
        agent = getAgent(agentSlug);
      } else if (agentId) {
        const slug = AGENT_ID_TO_SLUG[agentId];
        if (slug) agent = getAgent(slug);
      }

      const systemPrompt = agent?.systemPrompt || VALUE_ARCHITECT_PROMPT;
      const model = agent?.model || "meta-llama/Llama-3.3-70B-Instruct-Turbo";
      const tools = agent?.tools || [];
      const temperature = agent?.temperature ?? 0.7;
      const maxTokens = agent?.maxTokens ?? 1024;

      // Build the conversation
      const conversationMessages: ChatCompletionMessageParam[] = [
        { role: "system", content: systemPrompt },
        ...messages.map((m: { role: string; content: string }) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
      ];

      // Set SSE headers for streaming
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.setHeader("X-Accel-Buffering", "no");

      // Send agent metadata as the first event
      sendSSE(res, {
        meta: {
          agent: agent
            ? {
                id: agent.id,
                name: agent.name,
                slug: agent.slug,
                model: agent.model,
              }
            : {
                id: "architect",
                name: "Value Architect",
                slug: "architect",
                model,
              },
          maxToolRounds: MAX_TOOL_ROUNDS,
        },
      });

      // ── Multi-round tool calling loop ──────────────────────────
      let toolRound = 0;
      let currentMessages = [...conversationMessages];
      const chainSteps: ToolChainStep[] = [];
      const totalStartMs = Date.now();

      while (toolRound < MAX_TOOL_ROUNDS) {
        // Single streaming call — accumulate tool_calls deltas or stream text directly.
        // This avoids the previous pattern of a non-streaming probe call followed by a
        // second streaming call, which doubled latency on every non-tool turn.
        const stream = await together.chat.completions.create({
          model,
          messages: currentMessages,
          tools: tools.length > 0 ? tools : undefined,
          temperature,
          max_tokens: maxTokens,
          stream: true,
        });

        // Accumulators for the streamed response
        let assistantContent = "";
        const toolCallAccumulator: Record<
          number,
          { id: string; name: string; arguments: string }
        > = {};
        let finishReason: string | null = null;

        for await (const chunk of stream) {
          const delta = chunk.choices?.[0]?.delta;
          const chunkFinishReason = chunk.choices?.[0]?.finish_reason;

          if (chunkFinishReason) {
            finishReason = chunkFinishReason;
          }

          if (delta?.content) {
            assistantContent += delta.content;
            // Stream text tokens to the client immediately
            sendSSE(res, { content: delta.content });
          }

          // Accumulate tool_calls deltas (index-keyed, arguments arrive in fragments)
          if (delta?.tool_calls) {
            for (const tc of delta.tool_calls) {
              const idx = tc.index ?? 0;
              if (!toolCallAccumulator[idx]) {
                toolCallAccumulator[idx] = { id: tc.id ?? "", name: "", arguments: "" };
              }
              if (tc.id) toolCallAccumulator[idx].id = tc.id;
              if (tc.function?.name) toolCallAccumulator[idx].name += tc.function.name;
              if (tc.function?.arguments) toolCallAccumulator[idx].arguments += tc.function.arguments;
            }
          }
        }

        const accumulatedToolCalls = Object.values(toolCallAccumulator);
        const functionToolCalls: ChatCompletionMessageFunctionToolCall[] =
          accumulatedToolCalls
            .filter((tc) => tc.name)
            .map((tc) => ({
              id: tc.id,
              type: "function" as const,
              function: { name: tc.name, arguments: tc.arguments },
            }));

        const hasToolCalls =
          finishReason === "tool_calls" || functionToolCalls.length > 0;

        if (!hasToolCalls) {
          // ── No tool calls — text was already streamed above ──────

          // If we had tool rounds, emit the chain summary
          if (toolRound > 0) {
            const totalLatencyMs = Date.now() - totalStartMs;
            const successCount = chainSteps.filter(
              (s) => s.status === "success"
            ).length;
            const errorCount = chainSteps.filter(
              (s) => s.status === "error" || s.status === "timeout"
            ).length;

            sendSSE(res, {
              chainSummary: {
                totalRounds: toolRound,
                totalToolCalls: chainSteps.length,
                successCount,
                errorCount,
                totalLatencyMs,
                chain: chainSteps.map((s) => ({
                  round: s.round,
                  tool: s.toolName,
                  status: s.status,
                  latencyMs: s.latencyMs,
                })),
              },
            });
          }

          sendSSE(res, {
            done: true,
            finishReason: finishReason ?? "stop",
            toolRounds: toolRound,
          });

          break; // Exit the tool loop
        }

        // ── Agent wants to call tools — execute them ──────────────
        toolRound++;

        // Emit round progress event
        sendSSE(res, {
          roundProgress: {
            round: toolRound,
            maxRounds: MAX_TOOL_ROUNDS,
            toolCount: functionToolCalls.length,
            tools: functionToolCalls.map((tc) => tc.function.name),
            status: "executing",
          },
        });

        // Send individual tool call events for visibility
        for (const tc of functionToolCalls) {
          sendSSE(res, {
            toolCall: {
              id: tc.id,
              name: tc.function.name,
              arguments: tc.function.arguments,
              round: toolRound,
            },
          });
        }

        // Add the assistant's tool-call message to conversation
        currentMessages.push({
          role: "assistant",
          content: assistantContent || null,
          tool_calls: functionToolCalls,
        } as ChatCompletionMessageParam);

        // Parse arguments for all tool calls
        const toolCallsWithArgs = functionToolCalls.map((tc) => {
          let args: Record<string, unknown> = {};
          try {
            args = JSON.parse(tc.function.arguments || "{}");
          } catch {
            args = {};
          }
          return { id: tc.id, name: tc.function.name, args };
        });

        // Execute all tools in parallel with timeout protection
        const results = await executeToolsInParallel(toolCallsWithArgs);

        // Process results — add to conversation and emit events
        for (const execResult of results) {
          // Track in chain steps
          chainSteps.push({
            round: toolRound,
            toolName: execResult.toolName,
            status: execResult.status,
            latencyMs: execResult.latencyMs,
          });

          // Send tool result event to client
          sendSSE(res, {
            toolResult: {
              id: execResult.toolCallId,
              name: execResult.toolName,
              result: execResult.result.slice(0, 500), // Truncated preview
              status: execResult.status,
              latencyMs: execResult.latencyMs,
              round: toolRound,
            },
          });

          // Add tool result to conversation for the LLM
          const toolMessage: ChatCompletionToolMessageParam = {
            role: "tool",
            tool_call_id: execResult.toolCallId,
            content: execResult.result,
          };
          currentMessages.push(toolMessage);
        }

        // Emit round completion event
        const roundSuccessCount = results.filter(
          (r) => r.status === "success"
        ).length;
        const roundErrorCount = results.filter(
          (r) => r.status !== "success"
        ).length;

        sendSSE(res, {
          roundProgress: {
            round: toolRound,
            maxRounds: MAX_TOOL_ROUNDS,
            toolCount: results.length,
            successCount: roundSuccessCount,
            errorCount: roundErrorCount,
            status: "complete",
          },
        });

        console.log(
          `[Tool Loop] Round ${toolRound}/${MAX_TOOL_ROUNDS}: ${results.length} tools executed (${roundSuccessCount} success, ${roundErrorCount} errors)`
        );

        // Continue the loop — the LLM will process tool results
        continue;
      }

      // If we exhausted tool rounds, send a warning and chain summary
      if (toolRound >= MAX_TOOL_ROUNDS) {
        const totalLatencyMs = Date.now() - totalStartMs;
        const successCount = chainSteps.filter(
          (s) => s.status === "success"
        ).length;
        const errorCount = chainSteps.filter(
          (s) => s.status !== "success"
        ).length;

        sendSSE(res, {
          chainSummary: {
            totalRounds: toolRound,
            totalToolCalls: chainSteps.length,
            successCount,
            errorCount,
            totalLatencyMs,
            chain: chainSteps.map((s) => ({
              round: s.round,
              tool: s.toolName,
              status: s.status,
              latencyMs: s.latencyMs,
            })),
            limitReached: true,
          },
        });

        // Make one final streaming call with all the tool context
        const stream = await together.chat.completions.create({
          model,
          messages: [
            ...currentMessages,
            {
              role: "system",
              content:
                "You have reached the maximum number of tool calling rounds. Synthesize all the tool results you have gathered so far into a comprehensive response. Note any operations that may be incomplete.",
            },
          ],
          temperature,
          max_tokens: maxTokens,
          stream: true,
        });

        for await (const chunk of stream) {
          const delta = chunk.choices?.[0]?.delta?.content;
          if (delta) {
            sendSSE(res, { content: delta });
          }

          const finishReason = chunk.choices?.[0]?.finish_reason;
          if (finishReason) {
            sendSSE(res, {
              done: true,
              finishReason: "tool_limit",
              toolRounds: toolRound,
            });
          }
        }
      }

      sendSSE(res, { type: "done" });
      res.write("data: [DONE]\n\n");
      res.end();
    } catch (error) {
      console.error("[/api/chat] Error:", error);
      if (!res.headersSent) {
        res.status(500).json({ error: "Internal server error" });
      } else {
        sendSSE(res, { error: "Stream interrupted" });
        res.end();
      }
    }
  });
}
