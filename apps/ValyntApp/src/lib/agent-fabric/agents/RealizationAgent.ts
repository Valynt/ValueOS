/**
 * Realization Agent
 *
 * Tracks and manages value realization from completed value cases,
 * focusing on actual outcomes, lessons learned, and continuous improvement.
 */

import { BaseAgent } from "../BaseAgent";
import { AgentCapability, AgentRequest, AgentResponse } from "../../../services/agents/core/IAgent";
import { AgentConfig, AgentType, ConfidenceLevel } from "../../../types/agent";
import {
  assertHighConfidence,
  assertProvenance,
  validateGroundTruthMetadata,
} from "../ground-truth/GroundTruthValidator";

export interface ValueRealization {
  realizationId: string;
  valueCaseId: string;
  title: string;
  description: string;
  planned: {
    expectedValue: number;
    timeframe: string;
    successCriteria: string[];
    stakeholders: string[];
  };
  actual: {
    realizedValue: number;
    achievementDate: string;
    actualTimeframe: string;
    metCriteria: string[];
    missedCriteria: string[];
    unexpectedOutcomes: string[];
  };
  analysis: {
    valueGap: number;
    valueGapPercentage: number;
    timeframeVariance: string;
    successRate: number; // 0-1
    lessons: Array<{
      category: "process" | "assumption" | "execution" | "external";
      lesson: string;
      impact: "positive" | "negative" | "neutral";
      actionability: "immediate" | "short_term" | "long_term";
    }>;
    successFactors: string[];
    improvementAreas: string[];
  };
  impact: {
    financial: {
      directRevenue: number;
      costSavings: number;
      efficiencyGains: number;
      totalImpact: number;
    };
    operational: {
      processImprovements: string[];
      capabilityEnhancements: string[];
      riskReductions: string[];
    };
    strategic: {
      marketPosition: string;
      competitiveAdvantage: string;
      customerSatisfaction: string;
    };
  };
  nextSteps: {
    immediate: string[];
    shortTerm: string[];
    longTerm: string[];
  };
  recommendations: {
    forFutureCases: string[];
    forProcessImprovement: string[];
    forStakeholderManagement: string[];
  };
}

export class RealizationAgent extends BaseAgent {
  constructor(config: AgentConfig) {
    super(config);
  }

  getAgentType(): AgentType {
    return "realization";
  }

  getCapabilities(): AgentCapability[] {
    return [
      {
        id: "value_tracking",
        name: "Value Tracking",
        description: "Track value realization from completed cases",
        enabled: true,
        category: "analysis",
        inputTypes: ["object"],
        outputTypes: ["text"],
        requiredPermissions: ["llm_access"],
      },
      {
        id: "outcome_analysis",
        name: "Outcome Analysis",
        description: "Analyze planned vs actual outcomes",
        enabled: true,
        category: "analysis",
        inputTypes: ["object"],
        outputTypes: ["text"],
        requiredPermissions: ["llm_access"],
      },
      {
        id: "lessons_learned",
        name: "Lessons Learned",
        description: "Extract lessons learned from value cases",
        enabled: true,
        category: "analysis",
        inputTypes: ["object"],
        outputTypes: ["text"],
        requiredPermissions: ["llm_access"],
      },
      {
        id: "improvement_suggestions",
        name: "Improvement Suggestions",
        description: "Generate improvement suggestions",
        enabled: true,
        category: "generation",
        inputTypes: ["object"],
        outputTypes: ["text"],
        requiredPermissions: ["llm_access"],
      },
    ];
  }

  protected async processRequest(request: AgentRequest): Promise<AgentResponse> {
    const startTime = Date.now();

    try {
      // Extract realization data from request
      const inputData = this.extractRealizationData(request);

      // Analyze value realization
      const realization = await this.analyzeValueRealization(inputData);

      // Store realization in memory
      await this.storeRealizationAnalysis(realization, request);

      // Generate response
      const response = this.createResponse(
        true,
        this.realizationResponse(realization),
        realization.analysis.successRate * 100 >= 70
          ? ("high" as ConfidenceLevel)
          : ("medium" as ConfidenceLevel),
        `Value realization analysis completed with score ${(realization.analysis.successRate * 100).toFixed(1)}/100`
      );

      return response;
    } catch (error) {
      return this.createResponse(
        false,
        (error as Error).message,
        "low" as ConfidenceLevel,
        `Error analyzing value realization: ${(error as Error).message}`
      );
    }
  }

