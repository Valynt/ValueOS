/**
 * Expansion Agent
 *
 * Identifies and analyzes expansion opportunities for existing value cases,
 * focusing on upsell, cross-sell, and renewal scenarios.
 */

import { AgentConfig, AgentType, ConfidenceLevel } from "../../../services/agent-types";
import { AgentCapability, AgentRequest, AgentResponse } from "../../../services/agents/core/IAgent";
import { BaseAgent } from "../BaseAgent";
import {
  assertHighConfidence,
  assertProvenance,
  validateGroundTruthMetadata,
} from "../ground-truth/GroundTruthValidator";

export interface ExpansionOpportunity {
  opportunityId: string;
  type: "upsell" | "cross_sell" | "renewal" | "expansion";
  title: string;
  description: string;
  currentValue: {
    revenue: number;
    margin: number;
    volume: number;
    contractValue?: number;
  };
  expansionPotential: {
    additionalRevenue: number;
    probability: number; // 0-1
    timeframe: string;
    confidence: number; // 0-1
  };
  businessCase: {
    justification: string;
    roi: number;
    paybackPeriod: string;
    riskFactors: string[];
  };
  customerContext: {
    industry: string;
    size: string;
    maturity: "early" | "growth" | "mature";
    relationship: "new" | "developing" | "established" | "strategic";
    recentInteractions: string[];
  };
  implementation: {
    approach: string;
    timeline: string;
    resources: string[];
    stakeholders: string[];
    prerequisites: string[];
  };
  risks: Array<{
    risk: string;
    probability: "low" | "medium" | "high";
    impact: "low" | "medium" | "high";
    mitigation: string;
  }>;
  nextSteps: string[];
}

export class ExpansionAgent extends BaseAgent {
  constructor(config: AgentConfig) {
    super(config);
    this.initializeMARL();
  }

  getAgentType(): AgentType {
    return "expansion";
  }

  getCapabilities(): AgentCapability[] {
    return [
      {
        id: "expansion_analysis",
        name: "Expansion Analysis",
        description: "Analyze expansion opportunities",
        enabled: true,
        category: "analysis",
        inputTypes: ["object"],
        outputTypes: ["text"],
        requiredPermissions: ["llm_access"],
      },
      {
        id: "upsell_identification",
        name: "Upsell Identification",
        description: "Identify upsell opportunities",
        enabled: true,
        category: "analysis",
        inputTypes: ["object"],
        outputTypes: ["text"],
        requiredPermissions: ["llm_access"],
      },
      {
        id: "cross_sell_analysis",
        name: "Cross-sell Analysis",
        description: "Analyze cross-sell opportunities",
        enabled: true,
        category: "analysis",
        inputTypes: ["object"],
        outputTypes: ["text"],
        requiredPermissions: ["llm_access"],
      },
      {
        id: "renewal_assessment",
        name: "Renewal Assessment",
        description: "Assess renewal opportunities",
        enabled: true,
        category: "analysis",
        inputTypes: ["object"],
        outputTypes: ["text"],
        requiredPermissions: ["llm_access"],
      },
    ];
  }

  protected async processRequest(request: AgentRequest): Promise<AgentResponse> {
    const startTime = Date.now();

    try {
      // Extract expansion data from request
      const inputData = request.input || request.query;
      // Extract expansion data from request
      const inputData = this.extractExpansionData(request);

      // Create MARL state for collaborative analysis
      const marlState = {
        sessionId: request.sessionId,
        agentStates: {
          [this.agentId]: {
            inputData,
            analysisHistory: [], // Could be populated from memory
          },
        },
        sharedContext: {
          context: inputData,
          sessionId: request.sessionId,
        },
        interactionHistory: this.getMARLHistory(),
        timestamp: Date.now(),
      };

      // Analyze expansion opportunities with MARL collaboration
      const opportunities = await this.performCollaborativeAnalysis(
        request.sessionId,
        inputData,
        marlState
      );

      // --- Ground Truth Validation Integration ---
      if (Array.isArray(opportunities)) {
        for (const opp of opportunities) {
          if (opp && opp.metadata) {
            const metadata = validateGroundTruthMetadata(opp.metadata);
            assertHighConfidence(metadata, 0.9);
            assertProvenance(metadata);
          }
        }
      }

      // Store analysis in memory
      await this.storeExpansionAnalysis(opportunities);

      // Calculate average probability
      const avgProbability =
        opportunities.reduce(
          (acc, opportunity) => acc + opportunity.expansionPotential.probability,
          0
        ) / opportunities.length;

      // Generate response
      const response = this.createResponse(
        true,
        this.formatExpansionResponse(opportunities),
        avgProbability >= 0.7 ? ("high" as ConfidenceLevel) : ("medium" as ConfidenceLevel),
        `Analyzed ${opportunities.length} expansion opportunities with average probability ${avgProbability.toFixed(2)}`
      );

      return response;
    } catch (error) {
      return this.createResponse(
        false,
        (error as Error).message,
        "low" as ConfidenceLevel,
        `Error analyzing expansion opportunities: ${(error as Error).message}`
      );
    }
  }

