/**
 * Opportunity Agent
 *
 * Analyzes and identifies business opportunities from various inputs,
 * focusing on value creation potential and strategic alignment.
 */

import { BaseAgent } from "../BaseAgent";
import {
  assertHighConfidence,
  assertProvenance,
  validateGroundTruthMetadata,
} from "../ground-truth/GroundTruthValidator";
import {
  AgentCapability,
  AgentRequest,
  AgentResponse,
  AgentType,
  ConfidenceLevel,
} from "../../../services/agents/core/IAgent";
import { AgentConfig } from "../../../types/agent";

export interface OpportunityAnalysis {
  opportunityId: string;
  title: string;
  description: string;
  valuePotential: {
    estimatedValue: number;
    confidence: number;
    timeframe: string;
    riskLevel: "low" | "medium" | "high";
  };
  strategicFit: {
    alignment: number; // 0-1 scale
    priority: "low" | "medium" | "high" | "critical";
    businessImpact: string;
  };
  stakeholders: Array<{
    role: string;
    influence: "low" | "medium" | "high";
    interest: "low" | "medium" | "high";
  }>;
  nextSteps: string[];
  assumptions: string[];
  dataSources: string[];
}

export class OpportunityAgent extends BaseAgent {
  constructor(config: AgentConfig) {
    super(config);
  }

  getAgentType(): AgentType {
    return "opportunity";
  }

  getCapabilities(): AgentCapability[] {
    return [
      {
        id: "text_generation",
        name: "Text Generation",
        description: "Generate text responses",
        enabled: true,
        category: "core",
        inputTypes: ["text"],
        outputTypes: ["text"],
        requiredPermissions: ["llm_access"],
      },
      {
        id: "data_analysis",
        name: "Data Analysis",
        description: "Analyze input data",
        enabled: true,
        category: "analysis",
        inputTypes: ["text", "object"],
        outputTypes: ["text"],
        requiredPermissions: ["llm_access"],
      },
      {
        id: "memory_access",
        name: "Memory Access",
        description: "Access memory system",
        enabled: true,
        category: "memory",
        inputTypes: ["text"],
        outputTypes: ["text"],
        requiredPermissions: ["memory_access"],
      },
      {
        id: "external_apis",
        name: "External API Access",
        description: "Access external APIs",
        enabled: true,
        category: "external",
        inputTypes: ["text"],
        outputTypes: ["text"],
        requiredPermissions: ["external_api_access"],
      },
    ];
  }

  protected async processRequest(request: AgentRequest): Promise<AgentResponse> {
    const startTime = Date.now();

    try {
      // Extract opportunity data from request
      const inputData = this.extractOpportunityData(request);

      // Analyze the opportunity using LLM
      const analysis = await this.analyzeOpportunity(inputData);

      // --- Ground Truth Validation Integration ---
      if (analysis && analysis.metadata) {
        const metadata = validateGroundTruthMetadata(analysis.metadata);
        assertHighConfidence(metadata, 0.9);
        assertProvenance(metadata);
      }

      // Store analysis in memory
      await this.storeAnalysis(analysis, request);

      // Generate response
      const response = this.createResponse(
        true,
        this.formatOpportunityResponse(analysis),
        analysis.valuePotential.confidence,
        `Analyzed opportunity with estimated value of $${analysis.valuePotential.estimatedValue.toLocaleString()} and ${analysis.strategicFit.priority} priority`
      );

      return response;
    } catch (error) {
      return this.createResponse(
        false,
        (error as Error).message,
        ConfidenceLevel.LOW,
        `Error analyzing opportunity: ${(error as Error).message}`
      );
    }
  }

  private extractOpportunityData(request: AgentRequest): Record<string, any> {
    const data: Record<string, any> = {
      query: request.query,
      parameters: request.parameters || {},
      context: request.context || {},
    };

    // Extract key information from the query and parameters
    if (request.query) {
      data.description = request.query;
    }

    if (request.parameters) {
      data.company = request.parameters.company;
      data.industry = request.parameters.industry;
      data.revenue = request.parameters.revenue;
      data.painPoints = request.parameters.painPoints;
      data.currentSolution = request.parameters.currentSolution;
      data.timeline = request.parameters.timeline;
      data.budget = request.parameters.budget;
    }

    return data;
  }