  private extractRealizationData(request: AgentRequest): Record<string, any> {
    const data: Record<string, any> = {
      query: request.query,
      parameters: request.parameters || {},
      context: request.context || {},
    };

    // Extract realization information
    if (request.parameters) {
      data.valueCaseId = request.parameters.valueCaseId;
      data.title = request.parameters.title;
      data.description = request.parameters.description;
      data.planned = request.parameters.planned;
      data.actual = request.parameters.actual;
      data.impact = request.parameters.impact;
      data.stakeholders = request.parameters.stakeholders;
      data.metrics = request.parameters.metrics;
      data.outcomes = request.parameters.outcomes;
    }

    return data;
  }

  private async analyzeValueRealization(data: Record<string, any>): Promise<ValueRealization> {
    const prompt = this.buildRealizationPrompt(data);

    const llmResponse = await this.callLLM({
      provider: "openai",
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content:
            "You are an expert in value realization and outcome analysis. Analyze the planned vs actual outcomes and provide insights.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.3,
      maxTokens: 2000,
    });

    return this.parseRealizationResponse(llmResponse.content, data);
  }

  private buildRealizationPrompt(data: Record<string, any>): string {
    return `
Analyze the value realization for this completed value case:

VALUE CASE INFORMATION:
- ID: ${data.valueCaseId || "Not specified"}
- Title: ${data.title || "Not specified"}
- Description: ${data.description || "Not specified"}

PLANNED OUTCOMES:
${
  data.planned
    ? `
- Expected Value: $${data.planned.expectedValue?.toLocaleString() || "Not specified"}
- Timeframe: ${data.planned.timeframe || "Not specified"}
- Success Criteria: ${JSON.stringify(data.planned.successCriteria || [])}
- Stakeholders: ${JSON.stringify(data.planned.stakeholders || [])}
`
    : "Not specified"
}

ACTUAL OUTCOMES:
${
  data.actual
    ? // Example: After retrieving ground truth data (e.g., from LLM/memory)
      // if (result && result.metadata) {
      //   const metadata = validateGroundTruthMetadata(result.metadata);
      //   assertHighConfidence(metadata, 0.9);
      //   assertProvenance(metadata);
      // }
      `
- Realized Value: $${data.actual.realizedValue?.toLocaleString() || "Not specified"}
- Achievement Date: ${data.actual.achievementDate || "Not specified"}
- Actual Timeframe: ${data.actual.actualTimeframe || "Not specified"}
- Met Criteria: ${JSON.stringify(data.actual.metCriteria || [])}
- Missed Criteria: ${JSON.stringify(data.actual.missedCriteria || [])}
- Unexpected Outcomes: ${JSON.stringify(data.actual.unexpectedOutcomes || [])}
`
    : "Not specified"
}

IMPACT DATA:
${data.impact ? JSON.stringify(data.impact, null, 2) : "Not specified"}

METRICS AND OUTCOMES:
${data.metrics ? JSON.stringify(data.metrics, null, 2) : "Not specified"}
${data.outcomes ? JSON.stringify(data.outcomes, null, 2) : "Not specified"}

Please provide analysis in this JSON format:
{
  "analysis": {
    "valueGap": 100000,
    "valueGapPercentage": 20,
    "timeframeVariance": "2 months delay",
    "successRate": 0.8,
    "lessons": [
      {
        "category": "process",
        "lesson": "Lesson description",
        "impact": "positive",
        "actionability": "immediate"
      }
    ],
    "successFactors": ["Factor 1", "Factor 2"],
    "improvementAreas": ["Area 1", "Area 2"]
  },
  "impact": {
    "financial": {
      "directRevenue": 500000,
      "costSavings": 100000,
      "efficiencyGains": 50000,
      "totalImpact": 650000
    },
    "operational": {
      "processImprovements": ["Improvement 1"],
      "capabilityEnhancements": ["Enhancement 1"],
      "riskReductions": ["Risk reduction 1"]
    },
    "strategic": {
      "marketPosition": "Improved market position",
      "competitiveAdvantage": "New competitive advantage",
      "customerSatisfaction": "Increased satisfaction"
    }
  },
  "nextSteps": {
    "immediate": ["Step 1"],
    "shortTerm": ["Step 2"],
    "longTerm": ["Step 3"]
  },
  "recommendations": {
    "forFutureCases": ["Recommendation 1"],
    "forProcessImprovement": ["Recommendation 2"],
    "forStakeholderManagement": ["Recommendation 3"]
  }
}

Focus on providing actionable insights and lessons learned that can improve future value cases.
    `.trim();
  }