  private extractExpansionData(request: AgentRequest): Record<string, any> {
    const data: Record<string, any> = {
      query: request.query,
      parameters: request.parameters || {},
      context: request.context || {},
    };

    // Extract key information from the query and parameters
    if (request.parameters) {
      data.customerId = request.parameters.customerId;
      data.customerName = request.parameters.customerName;
      data.industry = request.parameters.industry;
      data.currentValue = request.parameters.currentValue;
      data.contractValue = request.parameters.contractValue;
      data.renewalDate = request.parameters.renewalDate;
      data.usageData = request.parameters.usageData;
      data.satisfaction = request.parameters.satisfaction;
      data.recentPurchases = request.parameters.recentPurchases;
      data.competitorActivity = request.parameters.competitorActivity;
    }

    return data;
  }

  private async analyzeExpansionOpportunities(
    data: Record<string, any>
  ): Promise<ExpansionOpportunity[]> {
    const opportunities: ExpansionOpportunity[] = [];

    // Analyze upsell opportunities
    if (this.shouldAnalyzeUpsell(data)) {
      const upsellOpportunity = await this.analyzeUpsellOpportunity(data);
      if (upsellOpportunity) opportunities.push(upsellOpportunity);
    }

    // Analyze cross-sell opportunities
    if (this.shouldAnalyzeCrossSell(data)) {
      const crossSellOpportunity = await this.analyzeCrossSellOpportunity(data);
      if (crossSellOpportunity) opportunities.push(crossSellOpportunity);
    }

    // Analyze renewal opportunities
    if (this.shouldAnalyzeRenewal(data)) {
      const renewalOpportunity = await this.analyzeRenewalOpportunity(data);
      if (renewalOpportunity) opportunities.push(renewalOpportunity);
    }

    // Analyze general expansion opportunities
    const expansionOpportunity = await this.analyzeGeneralExpansion(data);
    if (expansionOpportunity) opportunities.push(expansionOpportunity);

    return opportunities.sort(
      (a, b) => b.expansionPotential.additionalRevenue - a.expansionPotential.additionalRevenue
    );
  }

  private shouldAnalyzeUpsell(data: Record<string, any>): boolean {
    return !!(data.currentValue && data.customerId);
  }

  private shouldAnalyzeCrossSell(data: Record<string, any>): boolean {
    return !!(data.industry && data.customerId);
  }

  private shouldAnalyzeRenewal(data: Record<string, any>): boolean {
    return !!(data.renewalDate || data.contractValue);
  }

  private async analyzeUpsellOpportunity(
    data: Record<string, any>
  ): Promise<ExpansionOpportunity | null> {
    const prompt = this.buildUpsellPrompt(data);

    const llmResponse = await this.callLLM({
      provider: "openai",
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content:
            "You are an expert in upselling and customer expansion strategies. Analyze the customer data and identify upsell opportunities.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.3,
      maxTokens: 1200,
    });

    return this.parseUpsellResponse(llmResponse.content, data);
  }

  private async analyzeCrossSellOpportunity(
    data: Record<string, any>
  ): Promise<ExpansionOpportunity | null> {
    const prompt = this.buildCrossSellPrompt(data);

    const llmResponse = await this.callLLM({
      provider: "openai",
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content:
            "You are an expert in cross-selling strategies. Analyze the customer data and identify complementary product opportunities.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.3,
      maxTokens: 1200,
    });

    return this.parseCrossSellResponse(llmResponse.content, data);
  }

