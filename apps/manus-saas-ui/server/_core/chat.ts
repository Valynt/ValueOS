/**
 * Chat API Handler — Together.ai
 *
 * Express endpoint for streaming chat with the Value Architect agent.
 * Uses Together.ai's OpenAI-compatible API via the shared client.
 *
 * Streams Server-Sent Events (SSE) with delta tokens for real-time
 * rendering in the AgentChatSidebar.
 */

import type { Express, Request, Response } from "express";
import { together, MODELS } from "../togetherClient";

/**
 * ValueOS system prompt for the Value Architect — the conversational
 * assistant that lives in the sidebar panel.
 */
const VALUE_ARCHITECT_SYSTEM_PROMPT = `You are the VALYNT Value Architect, an expert AI assistant embedded in the ValueOS enterprise value engineering platform.

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

Guidelines:
- Be concise and data-driven. Avoid generic advice.
- When discussing financial metrics, use specific numbers when available.
- If you don't have enough context, ask clarifying questions.
- Format responses with markdown for readability (bold key metrics, use tables for comparisons).
- Never fabricate financial data — say "I'd need to check the enrichment data" if unsure.
- Keep responses under 300 words unless the user asks for a deep dive.`;

/**
 * Registers the /api/chat endpoint for streaming AI responses.
 * Uses Together.ai's OpenAI-compatible streaming API.
 */
export function registerChatRoutes(app: Express) {
  app.post("/api/chat", async (req: Request, res: Response) => {
    try {
      const { messages } = req.body;

      if (!messages || !Array.isArray(messages)) {
        res.status(400).json({ error: "messages array is required" });
        return;
      }

      // Set SSE headers for streaming
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.setHeader("X-Accel-Buffering", "no");

      const stream = await together.chat.completions.create({
        model: MODELS.chat,
        messages: [
          { role: "system", content: VALUE_ARCHITECT_SYSTEM_PROMPT },
          ...messages.map((m: { role: string; content: string }) => ({
            role: m.role as "user" | "assistant",
            content: m.content,
          })),
        ],
        stream: true,
        max_tokens: 1024,
        temperature: 0.7,
        top_p: 0.9,
      });

      for await (const chunk of stream) {
        const delta = chunk.choices?.[0]?.delta?.content;
        if (delta) {
          // Send SSE event with the delta token
          res.write(`data: ${JSON.stringify({ content: delta })}\n\n`);
        }

        // Check if the stream is done
        const finishReason = chunk.choices?.[0]?.finish_reason;
        if (finishReason) {
          res.write(`data: ${JSON.stringify({ done: true, finishReason })}\n\n`);
        }
      }

      res.write("data: [DONE]\n\n");
      res.end();
    } catch (error) {
      console.error("[/api/chat] Error:", error);
      if (!res.headersSent) {
        res.status(500).json({ error: "Internal server error" });
      } else {
        // If we already started streaming, send an error event
        res.write(
          `data: ${JSON.stringify({ error: "Stream interrupted" })}\n\n`
        );
        res.end();
      }
    }
  });
}