  private parseRealizationResponse(content: string, data: Record<string, any>): ValueRealization {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);

        // Calculate value gap
        const plannedValue = data.planned?.expectedValue || 0;
        const realizedValue = data.actual?.realizedValue || 0;
        const valueGap = plannedValue - realizedValue;
        const valueGapPercentage = plannedValue > 0 ? (valueGap / plannedValue) * 100 : 0;

        return {
          realizationId: `realization-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          valueCaseId: data.valueCaseId || "unknown",
          title: data.title || "Value Realization Analysis",
          description: data.description || "Analysis of value realization outcomes",
          planned: data.planned || {
            expectedValue: 0,
            timeframe: "Not specified",
            successCriteria: [],
            stakeholders: [],
          },
          actual: data.actual || {
            realizedValue: 0,
            achievementDate: new Date().toISOString(),
            actualTimeframe: "Not specified",
            metCriteria: [],
            missedCriteria: [],
            unexpectedOutcomes: [],
          },
          analysis: {
            valueGap,
            valueGapPercentage,
            timeframeVariance: parsed.analysis?.timeframeVariance || "Not specified",
            successRate: parsed.analysis?.successRate || 0,
            lessons: parsed.analysis?.lessons || [],
            successFactors: parsed.analysis?.successFactors || [],
            improvementAreas: parsed.analysis?.improvementAreas || [],
          },
          impact: parsed.impact || {
            financial: {
              directRevenue: 0,
              costSavings: 0,
              efficiencyGains: 0,
              totalImpact: 0,
            },
            operational: {
              processImprovements: [],
              capabilityEnhancements: [],
              riskReductions: [],
            },
            strategic: {
              marketPosition: "Not specified",
              competitiveAdvantage: "Not specified",
              customerSatisfaction: "Not specified",
            },
          },
          nextSteps: parsed.nextSteps || {
            immediate: [],
            shortTerm: [],
            longTerm: [],
          },
          recommendations: parsed.recommendations || {
            forFutureCases: [],
            forProcessImprovement: [],
            forStakeholderManagement: [],
          },
        };
      }
    } catch (error) {
      // If JSON parsing fails, create a basic realization
      return this.createBasicRealization(data);
    }

    return this.createBasicRealization(data);
  }

  private createBasicRealization(data: Record<string, any>): ValueRealization {
    const plannedValue = data.planned?.expectedValue || 0;
    const realizedValue = data.actual?.realizedValue || 0;
    const valueGap = plannedValue - realizedValue;
    const valueGapPercentage = plannedValue > 0 ? (valueGap / plannedValue) * 100 : 0;

    const metCriteria = data.actual?.metCriteria || [];
    const totalCriteria = data.planned?.successCriteria || [];
    const successRate = totalCriteria.length > 0 ? metCriteria.length / totalCriteria.length : 0;

    return {
      realizationId: `realization-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      valueCaseId: data.valueCaseId || "unknown",
      title: data.title || "Value Realization Analysis",
      description: data.description || "Analysis of value realization outcomes",
      planned: data.planned || {
        expectedValue: 0,
        timeframe: "Not specified",
        successCriteria: [],
        stakeholders: [],
      },
      actual: data.actual || {
        realizedValue: 0,
        achievementDate: new Date().toISOString(),
        actualTimeframe: "Not specified",
        metCriteria: [],
        missedCriteria: [],
        unexpectedOutcomes: [],
      },
      analysis: {
        valueGap,
        valueGapPercentage,
        timeframeVariance: "Not specified",
        successRate,
        lessons: [
          {
            category: "process",
            lesson: "Value realization tracking is essential",
            impact: "neutral",
            actionability: "immediate",
          },
        ],
        successFactors: ["Stakeholder engagement", "Clear objectives"],
        improvementAreas: ["Better planning", "Enhanced monitoring"],
      },
      impact: {
        financial: {
          directRevenue: realizedValue,
          costSavings: 0,
          efficiencyGains: 0,
          totalImpact: realizedValue,
        },
        operational: {
          processImprovements: ["Completed value case process"],
          capabilityEnhancements: ["New capabilities developed"],
          riskReductions: ["Reduced business risk"],
        },
        strategic: {
          marketPosition: "Value demonstrated",
          competitiveAdvantage: "Case study created",
          customerSatisfaction: "Positive outcomes achieved",
        },
      },
      nextSteps: {
        immediate: ["Document lessons learned"],
        shortTerm: ["Share success story"],
        longTerm: ["Apply lessons to future cases"],
      },
      recommendations: {
        forFutureCases: ["Better initial planning"],
        forProcessImprovement: ["Enhanced tracking"],
        forStakeholderManagement: ["Regular communication"],
      },
    };
  }

  private async storeRealizationAnalysis(
    realization: ValueRealization,
    request: AgentRequest
  ): Promise<void> {
    // Store the realization in episodic memory
    await this.storeMemory("episodic", `Value Realization: ${realization.title}`, {
      realization,
      requestId: request.id,
      timestamp: new Date().toISOString(),
    });

    // Store key insights in semantic memory
    await this.storeMemory(
      "semantic",
      `Value realization for ${realization.valueCaseId}: ${realization.analysis.successRate.toFixed(2)} success rate`,
      {
        realizationId: realization.realizationId,
        valueCaseId: realization.valueCaseId,
        successRate: realization.analysis.successRate,
        valueGap: realization.analysis.valueGap,
        totalImpact: realization.impact.financial.totalImpact,
      }
    );
  }

  private realizationResponse(realization: ValueRealization): string {
    const { analysis, impact, nextSteps, recommendations } = realization;

    return `
# Value Realization Analysis

## Overview
**Value Case ID**: ${realization.valueCaseId}
**Title**: ${realization.title}
**Description**: ${realization.description}

## Planned vs Actual Outcomes

### Planned
- **Expected Value**: $${realization.planned.expectedValue.toLocaleString()}
- **Timeframe**: ${realization.planned.timeframe}
- **Success Criteria**: ${realization.planned.successCriteria.join(", ")}
- **Stakeholders**: ${realization.planned.stakeholders.join(", ")}

### Actual
- **Realized Value**: $${realization.actual.realizedValue.toLocaleString()}
- **Achievement Date**: ${realization.actual.achievementDate}
- **Actual Timeframe**: ${realization.actual.actualTimeframe}
- **Met Criteria**: ${realization.actual.metCriteria.join(", ") || "None"}
- **Missed Criteria**: ${realization.actual.missedCriteria.join(", ") || "None"}
- **Unexpected Outcomes**: ${realization.actual.unexpectedOutcomes.join(", ") || "None"}

## Analysis Results

### Performance Metrics
- **Value Gap**: $${realization.analysis.valueGap.toLocaleString()} (${realization.analysis.valueGapPercentage.toFixed(1)}%)
- **Success Rate**: ${(realization.analysis.successRate * 100).toFixed(1)}%
- **Timeframe Variance**: ${realization.analysis.timeframeVariance}

### Lessons Learned
${analysis.lessons
  .map(
    (lesson, index) => `
#### ${index + 1}. ${lesson.lesson}
- **Category**: ${lesson.category}
- **Impact**: ${lesson.impact}
- **Actionability**: ${lesson.actionability}
`
  )
  .join("\n")}

### Success Factors
${analysis.successFactors.map((factor) => `- ${factor}`).join("\n")}

### Improvement Areas
${analysis.improvementAreas.map((area) => `- ${area}`).join("\n")}

## Impact Assessment

### Financial Impact
- **Direct Revenue**: $${impact.financial.directRevenue.toLocaleString()}
- **Cost Savings**: $${impact.financial.costSavings.toLocaleString()}
- **Efficiency Gains**: $${impact.financial.efficiencyGains.toLocaleString()}
- **Total Impact**: $${impact.financial.totalImpact.toLocaleString()}

### Operational Impact
- **Process Improvements**: ${impact.operational.processImprovements.join(", ") || "None identified"}
- **Capability Enhancements**: ${impact.operational.capabilityEnhancements.join(", ") || "None identified"}
- **Risk Reductions**: ${impact.operational.riskReductions.join(", ") || "None identified"}

### Strategic Impact
- **Market Position**: ${impact.strategic.marketPosition}
- **Competitive Advantage**: ${impact.strategic.competitiveAdvantage}
- **Customer Satisfaction**: ${impact.strategic.customerSatisfaction}

## Next Steps

### Immediate Actions
${nextSteps.immediate.map((step, index) => `${index + 1}. ${step}`).join("\n")}

### Short-term Actions
${nextSteps.shortTerm.map((step, index) => `${index + 1}. ${step}`).join("\n")}

### Long-term Actions
${nextSteps.longTerm.map((step, index) => `${index + 1}. ${step}`).join("\n")}

## Recommendations

### For Future Cases
${recommendations.forFutureCases.map((rec, index) => `${index + 1}. ${rec}`).join("\n")}

### For Process Improvement
${recommendations.forProcessImprovement.map((rec, index) => `${index + 1}. ${rec}`).join("\n")}

### For Stakeholder Management
${recommendations.forStakeholderManagement.map((rec, index) => `${index + 1}. ${rec}`).join("\n")}

## Summary
This value case achieved a ${(realization.analysis.successRate * 100).toFixed(1)}% success rate with a total financial impact of $${realization.impact.financial.totalImpact.toLocaleString()}.
${realization.analysis.valueGap > 0 ? `There was a value gap of $${realization.analysis.valueGap.toLocaleString()} which should be investigated.` : "The case met or exceeded expectations."}

Key lessons should be applied to future value cases to improve success rates and value realization.
    `.trim();
  }

  private createErrorResponse(error: Error, executionTime: number): AgentResponse {
    return this.createResponse(
      false,
      `Error analyzing value realization: ${error.message}`,
      0,
      undefined,
      undefined,
      undefined,
      executionTime
    );
  }

  // Additional utility methods
  async getRealizationHistory(valueCaseId?: string, limit: number = 10): Promise<any> {
    const query: any = {
      type: "episodic",
      limit,
    };

    if (valueCaseId) {
      query.searchText = valueCaseId;
    }

    return await this.searchMemory(query);
  }

  async updateRealization(
    realizationId: string,
    updates: Partial<ValueRealization>
  ): Promise<boolean> {
    try {
      const memory = await this.retrieveMemory(realizationId);
      if (!memory || memory.type !== "episodic") {
        return false;
      }

      const realization = memory.metadata?.realization as ValueRealization;
      if (!realization) {
        return false;
      }

      const updatedRealization = { ...realization, ...updates };

      // Store updated analysis
      await this.storeMemory("episodic", `Updated Value Realization: ${updatedRealization.title}`, {
        realization: updatedRealization,
        originalRealizationId: realizationId,
        updatedAt: new Date().toISOString(),
      });

      return true;
    } catch (error) {
      return false;
    }
  }

  async aggregateRealizationInsights(timeframe?: { start: Date; end: Date }): Promise<any> {
    const query: any = {
      type: "episodic",
      limit: 100,
    };

    if (timeframe) {
      query.timeRange = timeframe;
    }

    const results = await this.searchMemory(query);

    // Aggregate insights from multiple realizations
    const realizations = results.entries
      .map((entry) => entry.metadata?.realization)
      .filter(Boolean);

    if (realizations.length === 0) {
      return {
        totalCases: 0,
        averageSuccessRate: 0,
        totalImpact: 0,
        commonLessons: [],
        topImprovementAreas: [],
      };
    }

    const totalCases = realizations.length;
    const averageSuccessRate =
      realizations.reduce((sum, r) => sum + r.analysis.successRate, 0) / totalCases;
    const totalImpact = realizations.reduce((sum, r) => sum + r.impact.financial.totalImpact, 0);

    // Extract common lessons
    const allLessons = realizations.flatMap((r) => r.analysis.lessons.map((l) => l.lesson));
    const lessonCounts = allLessons.reduce((acc, lesson) => {
      acc[lesson] = (acc[lesson] || 0) + 1;
      return acc;
    }, {});

    const commonLessons = Object.entries(lessonCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([lesson, count]) => ({ lesson, frequency: count }));

    // Extract top improvement areas
    const allImprovements = realizations.flatMap((r) => r.analysis.improvementAreas);
    const improvementCounts = allImprovements.reduce((acc, area) => {
      acc[area] = (acc[area] || 0) + 1;
      return acc;
    }, {});

    const topImprovementAreas = Object.entries(improvementCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([area, count]) => ({ area, frequency: count }));

    return {
      totalCases,
      averageSuccessRate,
      totalImpact,
      commonLessons,
      topImprovementAreas,
    };
  }
}