  private async analyzeRenewalOpportunity(
    data: Record<string, any>
  ): Promise<ExpansionOpportunity | null> {
    const prompt = this.buildRenewalPrompt(data);

    const llmResponse = await this.callLLM({
      provider: "openai",
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content:
            "You are an expert in customer retention and renewal strategies. Analyze the customer data and identify renewal opportunities.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.3,
      maxTokens: 1200,
    });

    return this.parseRenewalResponse(llmResponse.content, data);
  }

  private async analyzeGeneralExpansion(
    data: Record<string, any>
  ): Promise<ExpansionOpportunity | null> {
    const prompt = this.buildGeneralExpansionPrompt(data);

    const llmResponse = await this.callLLM({
      provider: "openai",
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content:
            "You are an expert in business expansion strategies. Analyze the customer data and identify general expansion opportunities.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.3,
      maxTokens: 1200,
    });

    return this.parseGeneralExpansionResponse(llmResponse.content, data);
  }

  private buildUpsellPrompt(data: Record<string, any>): string {
    return `
Analyze upsell opportunities for this customer:

CUSTOMER INFORMATION:
- Name: ${data.customerName || "Not specified"}
- ID: ${data.customerId || "Not specified"}
- Industry: ${data.industry || "Not specified"}
- Current Value: $${data.currentValue?.toLocaleString() || "Not specified"}
- Contract Value: $${data.contractValue?.toLocaleString() || "Not specified"}
- Usage Data: ${JSON.stringify(data.usageData || {})}
- Satisfaction: ${data.satisfaction || "Not specified"}
- Recent Purchases: ${JSON.stringify(data.recentPurchases || [])}

Please provide analysis in this JSON format:
{
  "title": "Upsell Opportunity Title",
  "description": "Detailed description of the upsell opportunity",
  "expansionPotential": {
    "additionalRevenue": 250000,
    "probability": 0.7,
    "timeframe": "3-6 months",
    "confidence": 0.8
  },
  "businessCase": {
    "justification": "Clear business justification",
    "roi": 2.5,
    "paybackPeriod": "8 months",
    "riskFactors": ["Risk 1", "Risk 2"]
  },
  "implementation": {
    "approach": "Implementation approach",
    "timeline": "Implementation timeline",
    "resources": ["Resource 1", "Resource 2"],
    "stakeholders": ["Stakeholder 1", "Stakeholder 2"],
    "prerequisites": ["Prerequisite 1"]
  },
  "risks": [
    {
      "risk": "Risk description",
      "probability": "medium",
      "impact": "medium",
      "mitigation": "Mitigation strategy"
    }
  ],
  "nextSteps": ["Step 1", "Step 2"]
}

Focus on realistic upsell opportunities that align with the customer's current usage and satisfaction.
    `.trim();
  }

  private buildCrossSellPrompt(data: Record<string, any>): string {
    return `
Analyze cross-sell opportunities for this customer:

CUSTOMER INFORMATION:
- Name: ${data.customerName || "Not specified"}
- ID: ${data.customerId || "Not specified"}
- Industry: ${data.industry || "Not specified"}
- Current Value: $${data.currentValue?.toLocaleString() || "Not specified"}
- Usage Data: ${JSON.stringify(data.usageData || {})}
- Recent Purchases: ${JSON.stringify(data.recentPurchases || [])}

Please provide analysis in this JSON format:
{
  "title": "Cross-sell Opportunity Title",
  "description": "Detailed description of the cross-sell opportunity",
  "expansionPotential": {
    "additionalRevenue": 150000,
    "probability": 0.6,
    "timeframe": "2-4 months",
    "confidence": 0.7
  },
  "businessCase": {
    "justification": "Clear business justification",
    "roi": 2.0,
    "paybackPeriod": "6 months",
    "riskFactors": ["Risk 1", "Risk 2"]
  },
  "implementation": {
    "approach": "Implementation approach",
    "timeline": "Implementation timeline",
    "resources": ["Resource 1", "Resource 2"],
    "stakeholders": ["Stakeholder 1", "Stakeholder 2"],
    "prerequisites": ["Prerequisite 1"]
  },
  "risks": [
    {
      "risk": "Risk description",
      "probability": "medium",
      "impact": "medium",
      "mitigation": "Mitigation strategy"
    }
  ],
  "nextSteps": ["Step 1", "Step 2"]
}

Focus on complementary products or services that would enhance the customer's current solution.
    `.trim();
  }

