/**
 * Research Agent
 *
 * VOS Lifecycle Stage: RESEARCH
 *
 * Conducts comprehensive research on companies, markets, and industries.
 * Gathers intelligence for opportunity identification and value mapping.
 *
 * Responsibilities:
 * - Company research and profiling
 * - Market analysis and trends
 * - Competitive intelligence gathering
 * - Industry research and reporting
 * - Data synthesis and insights generation
 */

import { logger } from "../../../lib/logger";
import { BaseAgent } from "./BaseAgent";
import type { ResearchAgentInput, ResearchAgentOutput } from "../../../types/vos";

import { AgentConfig } from "../../../types/agent";

export class ResearchAgent extends BaseAgent {
  public lifecycleStage = "research";
  public version = "1.0";
  public name = "Research Agent";

  constructor(config: AgentConfig) {
    super(config);
    logger.info("ResearchAgent initialized", {
      agentId: this.agentId,
      lifecycleStage: this.lifecycleStage,
    });
  }

  async execute(sessionId: string, input: ResearchAgentInput): Promise<ResearchAgentOutput> {
    const startTime = Date.now();

    try {
      logger.info("ResearchAgent execution started", {
        sessionId,
        researchType: input.researchType,
        target: input.target,
      });

      // Sanitize input for LLM processing
      const sanitizedInput = this.sanitizeInputForLLM(input);

      // Use secureInvoke for all LLM calls
      const result = await this.secureInvoke(
        sessionId,
        sanitizedInput,
        // TODO: Define proper schema for research output
        {} as any,
        {
          trackPrediction: true,
          context: {
            researchType: input.researchType,
            target: input.target,
            depth: input.depth || "standard",
          },
        }
      );

      const processingTime = Date.now() - startTime;

      logger.info("ResearchAgent execution completed", {
        sessionId,
        processingTime,
        confidenceLevel: result.confidence_level,
      });

      return {
        research: result.result,
        confidence: result.confidence_level,
        evidence: result.evidence || [],
        processingTime,
        insights: result.reasoning || "Research completed successfully",
      };
    } catch (error) {
      logger.error("ResearchAgent execution failed", error instanceof Error ? error : undefined, {
        sessionId,
        researchType: input.researchType,
      });

      // Fallback response
      return {
        research: {
          summary: "Research could not be completed due to an error",
          findings: [],
          sources: [],
          confidence: "low",
        },
        confidence: "low",
        evidence: [],
        processingTime: Date.now() - startTime,
        insights: `Research failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  }
}