  private async analyzeOpportunity(data: Record<string, any>): Promise<OpportunityAnalysis> {
    const prompt = this.buildAnalysisPrompt(data);

    const llmResponse = await this.callLLM({
      provider: "openai",
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: `You are an expert business analyst specializing in opportunity identification and value creation analysis.
          Analyze the provided information and identify business opportunities with realistic value potential.
          Focus on strategic alignment and practical implementation considerations.`,
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.3,
      maxTokens: 1500,
    });

    // Parse the LLM response
    const analysis = this.parseAnalysisResponse(llmResponse.content);

    return {
      opportunityId: `opp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      ...analysis,
    };
  }

  private buildAnalysisPrompt(data: Record<string, any>): string {
    return `
Analyze the following business opportunity information and provide a structured analysis:

COMPANY INFORMATION:
- Company: ${data.company || "Not specified"}
- Industry: ${data.industry || "Not specified"}
- Revenue: ${data.revenue || "Not specified"}
- Current Solution: ${data.currentSolution || "Not specified"}

OPPORTUNITY DETAILS:
- Description: ${data.description || "Not specified"}
- Pain Points: ${Array.isArray(data.painPoints) ? data.painPoints.join(", ") : data.painPoints || "Not specified"}
- Timeline: ${data.timeline || "Not specified"}
- Budget: ${data.budget || "Not specified"}

Please provide your analysis in the following JSON format:
{
  "title": "Brief, compelling title for the opportunity",
  "description": "Detailed description of the opportunity",
  "valuePotential": {
    "estimatedValue": 1000000,
    "confidence": 0.8,
    "timeframe": "6-12 months",
    "riskLevel": "medium"
  },
  "strategicFit": {
    "alignment": 0.85,
    "priority": "high",
    "businessImpact": "Description of business impact"
  },
  "stakeholders": [
    {
      "role": "CEO",
      "influence": "high",
      "interest": "high"
    }
  ],
  "nextSteps": ["Step 1", "Step 2"],
  "assumptions": ["Assumption 1"],
  "dataSources": ["Source 1"]
}

Focus on realistic value propositions and practical implementation considerations.
    `.trim();
  }

  private parseAnalysisResponse(content: string): Omit<OpportunityAnalysis, "opportunityId"> {
    try {
      // Try to extract JSON from the response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return parsed;
      }
    } catch (error) {
      // If JSON parsing fails, create a basic analysis
      return this.createBasicAnalysis(content);
    }

    // Fallback to basic analysis
    return this.createBasicAnalysis(content);
  }

  private createBasicAnalysis(content: string): Omit<OpportunityAnalysis, "opportunityId"> {
    return {
      title: "Business Opportunity Analysis",
      description: content.substring(0, 500) + (content.length > 500 ? "..." : ""),
      valuePotential: {
        estimatedValue: 500000,
        confidence: 0.6,
        timeframe: "3-6 months",
        riskLevel: "medium",
      },
      strategicFit: {
        alignment: 0.7,
        priority: "medium",
        businessImpact: "Potential for value creation identified",
      },
      stakeholders: [
        {
          role: "Business Stakeholder",
          influence: "medium",
          interest: "high",
        },
      ],
      nextSteps: [
        "Conduct detailed analysis",
        "Validate assumptions",
        "Develop implementation plan",
      ],
      assumptions: ["Based on available information", "Requires further validation"],
      dataSources: ["User input", "Agent analysis"],
    };
  }

  private async storeAnalysis(analysis: OpportunityAnalysis, request: AgentRequest): Promise<void> {
    // Store the analysis in episodic memory
    await this.storeMemory("episodic", `Opportunity Analysis: ${analysis.title}`, {
      analysis,
      timestamp: new Date().toISOString(),
    });

    // Store key insights in semantic memory
    await this.storeMemory(
      "semantic",
      `Key insights from ${analysis.title}: ${analysis.description.substring(0, 200)}`,
      {
        opportunityId: analysis.opportunityId,
        valuePotential: analysis.valuePotential.estimatedValue,
        priority: analysis.strategicFit.priority,
      }
    );
  }

  private formatOpportunityResponse(analysis: OpportunityAnalysis): string {
    return `
# Opportunity Analysis: ${analysis.title}

## Description
${analysis.description}

## Value Potential
- **Estimated Value**: $${analysis.valuePotential.estimatedValue.toLocaleString()}
- **Confidence**: ${(analysis.valuePotential.confidence * 100).toFixed(1)}%
- **Timeframe**: ${analysis.valuePotential.timeframe}
- **Risk Level**: ${analysis.valuePotential.riskLevel.toUpperCase()}

## Strategic Fit
- **Alignment**: ${(analysis.strategicFit.alignment * 100).toFixed(1)}%
- **Priority**: ${analysis.strategicFit.priority.toUpperCase()}
- **Business Impact**: ${analysis.strategicFit.businessImpact}

## Key Stakeholders
${analysis.stakeholders.map((s) => `- **${s.role}**: Influence - ${s.influence}, Interest - ${s.interest}`).join("\n")}

## Next Steps
${analysis.nextSteps.map((step, index) => `${index + 1}. ${step}`).join("\n")}

## Assumptions
${analysis.assumptions.map((assumption) => `- ${assumption}`).join("\n")}

## Data Sources
${analysis.dataSources.map((source) => `- ${source}`).join("\n")}
    `.trim();
  }

  // Additional utility methods for opportunity analysis
  async validateOpportunity(opportunityId: string): Promise<boolean> {
    try {
      const memory = await this.retrieveMemory(opportunityId);
      return memory !== null && memory.type === "episodic";
    } catch (error) {
      return false;
    }
  }

  async updateOpportunityAnalysis(
    opportunityId: string,
    updates: Partial<OpportunityAnalysis>
  ): Promise<boolean> {
    try {
      const memory = await this.retrieveMemory(opportunityId);
      if (!memory || memory.type !== "episodic") {
        return false;
      }

      const analysis = memory.metadata?.analysis as OpportunityAnalysis;
      if (!analysis) {
        return false;
      }

      const updatedAnalysis = { ...analysis, ...updates };

      // Store updated analysis
      await this.storeMemory("episodic", `Updated Opportunity Analysis: ${updatedAnalysis.title}`, {
        analysis: updatedAnalysis,
        originalOpportunityId: opportunityId,
        updatedAt: new Date().toISOString(),
      });

      return true;
    } catch (error) {
      return false;
    }
  }

  async getOpportunityHistory(agentId?: string, limit: number = 10): Promise<any> {
    const query: any = {
      type: "episodic",
      limit,
    };

    if (agentId) {
      query.agentId = agentId;
    }

    return await this.searchMemory(query);
  }
}