  private buildRenewalPrompt(data: Record<string, any>): string {
    return `
Analyze renewal opportunities for this customer:

CUSTOMER INFORMATION:
- Name: ${data.customerName || "Not specified"}
- ID: ${data.customerId || "Not specified"}
- Industry: ${data.industry || "Not specified"}
- Current Value: $${data.currentValue?.toLocaleString() || "Not specified"}
- Contract Value: $${data.contractValue?.toLocaleString() || "Not specified"}
- Renewal Date: ${data.renewalDate || "Not specified"}
- Usage Data: ${JSON.stringify(data.usageData || {})}
- Satisfaction: ${data.satisfaction || "Not specified"}
- Competitor Activity: ${JSON.stringify(data.competitorActivity || [])}

Please provide analysis in this JSON format:
{
  "title": "Renewal Opportunity Title",
  "description": "Detailed description of the renewal opportunity",
  "expansionPotential": {
    "additionalRevenue": 300000,
    "probability": 0.8,
    "timeframe": "1-2 months",
    "confidence": 0.9
  },
  "businessCase": {
    "justification": "Clear business justification",
    "roi": 3.0,
    "paybackPeriod": "3 months",
    "riskFactors": ["Risk 1", "Risk 2"]
  },
  "implementation": {
    "approach": "Implementation approach",
    "timeline": "Implementation timeline",
    "resources": ["Resource 1", "Resource 2"],
    "stakeholders": ["Stakeholder 1", "Stakeholder 2"],
    "prerequisites": ["Prerequisite 1"]
  },
  "risks": [
    {
      "risk": "Risk description",
      "probability": "medium",
      "impact": "medium",
      "mitigation": "Mitigation strategy"
    }
  ],
  "nextSteps": ["Step 1", "Step 2"]
}

Focus on renewal strategies that maximize customer retention and value.
    `.trim();
  }

  private buildGeneralExpansionPrompt(data: Record<string, any>): string {
    return `
Analyze general expansion opportunities for this customer:

CUSTOMER INFORMATION:
- Name: ${data.customerName || "Not specified"}
- ID: ${data.customerId || "Not specified"}
- Industry: ${data.industry || "Not specified"}
- Current Value: $${data.currentValue?.toLocaleString() || "Not specified"}
- Usage Data: ${JSON.stringify(data.usageData || {})}
- Recent Interactions: ${JSON.stringify(data.recentInteractions || [])}

Please provide analysis in this JSON format:
{
  "title": "Expansion Opportunity Title",
  "description": "Detailed description of the expansion opportunity",
  "expansionPotential": {
    "additionalRevenue": 200000,
    "probability": 0.5,
    "timeframe": "4-8 months",
    "confidence": 0.6
  },
  "businessCase": {
    "justification": "Clear business justification",
    "roi": 2.2,
    "paybackPeriod": "7 months",
    "riskFactors": ["Risk 1", "Risk 2"]
  },
  "implementation": {
    "approach": "Implementation approach",
    "timeline": "Implementation timeline",
    "resources": ["Resource 1", "Resource 2"],
    "stakeholders": ["Stakeholder 1", "Stakeholder 2"],
    "prerequisites": ["Prerequisite 1"]
  },
  "risks": [
    {
      "risk": "Risk description",
      "probability": "medium",
      "impact": "medium",
      "mitigation": "Mitigation strategy"
    }
  ],
  "nextSteps": ["Step 1", "Step 2"]
}

Focus on strategic expansion opportunities that could significantly grow the customer relationship.
    `.trim();
  }

