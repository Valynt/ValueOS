/**
 * XAgent
 *
 * [One-line description of what this agent does and which lifecycle stage it owns.]
 *
 * Replace every occurrence of "X" / "XAgent" / "x" with the real agent name.
 * Delete comments that restate the code once you've filled in the implementation.
 */

import { z } from "zod";

import type {
  AgentOutput,
  AgentOutputMetadata,
  ConfidenceLevel,
  LifecycleContext,
} from "../../../types/agent.js";
import { logger } from "../../logger.js";

import { BaseAgent } from "./BaseAgent.js";

// ---------------------------------------------------------------------------
// Zod schemas — define the exact shape the LLM must return.
// Include hallucination_check so secureInvoke can surface it.
// ---------------------------------------------------------------------------

const XOutputSchema = z.object({
  result: z.string().min(1),
  confidence: z.enum(["high", "medium", "low"]),
  reasoning: z.string().min(1),
  hallucination_check: z.boolean().optional(),
});

type XOutput = z.infer<typeof XOutputSchema>;

// ---------------------------------------------------------------------------
// Agent
// ---------------------------------------------------------------------------

export class XAgent extends BaseAgent {
  // Required by BaseAgent — set these to real values.
  public readonly lifecycleStage = "discovery" as const; // e.g. "opportunity" | "target" | "modeling" | "integrity" | "realization" | "expansion"
  public readonly version = "1.0.0";
  public readonly name = "XAgent";

  async execute(context: LifecycleContext): Promise<AgentOutput> {
    const startTime = Date.now();

    // Validate required fields (workspace_id + organization_id are mandatory).
    const isValid = await this.validateInput(context);
    if (!isValid) {
      throw new Error("Invalid input context");
    }

    // -----------------------------------------------------------------------
    // 1. Read prior memory (if this agent depends on upstream agents).
    //    Always pass organization_id to enforce tenant isolation.
    // -----------------------------------------------------------------------
    const priorMemory = await this.memorySystem.retrieve({
      agent_id: "opportunity", // upstream agent that wrote the data
      workspace_id: context.workspace_id,
      organization_id: context.organization_id, // REQUIRED — tenant isolation
      limit: 10,
    });

    if (priorMemory.length === 0) {
      return this.buildOutput(
        { error: "No upstream data found in memory." },
        "failure",
        "low",
        startTime,
      );
    }

    // -----------------------------------------------------------------------
    // 2. Build prompt using Handlebars-style template interpolation.
    //    Never concatenate raw user input directly into the prompt string.
    // -----------------------------------------------------------------------
    const systemPrompt = `You are a [role]. [Task description].

Rules:
- [Rule 1]
- [Rule 2]
- Respond with valid JSON matching the schema. No markdown fences.`;

    const userPrompt = `[User-facing instruction]

Context:
${priorMemory.map((m) => m.content).join("\n")}

Generate a JSON object with: result, confidence (high/medium/low), reasoning.`;

    // -----------------------------------------------------------------------
    // 3. Call LLM via secureInvoke — NEVER call llmGateway.complete() directly.
    //    Pick confidence thresholds by risk tier:
    //      financial:   { low: 0.7, high: 0.9 }
    //      commitment:  { low: 0.6, high: 0.85 }
    //      discovery:   { low: 0.5, high: 0.8 }
    // -----------------------------------------------------------------------
    let llmResult: XOutput | null = null;
    try {
      llmResult = await this.secureInvoke<XOutput>(
        context.workspace_id,
        `${systemPrompt}\n\n${userPrompt}`,
        XOutputSchema,
        {
          trackPrediction: true,
          confidenceThresholds: { low: 0.5, high: 0.8 }, // adjust per risk tier
          context: {
            agent: this.name,
            organization_id: context.organization_id,
          },
        },
      );
    } catch (err) {
      logger.error("LLM call failed", {
        error: (err as Error).message,
        workspace_id: context.workspace_id,
      });
      return this.buildOutput(
        { error: "LLM call failed. Retry or provide more context." },
        "failure",
        "low",
        startTime,
      );
    }

    if (!llmResult) {
      return this.buildOutput(
        { error: "LLM returned no result." },
        "failure",
        "low",
        startTime,
      );
    }

    // -----------------------------------------------------------------------
    // 4. Store output in memory for downstream agents.
    //    The last argument MUST be this.organizationId (tenant isolation).
    // -----------------------------------------------------------------------
    try {
      await this.memorySystem.storeSemanticMemory(
        context.workspace_id,
        this.name,
        "episodic",
        `XAgent result: ${llmResult.result}`,
        {
          type: "x_result",
          confidence: llmResult.confidence,
          organization_id: context.organization_id, // REQUIRED
        },
        this.organizationId, // REQUIRED — tenant isolation
      );
    } catch (err) {
      // Non-fatal: log and continue.
      logger.warn("Failed to store result in memory", {
        error: (err as Error).message,
      });
    }

    // -----------------------------------------------------------------------
    // 5. Return output.
    // -----------------------------------------------------------------------
    const confidenceLevel: ConfidenceLevel =
      llmResult.confidence === "high"
        ? "high"
        : llmResult.confidence === "medium"
          ? "medium"
          : "low";

    // buildOutput is the canonical return method. prepareOutput is @deprecated.
    return this.buildOutput(
      { result: llmResult.result },
      "success",
      confidenceLevel,
      startTime,
      { reasoning: llmResult.reasoning },
    );
  }
}
