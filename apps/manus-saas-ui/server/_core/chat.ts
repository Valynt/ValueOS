/**
 * Chat API Handler — Together.ai with Agent Routing
 *
 * Express endpoint for streaming chat with ValueOS agents.
 * Routes to the correct agent based on `agentId` parameter,
 * applying the agent's system prompt, tools, and model.
 *
 * Supports the Together.ai tool-calling loop:
 * 1. Send user message with agent's tools
 * 2. If response includes tool_calls, execute them
 * 3. Feed tool results back and continue until text response
 * 4. Stream final text response via SSE
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
- When a task is better suited for a specialist agent, recommend switching.`;

const MAX_TOOL_ROUNDS = 5;

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
      tools: (a.tools.filter((t): t is ChatCompletionFunctionTool => t.type === 'function') as ChatCompletionFunctionTool[])
        .map((t) => ({
          name: t.function.name,
          description: t.function.description,
        })),
    }));
    res.json({ agents });
  });

  /* -------------------------------------------------------
     POST /api/chat — streaming chat with agent routing
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
      res.write(
        `data: ${JSON.stringify({
          meta: {
            agent: agent
              ? { id: agent.id, name: agent.name, slug: agent.slug, model: agent.model }
              : { id: "architect", name: "Value Architect", slug: "architect", model },
          },
        })}\n\n`
      );

      // Tool-calling loop: execute tools and feed results back
      let toolRound = 0;
      let currentMessages = [...conversationMessages];

      while (toolRound < MAX_TOOL_ROUNDS) {
        // Make a non-streaming call first to check for tool calls
        const completion = await together.chat.completions.create({
          model,
          messages: currentMessages,
          tools: tools.length > 0 ? tools : undefined,
          temperature,
          max_tokens: maxTokens,
          stream: false,
        });

        const choice = completion.choices[0];
        const toolCalls = choice?.message?.tool_calls;

        // Filter to function tool calls only (Together.ai uses function type)
        const functionToolCalls = toolCalls?.filter(
          (tc): tc is ChatCompletionMessageFunctionToolCall => tc.type === "function"
        );

        if (functionToolCalls && functionToolCalls.length > 0) {
          // Agent wants to call tools — execute them
          toolRound++;

          // Send tool call events to the client for visibility
          for (const tc of functionToolCalls) {
            res.write(
              `data: ${JSON.stringify({
                toolCall: {
                  id: tc.id,
                  name: tc.function.name,
                  arguments: tc.function.arguments,
                  round: toolRound,
                },
              })}\n\n`
            );
          }

          // Add the assistant's tool-call message to conversation
          currentMessages.push({
            role: "assistant",
            content: choice.message.content || null,
            tool_calls: functionToolCalls,
          } as ChatCompletionMessageParam);

          // Execute each tool and add results
          for (const tc of functionToolCalls) {
            let args: Record<string, unknown> = {};
            try {
              args = JSON.parse(tc.function.arguments || "{}");
            } catch {
              args = {};
            }

            const result = await executeTool(tc.function.name, args);

            // Send tool result event
            res.write(
              `data: ${JSON.stringify({
                toolResult: {
                  id: tc.id,
                  name: tc.function.name,
                  result: result.slice(0, 500), // Truncated preview for client
                  round: toolRound,
                },
              })}\n\n`
            );

            const toolMessage: ChatCompletionToolMessageParam = {
              role: "tool",
              tool_call_id: tc.id,
              content: result,
            };
            currentMessages.push(toolMessage);
          }

          // Continue the loop — the LLM will process tool results
          continue;
        }

        // No tool calls — this is the final text response. Stream it.
        // We need to make a streaming call now with the full conversation
        const stream = await together.chat.completions.create({
          model,
          messages: currentMessages,
          temperature,
          max_tokens: maxTokens,
          stream: true,
        });

        for await (const chunk of stream) {
          const delta = chunk.choices?.[0]?.delta?.content;
          if (delta) {
            res.write(`data: ${JSON.stringify({ content: delta })}\n\n`);
          }

          const finishReason = chunk.choices?.[0]?.finish_reason;
          if (finishReason) {
            res.write(
              `data: ${JSON.stringify({ done: true, finishReason, toolRounds: toolRound })}\n\n`
            );
          }
        }

        break; // Exit the tool loop
      }

      // If we exhausted tool rounds, send a warning
      if (toolRound >= MAX_TOOL_ROUNDS) {
        res.write(
          `data: ${JSON.stringify({
            content:
              "\n\n*[Tool execution limit reached. Some operations may be incomplete.]*",
          })}\n\n`
        );
        res.write(`data: ${JSON.stringify({ done: true, finishReason: "tool_limit" })}\n\n`);
      }

      res.write("data: [DONE]\n\n");
      res.end();
    } catch (error) {
      console.error("[/api/chat] Error:", error);
      if (!res.headersSent) {
        res.status(500).json({ error: "Internal server error" });
      } else {
        res.write(
          `data: ${JSON.stringify({ error: "Stream interrupted" })}\n\n`
        );
        res.end();
      }
    }
  });
}