  private parseUpsellResponse(
    content: string,
    data: Record<string, any>
  ): ExpansionOpportunity | null {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          opportunityId: `upsell-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          type: "upsell",
          currentValue: {
            revenue: data.currentValue || 0,
            margin: 0.7, // Default margin
            volume: 1,
            contractValue: data.contractValue || 0,
          },
          ...parsed,
          customerContext: {
            industry: data.industry || "Unknown",
            size: this.estimateCompanySize(data.currentValue),
            maturity: "growth",
            relationship: "established",
            recentInteractions: data.recentInteractions || [],
          },
        };
      }
    } catch (error) {
      // If JSON parsing fails, create a basic opportunity
      return this.createBasicUpsellOpportunity(data);
    }

    return null;
  }

  private parseCrossSellResponse(
    content: string,
    data: Record<string, any>
  ): ExpansionOpportunity | null {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          opportunityId: `crosssell-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          type: "cross_sell",
          currentValue: {
            revenue: data.currentValue || 0,
            margin: 0.7,
            volume: 1,
            contractValue: data.contractValue || 0,
          },
          ...parsed,
          customerContext: {
            industry: data.industry || "Unknown",
            size: this.estimateCompanySize(data.currentValue),
            maturity: "growth",
            relationship: "established",
            recentInteractions: data.recentInteractions || [],
          },
        };
      }
    } catch (error) {
      return this.createBasicCrossSellOpportunity(data);
    }

    return null;
  }

  private parseRenewalResponse(
    content: string,
    data: Record<string, any>
  ): ExpansionOpportunity | null {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          opportunityId: `renewal-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          type: "renewal",
          currentValue: {
            revenue: data.currentValue || 0,
            margin: 0.7,
            volume: 1,
            contractValue: data.contractValue || 0,
          },
          ...parsed,
          customerContext: {
            industry: data.industry || "Unknown",
            size: this.estimateCompanySize(data.currentValue),
            maturity: "mature",
            relationship: "strategic",
            recentInteractions: data.recentInteractions || [],
          },
        };
      }
    } catch (error) {
      return this.createBasicRenewalOpportunity(data);
    }

    return null;
  }

  private parseGeneralExpansionResponse(
    content: string,
    data: Record<string, any>
  ): ExpansionOpportunity | null {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          opportunityId: `expansion-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          type: "expansion",
          currentValue: {
            revenue: data.currentValue || 0,
            margin: 0.7,
            volume: 1,
            contractValue: data.contractValue || 0,
          },
          ...parsed,
          customerContext: {
            industry: data.industry || "Unknown",
            size: this.estimateCompanySize(data.currentValue),
            maturity: "growth",
            relationship: "established",
            recentInteractions: data.recentInteractions || [],
          },
        };
      }
    } catch (error) {
      return this.createBasicExpansionOpportunity(data);
    }

    return null;
  }

  private createBasicUpsellOpportunity(data: Record<string, any>): ExpansionOpportunity {
    return {
      opportunityId: `upsell-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: "upsell",
      title: "Upsell Opportunity",
      description: "Potential upsell opportunity identified based on current usage patterns",
      currentValue: {
        revenue: data.currentValue || 0,
        margin: 0.7,
        volume: 1,
        contractValue: data.contractValue || 0,
      },
      expansionPotential: {
        additionalRevenue: Math.floor((data.currentValue || 0) * 0.3),
        probability: 0.6,
        timeframe: "3-6 months",
        confidence: 0.7,
      },
      businessCase: {
        justification: "Upsell based on increased usage and feature adoption",
        roi: 2.0,
        paybackPeriod: "6 months",
        riskFactors: ["Customer acceptance", "Implementation complexity"],
      },
      customerContext: {
        industry: data.industry || "Unknown",
        size: this.estimateCompanySize(data.currentValue),
        maturity: "growth",
        relationship: "established",
        recentInteractions: data.recentInteractions || [],
      },
      implementation: {
        approach: "Gradual feature introduction",
        timeline: "3-6 months",
        resources: ["Account manager", "Technical support"],
        stakeholders: ["Customer success", "Sales team"],
        prerequisites: ["Customer buy-in", "Technical readiness"],
      },
      risks: [
        {
          risk: "Customer budget constraints",
          probability: "medium",
          impact: "medium",
          mitigation: "Flexible pricing options",
        },
      ],
      nextSteps: ["Schedule discovery call", "Prepare upsell proposal"],
    };
  }

  private createBasicCrossSellOpportunity(data: Record<string, any>): ExpansionOpportunity {
    return {
      opportunityId: `crosssell-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: "cross_sell",
      title: "Cross-sell Opportunity",
      description: "Potential cross-sell opportunity identified based on industry trends",
      currentValue: {
        revenue: data.currentValue || 0,
        margin: 0.7,
        volume: 1,
        contractValue: data.contractValue || 0,
      },
      expansionPotential: {
        additionalRevenue: Math.floor((data.currentValue || 0) * 0.2),
        probability: 0.5,
        timeframe: "2-4 months",
        confidence: 0.6,
      },
      businessCase: {
        justification: "Complementary product offering based on industry needs",
        roi: 1.8,
        paybackPeriod: "5 months",
        riskFactors: ["Product fit", "Integration complexity"],
      },
      customerContext: {
        industry: data.industry || "Unknown",
        size: this.estimateCompanySize(data.currentValue),
        maturity: "growth",
        relationship: "established",
        recentInteractions: data.recentInteractions || [],
      },
      implementation: {
        approach: "Solution integration",
        timeline: "2-4 months",
        resources: ["Implementation team", "Product specialist"],
        stakeholders: ["Technical team", "Business stakeholders"],
        prerequisites: ["Technical assessment", "Integration planning"],
      },
      risks: [
        {
          risk: "Integration challenges",
          probability: "medium",
          impact: "medium",
          mitigation: "Phased rollout approach",
        },
      ],
      nextSteps: ["Identify complementary products", "Schedule demonstration"],
    };
  }

  private createBasicRenewalOpportunity(data: Record<string, any>): ExpansionOpportunity {
    return {
      opportunityId: `renewal-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: "renewal",
      title: "Renewal Opportunity",
      description: "Renewal opportunity based on contract timeline",
      currentValue: {
        revenue: data.currentValue || 0,
        margin: 0.7,
        volume: 1,
        contractValue: data.contractValue || 0,
      },
      expansionPotential: {
        additionalRevenue: Math.floor((data.currentValue || 0) * 0.1),
        probability: 0.8,
        timeframe: "1-2 months",
        confidence: 0.9,
      },
      businessCase: {
        justification: "Contract renewal with potential expansion",
        roi: 3.0,
        paybackPeriod: "3 months",
        riskFactors: ["Competitive pressure", "Budget constraints"],
      },
      customerContext: {
        industry: data.industry || "Unknown",
        size: this.estimateCompanySize(data.currentValue),
        maturity: "mature",
        relationship: "strategic",
        recentInteractions: data.recentInteractions || [],
      },
      implementation: {
        approach: "Renewal negotiation",
        timeline: "1-2 months",
        resources: ["Account manager", "Legal team"],
        stakeholders: ["Procurement", "Executive sponsor"],
        prerequisites: ["Performance review", "Budget approval"],
      },
      risks: [
        {
          risk: "Competitive offering",
          probability: "high",
          impact: "high",
          mitigation: "Value demonstration",
        },
      ],
      nextSteps: ["Schedule renewal discussion", "Prepare renewal proposal"],
    };
  }

  private createBasicExpansionOpportunity(data: Record<string, any>): ExpansionOpportunity {
    return {
      opportunityId: `expansion-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: "expansion",
      title: "General Expansion Opportunity",
      description: "Strategic expansion opportunity identified",
      currentValue: {
        revenue: data.currentValue || 0,
        margin: 0.7,
        volume: 1,
        contractValue: data.contractValue || 0,
      },
      expansionPotential: {
        additionalRevenue: Math.floor((data.currentValue || 0) * 0.25),
        probability: 0.5,
        timeframe: "4-8 months",
        confidence: 0.6,
      },
      businessCase: {
        justification: "Strategic business expansion",
        roi: 2.2,
        paybackPeriod: "7 months",
        riskFactors: ["Market conditions", "Resource requirements"],
      },
      customerContext: {
        industry: data.industry || "Unknown",
        size: this.estimateCompanySize(data.currentValue),
        maturity: "growth",
        relationship: "established",
        recentInteractions: data.recentInteractions || [],
      },
      implementation: {
        approach: "Strategic partnership",
        timeline: "4-8 months",
        resources: ["Business development", "Technical team"],
        stakeholders: ["Executive team", "Department heads"],
        prerequisites: ["Strategic alignment", "Resource allocation"],
      },
      risks: [
        {
          risk: "Market uncertainty",
          probability: "medium",
          impact: "medium",
          mitigation: "Pilot program approach",
        },
      ],
      nextSteps: ["Strategic assessment", "Partnership proposal"],
    };
  }

  private estimateCompanySize(revenue: number): string {
    if (revenue < 1000000) return "Small";
    if (revenue < 10000000) return "Medium";
    if (revenue < 100000000) return "Large";
    return "Enterprise";
  }

  private async storeExpansionAnalysis(opportunities: ExpansionOpportunity[]): Promise<void> {
    // Store the analysis in episodic memory
    await this.storeMemory(
      "episodic",
      `Expansion Analysis: ${opportunities.length} opportunities`,
      {
        opportunities,
        timestamp: new Date().toISOString(),
      }
    );

    // Store key insights in semantic memory
    const avgProbability =
      opportunities.reduce((sum, opp) => sum + opp.expansionPotential.probability, 0) /
      opportunities.length;
    await this.storeMemory(
      "semantic",
      `Expansion analysis: ${opportunities.length} opportunities with avg probability ${avgProbability.toFixed(2)}`,
      {
        opportunityCount: opportunities.length,
        averageProbability: avgProbability,
        totalPotentialRevenue: opportunities.reduce(
          (sum, opp) => sum + opp.expansionPotential.additionalRevenue,
          0
        ),
      }
    );
  }

  private formatExpansionResponse(opportunities: ExpansionOpportunity[]): string {
    if (opportunities.length === 0) {
      return "# Expansion Analysis\n\nNo expansion opportunities identified at this time. Consider reviewing customer data or engagement patterns.";
    }

    return `
# Expansion Analysis

## Summary
- **Total Opportunities**: ${opportunities.length}
- **Combined Potential**: $${opportunities.reduce((sum, opp) => sum + opp.expansionPotential.additionalRevenue, 0).toLocaleString()}
- **Average Probability**: ${((opportunities.reduce((sum, opp) => sum + opp.expansionPotential.probability, 0) / opportunities.length) * 100).toFixed(1)}%

## Opportunities

${opportunities
  .map(
    (opp, index) => `
### ${index + 1}. ${opp.title} (${opp.type.toUpperCase()})

**Description**: ${opp.description}

**Current Value**: $${opp.currentValue.revenue.toLocaleString()} (${(opp.currentValue.margin * 100).toFixed(1)}% margin)

**Expansion Potential**:
- **Additional Revenue**: $${opp.expansionPotential.additionalRevenue.toLocaleString()}
- **Probability**: ${(opp.expansionPotential.probability * 100).toFixed(1)}%
- **Timeframe**: ${opp.expansionPotential.timeframe}
- **Confidence**: ${(opp.expansionPotential.confidence * 100).toFixed(1)}%

**Business Case**:
- **ROI**: ${opp.businessCase.roi}x
- **Payback Period**: ${opp.businessCase.paybackPeriod}
- **Justification**: ${opp.businessCase.justification}

**Implementation**:
- **Approach**: ${opp.implementation.approach}
- **Timeline**: ${opp.implementation.timeline}
- **Resources**: ${opp.implementation.resources.join(", ")}
- **Stakeholders**: ${opp.implementation.stakeholders.join(", ")}

**Key Risks**:
${opp.risks.map((risk) => `- **${risk.risk}** (${risk.probability} probability, ${risk.impact} impact) - ${risk.mitigation}`).join("\n")}

**Next Steps**:
${opp.nextSteps.map((step, index) => `${index + 1}. ${step}`).join("\n")}
---
`
  )
  .join("\n")}

## Customer Context
${
  opportunities[0]?.customerContext
    ? `
**Industry**: ${opportunities[0].customerContext.industry}
**Company Size**: ${opportunities[0].customerContext.size}
**Relationship**: ${opportunities[0].customerContext.relationship}
**Maturity**: ${opportunities[0].customerContext.maturity}
`
    : ""
}

## Recommendations
1. Prioritize opportunities with higher probability and confidence
2. Focus on opportunities with shorter payback periods
3. Consider customer relationship maturity when approaching
4. Align with customer's strategic objectives
5. Ensure adequate resources are available for implementation
    `.trim();
  }

  private createErrorResponse(error: Error, executionTime: number): AgentResponse {
    return this.createResponse(
      false,
      `Error analyzing expansion opportunities: ${error.message}`,
      0,
      undefined,
      undefined,
      undefined,
      executionTime
    );
  }

  // Additional utility methods
  async getExpansionHistory(customerId?: string, limit: number = 10): Promise<any> {
    const query: any = {
      type: "episodic",
      limit,
    };

    if (customerId) {
      // Search for opportunities related to this customer
      query.searchText = customerId;
    }

    return await this.searchMemory(query);
  }

  async updateOpportunityAnalysis(
    opportunityId: string,
    updates: Partial<ExpansionOpportunity>
  ): Promise<boolean> {
    try {
      const memory = await this.retrieveMemory(opportunityId);
      if (!memory || memory.type !== "episodic") {
        return false;
      }

      const opportunity = memory.metadata?.opportunity as ExpansionOpportunity;
      if (!opportunity) {
        return false;
      }

      const updatedOpportunity = { ...opportunity, ...updates };

      // Store updated analysis
      await this.storeMemory(
        "episodic",
        `Updated Expansion Analysis: ${updatedOpportunity.title}`,
        {
          opportunity: updatedOpportunity,
          originalOpportunityId: opportunityId,
          updatedAt: new Date().toISOString(),
        }
      );

      return true;
    } catch (error) {
      return false;
    }
  }

  private initializeMARL(): void {
    // Import required MARL interfaces
    const {
      MARLState,
      MARLAction,
      MARLInteraction,
      MARLRewardFunction,
      MARLPolicy,
    } = require("./BaseAgent");

    // Reward function for expansion analysis
    const rewardFunction: MARLRewardFunction = {
      calculateReward: (_state, _action, nextState, _agentId) => {
        // Reward based on opportunity quality and revenue potential
        const opportunities = nextState.sharedContext?.opportunities || [];
        const totalRevenue = opportunities.reduce(
          (sum: number, opp: any) => sum + opp.expansionPotential?.additionalRevenue || 0,
          0
        );
        const avgProbability =
          opportunities.reduce(
            (sum: number, opp: any) => sum + opp.expansionPotential?.probability || 0,
            0
          ) / Math.max(opportunities.length, 1);

        return (totalRevenue / 100000) * 0.5 + avgProbability * 0.5; // Normalized reward
      },
    };

    // Policy for collaborative opportunity analysis
    const policy: MARLPolicy = {
      selectAction: async (state, agentId) => {
        // Analyze current state and select best action for opportunity identification
        const context = state.sharedContext?.context || {};
        const actionType = this.determineBestActionType(context);

        return {
          agentId,
          actionType,
          parameters: {
            analysisType: actionType,
            context,
            collaborativeInput: state.agentStates,
          },
          confidence: 0.85,
          timestamp: Date.now(),
        };
      },

      updatePolicy: async (interaction) => {
        // Update policy based on interaction outcomes
        const reward = interaction.rewards[this.agentId] || 0;
        this.logger.info("MARL policy updated for expansion analysis", {
          interactionId: interaction.interactionId,
          reward,
          agentId: this.agentId,
        });
      },
    };

    this.enableMARL(policy, rewardFunction);
  }

  private determineBestActionType(context: any): string {
    // Determine the best analysis type based on available data
    if (context.renewalDate || context.contractValue) {
      return "renewal_analysis";
    } else if (context.industry && context.customerId) {
      return "cross_sell_analysis";
    } else if (context.currentValue && context.customerId) {
      return "upsell_analysis";
    }
    return "general_expansion";
  }

  private async performCollaborativeAnalysis(
    sessionId: string,
    inputData: Record<string, any>,
    marlState: any
  ): Promise<ExpansionOpportunity[]> {
    // Use MARL to enhance analysis with collaborative reasoning
    if (this.isMARLEnabled()) {
      const marlAction = await this.selectMARLAction(marlState);
      if (marlAction) {
        // Adjust analysis based on MARL action
        const enhancedData = {
          ...inputData,
          marlGuidance: marlAction.parameters,
          collaborativeContext: marlState.agentStates,
        };

        const opportunities = await this.analyzeExpansionOpportunities(enhancedData);

        // Create interaction record for learning
        const nextState = {
          ...marlState,
          sharedContext: { ...marlState.sharedContext, opportunities },
          timestamp: Date.now(),
        };

        const interaction = {
          interactionId: `expansion-${sessionId}-${Date.now()}`,
          state: marlState,
          actions: [marlAction],
          rewards: { [this.agentId]: this.calculateMARLReward(marlState, marlAction, nextState) },
          nextState,
          timestamp: Date.now(),
        };

        await this.updateMARLPolicy(interaction);
        return opportunities;
      }
    }

    // Fallback to standard analysis
    return this.analyzeExpansionOpportunities(inputData);
  }
}
