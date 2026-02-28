import { z } from "zod";

import { pillars } from "../../drizzle/schema";
import { safeLLMOperation } from "../_core/error-handling";
import { invokeLLM } from "../_core/llm";
import { protectedProcedure, rateLimitMiddleware, router } from "../_core/trpc";
import { getDb } from "../db";

/**
 * AI Tutor router
 * Handles AI-powered features including chat, ROI narratives, and value cases
 */
export const aiRouter = router({
  /**
   * Chat with AI tutor
   * Provides conversational assistance for VOS learning
   */
  chat: protectedProcedure
    .use(rateLimitMiddleware({ keyPrefix: "ai:chat", maxRequests: 20, windowMs: 60000 }))
    .input(z.object({
      messages: z.array(z.object({
        role: z.enum(["system", "user", "assistant"]),
        content: z.string()
      }))
    }))
    .mutation(async ({ ctx, input }) => {
      const response = await safeLLMOperation(
        () => invokeLLM({ messages: input.messages }),
        {
          maxRetries: 2,
          timeout: 30000,
          fallback: {
            choices: [{
              message: {
                content: "I apologize, but I'm temporarily unavailable. Please try again in a moment."
              }
            }]
          }
        }
      );
      
      return {
        content: response.choices[0]?.message?.content || "I apologize, but I couldn't generate a response. Please try again."
      };
    }),

  /**
   * Generate ROI narrative
   * Creates audience-specific ROI narratives for business cases
   */
  roiNarrative: protectedProcedure
    .use(rateLimitMiddleware({ keyPrefix: "ai:roi-narrative", maxRequests: 10, windowMs: 3600000 }))
    .input(z.object({
      businessCase: z.string(),
      benefits: z.array(z.string()),
      costs: z.object({
        implementation: z.number(),
        licensing: z.number().optional(),
        training: z.number().optional(),
      }),
      timeframe: z.enum(['1year', '2years', '3years']),
      audience: z.enum(['executive', 'finance', 'technical'])
    }))
    .mutation(async ({ ctx, input }) => {
      const { businessCase, benefits, costs, timeframe, audience } = input;

      const totalCosts = costs.implementation + (costs.licensing || 0) + (costs.training || 0);
      const years = timeframe === '1year' ? 1 : timeframe === '2years' ? 2 : 3;
      const annualBenefits = benefits.length * 50000;
      const totalBenefits = annualBenefits * years;

      const roi = totalBenefits > 0 ? ((totalBenefits - totalCosts) / totalCosts) * 100 : 0;
      const paybackPeriod = totalCosts / annualBenefits;

      let systemPrompt = "";
      if (audience === 'executive') {
        systemPrompt = `You are a senior executive communicating with other executives. Focus on strategic impact, competitive advantage, and business transformation. Use executive-level language and emphasize long-term value.`;
      } else if (audience === 'finance') {
        systemPrompt = `You are a CFO communicating with finance teams. Focus on financial metrics, ROI calculations, cash flow impact, and risk-adjusted returns. Use precise financial language and quantitative analysis.`;
      } else {
        systemPrompt = `You are a technical leader communicating with IT/engineering teams. Focus on technical feasibility, implementation approach, scalability, and operational efficiency. Use technical terminology and practical considerations.`;
      }

      const narrativePrompt = `
Business Case: ${businessCase}

Key Benefits: ${benefits.join(', ')}

Financial Details:
- Implementation Cost: $${costs.implementation.toLocaleString()}
- Licensing Cost: $${(costs.licensing || 0).toLocaleString()}/year
- Training Cost: $${(costs.training || 0).toLocaleString()}
- Timeframe: ${years} years
- Estimated Annual Benefits: $${annualBenefits.toLocaleString()}
- Total Benefits: $${totalBenefits.toLocaleString()}
- ROI: ${roi.toFixed(1)}%
- Payback Period: ${paybackPeriod.toFixed(1)} years

Create a compelling ROI narrative for a ${audience} audience that:
1. Opens with a strong business case hook
2. Quantifies the value opportunity
3. Presents financial analysis clearly
4. Addresses potential objections
5. Ends with a clear call to action
6. Uses appropriate language for the target audience

Format as a professional business case narrative.`;

      const response = await safeLLMOperation(
        () => invokeLLM({
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: narrativePrompt }
          ]
        }),
        {
          maxRetries: 2,
          timeout: 45000, // Longer timeout for narrative generation
          fallback: {
            choices: [{
              message: {
                content: "Unable to generate ROI narrative at this time. Please try again or contact support."
              }
            }]
          }
        }
      );

      const narrative = response.choices[0]?.message?.content || "Unable to generate ROI narrative. Please try again.";

      return {
        narrative,
        financials: {
          totalCosts,
          totalBenefits,
          roi: roi.toFixed(1),
        },
      };
    }),

  /**
   * Generate value case
   * Creates comprehensive value cases for VOS pillar implementations
   */
  valueCase: protectedProcedure
    .use(rateLimitMiddleware({ keyPrefix: "ai:value-case", maxRequests: 5, windowMs: 3600000 }))
    .input(z.object({
      pillarId: z.number(),
      outcomes: z.array(z.string()),
      capabilities: z.array(z.string()),
      kpis: z.array(z.object({
        name: z.string(),
        baseline: z.number(),
        target: z.number(),
        timeframe: z.string()
      })),
      costs: z.object({
        implementation: z.number(),
        licensing: z.number().optional(),
        training: z.number().optional(),
      }),
      audience: z.enum(['executive', 'finance', 'technical'])
    }))
    .mutation(async ({ ctx, input }) => {
      const { pillarId, outcomes, capabilities, kpis, costs, audience } = input;

      // Get pillar information
      const dbInstance = await getDb();
      if (!dbInstance) throw new Error("Database not available");
      const allPillars = await dbInstance.select().from(pillars);
      const pillar = allPillars.find(p => p.id === pillarId);

      // Calculate estimated benefits and ROI
      const totalCosts = costs.implementation + (costs.licensing || 0) + (costs.training || 0);
      const estimatedBenefits = kpis.reduce((sum, kpi) => {
        const improvement = kpi.target - kpi.baseline;
        return sum + (improvement * 10000);
      }, 0);

      const roi = estimatedBenefits > 0 ? ((estimatedBenefits - totalCosts) / totalCosts) * 100 : 0;

      let systemPrompt = "";
      if (audience === 'executive') {
        systemPrompt = `You are a senior value engineering executive creating a comprehensive value case for C-suite leadership. Focus on strategic business impact, competitive advantage, and transformation value. Use executive language and emphasize long-term strategic benefits.`;
      } else if (audience === 'finance') {
        systemPrompt = `You are a CFO preparing a detailed financial value case. Focus on quantifiable financial metrics, ROI calculations, cash flow analysis, and risk-adjusted returns. Use precise financial terminology and provide detailed financial analysis.`;
      } else {
        systemPrompt = `You are a technical leader building a value case for IT/engineering stakeholders. Focus on technical implementation, operational efficiency, scalability, and technical ROI. Use technical terminology and address implementation considerations.`;
      }

      const valueCasePrompt = `
VOS Value Case Framework - ${pillar?.title || 'Pillar'} Implementation

BUSINESS CONTEXT:
Pillar: ${pillar?.title || 'Unknown Pillar'}
Description: ${pillar?.description || 'No description available'}

VALUE COMPONENTS:
Outcomes: ${outcomes.join(', ')}
Capabilities: ${capabilities.join(', ')}
KPIs: ${kpis.map(kpi => `${kpi.name}: ${kpi.baseline} → ${kpi.target} (${kpi.timeframe})`).join(', ')}

FINANCIAL ANALYSIS:
Implementation Cost: $${costs.implementation.toLocaleString()}
Licensing Cost: $${(costs.licensing || 0).toLocaleString()}/year
Training Cost: $${(costs.training || 0).toLocaleString()}
Total Estimated Benefits: $${estimatedBenefits.toLocaleString()}
Estimated ROI: ${roi.toFixed(1)}%

TARGET AUDIENCE: ${audience}

Create a comprehensive value case that includes:
1. Executive Summary with business case
2. Current State Analysis (pain points, baseline metrics)
3. Proposed Solution (capabilities, implementation approach)
4. Value Proposition (outcomes, KPI improvements)
5. Financial Analysis (costs, benefits, ROI)
6. Implementation Plan and Timeline
7. Risk Mitigation and Success Metrics
8. Call to Action

Format as a professional value case document tailored for the ${audience} audience.`;

      const response = await safeLLMOperation(
        () => invokeLLM({
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: valueCasePrompt }
          ]
        }),
        {
          maxRetries: 2,
          timeout: 60000, // Longer timeout for comprehensive value case
          fallback: {
            choices: [{
              message: {
                content: "Unable to generate value case at this time. Please try again or contact support."
              }
            }]
          }
        }
      );

      const valueCase = response.choices[0]?.message?.content || "Unable to generate value case. Please try again.";

      return {
        valueCase,
        summary: {
          pillarTitle: pillar?.title || 'Unknown Pillar',
          totalOutcomes: outcomes.length,
          totalCapabilities: capabilities.length,
          totalKPIs: kpis.length,
          estimatedCosts: totalCosts,
          estimatedBenefits,
          roi: roi.toFixed(1)
        }
      };
    }),
});
