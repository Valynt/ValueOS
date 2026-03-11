/**
 * Fallback AI Service
 *
 * Provides graceful degradation when primary AI services fail.
 * Implements rule-based responses and cached analysis patterns.
 */

import { logger } from '../lib/logger.js'

import { AIResponseSchema } from './AgentChatService.js'

export class FallbackAIService {
  /**
   * Generate a basic fallback response when budget limits require degradation
   */
  static generateFallbackResponse(query: string): string {
    logger.warn('Using fallback AI response due to budget limits', {
      queryLength: query.length,
    });

    return "You're currently receiving a fallback response because your monthly LLM token budget has been reached. Please try again later or upgrade your plan for full model access.";
  }

  /**
   * Generate a basic analysis when AI services are unavailable
   */
  static generateFallbackAnalysis(query: string, context?: any): AIResponseSchema {
    logger.warn('Using fallback AI service', { queryLength: query.length });

    const queryLower = query.toLowerCase();

    // Basic pattern matching for common requests
    let analysis = "I'm currently experiencing technical difficulties with my AI analysis engine. However, I can provide some basic guidance based on your request.\n\n";

    const hypotheses = [];
    const metrics: unknown[] = [];
    const actions = [
      "Please try again in a few moments",
      "Contact support if the issue persists",
      "Consider refreshing your session"
    ];

    // Pattern-based responses
    if (queryLower.includes('roi') || queryLower.includes('return')) {
      analysis += "For ROI analysis, focus on quantifiable metrics like cost savings, revenue impact, and efficiency gains.\n";
      hypotheses.push({
        title: "Cost Reduction Opportunity",
        description: "Identify areas where operational efficiency can reduce expenses",
        impact: "Medium",
        confidence: 60
      });
      metrics.push(
        { label: "Potential Savings", value: "TBD", trend: "up" },
        { label: "Implementation Cost", value: "TBD", trend: "neutral" }
      );
    } else if (queryLower.includes('value') || queryLower.includes('benefit')) {
      analysis += "Value analysis should focus on both quantitative and qualitative benefits for stakeholders.\n";
      hypotheses.push({
        title: "Stakeholder Value",
        description: "Map value propositions to key stakeholder groups",
        impact: "High",
        confidence: 65
      });
      metrics.push(
        { label: "Value Score", value: "TBD", trend: "up" },
        { label: "Alignment", value: "TBD", trend: "neutral" }
      );
    } else {
      analysis += "I recommend starting with a clear problem statement and identifying key stakeholders.\n";
      hypotheses.push({
        title: "Problem Clarification",
        description: "Define the core business challenge and success criteria",
        impact: "High",
        confidence: 70
      });
      metrics.push(
        { label: "Problem Clarity", value: "TBD", trend: "up" },
        { label: "Stakeholder Alignment", value: "TBD", trend: "neutral" }
      );
    }

    return {
      analysisSummary: analysis,
      identifiedIndustry: context?.industry || "General",
      valueHypotheses: hypotheses,
      keyMetrics: metrics,
      recommendedActions: actions
    };
  }

  /**
   * Check if fallback should be used based on error patterns
   */
  static shouldUseFallback(error: any): boolean {
    const errorMessage = error?.message?.toLowerCase() || '';

    // Network errors, rate limits, and service unavailable should trigger fallback
    const fallbackTriggers = [
      'network',
      'timeout',
      'rate limit',
      'service unavailable',
      '500',
      '502',
      '503',
      '504'
    ];

    return fallbackTriggers.some(trigger => errorMessage.includes(trigger));
  }

  /**
   * Get cached analysis if available
   */
  static getCachedAnalysis(caseId: string): AIResponseSchema | null {
    try {
      const cacheKey = `analysis_cache_${caseId}`;
      const cached = localStorage.getItem(cacheKey);

      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        const age = Date.now() - timestamp;

        // Use cache if less than 1 hour old
        if (age < 3600000) {
          logger.info('Using cached analysis', { caseId, age });
          return data;
        }
      }
    } catch (error) {
      logger.warn('Failed to retrieve cached analysis', error);
    }

    return null;
  }

  /**
   * Cache analysis for future fallback use
   */
  static cacheAnalysis(caseId: string, analysis: AIResponseSchema): void {
    try {
      const cacheKey = `analysis_cache_${caseId}`;
      const cacheData = {
        data: analysis,
        timestamp: Date.now()
      };

      localStorage.setItem(cacheKey, JSON.stringify(cacheData));
      logger.debug('Analysis cached', { caseId });
    } catch (error) {
      logger.warn('Failed to cache analysis', error);
    }
  }
}
