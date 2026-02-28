/**
 * Company Intelligence Agent
 *
 * Analyzes company profile, stakeholders, strategic priorities, and decision patterns.
 */

import { z } from "zod";

import { AgentCapability, AgentRequest, AgentResponse } from "../../../services/agents/core/IAgent";
import { AgentType } from "../../../types/agents";
import { AgentConfig, BaseAgent } from "../BaseAgent";
import {
  assertHighConfidence,
  assertProvenance,
  validateGroundTruthMetadata,
} from "../ground-truth/GroundTruthValidator";

type ConfidenceLevel = "high" | "medium" | "low";

// SECURITY FIX: Use secureInvoke() for hallucination detection and circuit breaker
const intelligenceSchema = z.object({
  company_profile: z.object({
    name: z.string(),
    industry: z.string(),
    size: z.string().optional(),
    description: z.string().optional(),
  }),
  key_stakeholders: z.array(
    z.object({
      name: z.string(),
      role: z.string(),
      influence: z.enum(["high", "medium", "low"]).optional(),
    })
  ),
  strategic_priorities: z.array(
    z.object({
      priority: z.string(),
      description: z.string(),
      timeframe: z.string().optional(),
    })
  ),
  decision_patterns: z.object({
    style: z.string(),
    speed: z.string().optional(),
    primary_factors: z.array(z.string()).optional(),
  }),
  confidence_level: z.enum(["high", "medium", "low"]),
  reasoning: z.string(),
  hallucination_check: z.boolean().optional(),
});

export type CompanyIntelligenceResult = z.infer<typeof intelligenceSchema>;

export class CompanyIntelligenceAgent extends BaseAgent {
  constructor(config: AgentConfig) {
    super(config);
  }

  getAgentType(): AgentType {
    // Casting as it might not be in the enum yet
    return "company-intelligence" as AgentType;
  }

  getCapabilities(): AgentCapability[] {
    return [
      {
        id: "company_analysis",
        name: "Company Analysis",
        description: "Analyze company profile and strategy",
        enabled: true,
        category: "analysis",
        inputTypes: ["text", "object"],
        outputTypes: ["object"],
        requiredPermissions: ["llm_access"],
      },
      {
        id: "stakeholder_mapping",
        name: "Stakeholder Mapping",
        description: "Identify and analyze key stakeholders",
        enabled: true,
        category: "analysis",
        inputTypes: ["text"],
        outputTypes: ["object"],
        requiredPermissions: ["llm_access"],
      },
    ];
  }

  protected async processRequest(request: AgentRequest): Promise<AgentResponse> {
    try {
      const query = request.query || "";
      const context = request.context || {};
      const parameters = request.parameters || {};

      const prompt = `
        Analyze the following company/entity based on the provided query and context.

        Query: ${query}

        Context: ${JSON.stringify(context)}
        Parameters: ${JSON.stringify(parameters)}

        Provide a detailed analysis including:
        1. Company Profile (name, industry, size, description)
        2. Key Stakeholders (name, role, influence)
        3. Strategic Priorities
        4. Decision Making Patterns

        Also provide a confidence level and reasoning for your analysis.
        Perform a self-check for hallucinations and set 'hallucination_check' to true if you are confident the information is grounded in the context or general knowledge, false otherwise.
      `;

      const result = await this.secureInvoke(prompt, intelligenceSchema, {
        temperature: 0.2,
        model: "gpt-4",
      });

      // --- Ground Truth Validation Integration ---
      if (result && result.metadata) {
        const metadata = validateGroundTruthMetadata(result.metadata);
        assertHighConfidence(metadata, 0.9);
        assertProvenance(metadata);
      }

      return this.createResponse(
        true,
        result,
        result.confidence_level as ConfidenceLevel,
        result.reasoning
      );
    } catch (error) {
      return this.handleError(error as Error, "CompanyIntelligenceAgent processing failed");
    }
  }
}
