/**
 * Fallback AI Service
 *
 * Provides graceful degradation when primary AI services fail.
 * Returns structured error states — never fake analysis data.
 */

import { logger } from '../../lib/logger.js'

import { AIResponseSchema } from './AgentChatService.js'

export interface DegradedResponse {
  degraded: true;
  reason: string;
  retryable: boolean;
}

export class FallbackAIService {
  /**
   * Generate a budget-limit fallback message. This is the only acceptable
   * "soft" fallback — the user's quota is exhausted, not a system failure.
   */
  static generateFallbackResponse(query: string): string {
    logger.warn('Using fallback AI response due to budget limits', {
      queryLength: query.length,
    });

    return "Your monthly LLM token budget has been reached. Please try again later or upgrade your plan for full model access.";
  }

  /**
   * Return a structured degraded state when AI services are unavailable.
   * Callers must surface this to the user as an error, not as analysis output.
   *
   * @throws Never — returns a typed degraded response so callers can decide
   *   how to present the failure.
   */
  static generateFallbackAnalysis(
    _query: string,
    _context?: Record<string, unknown>,
    failureReason?: string,
  ): AIResponseSchema & DegradedResponse {
    const reason = failureReason ?? 'AI service temporarily unavailable';

    logger.warn('AI service unavailable — returning degraded state', { reason });

    return {
      degraded: true,
      reason,
      retryable: true,
      analysisSummary: `Analysis unavailable: ${reason}. Please retry.`,
      identifiedIndustry: 'Unknown',
      valueHypotheses: [],
      keyMetrics: [],
      recommendedActions: ['Retry the request', 'Contact support if the issue persists'],
    };
  }

  /**
   * No-op stub. In-memory analysis caching was removed; the LLM gateway's
   * built-in response cache handles deduplication. Kept for call-site
   * compatibility with AgentChatService.
   */
  static cacheAnalysis(_caseId: string, _analysis: AIResponseSchema): void {
    // intentional no-op
  }

  /**
   * No-op stub. Always returns null so callers fall through to
   * generateFallbackAnalysis(). Kept for call-site compatibility.
   */
  static getCachedAnalysis(_caseId: string): AIResponseSchema | null {
    return null;
  }

  /**
   * Check if fallback should be used based on error patterns.
   * Only transient infrastructure errors qualify — not validation or auth errors.
   */
  static shouldUseFallback(error: unknown): boolean {
    const errorMessage = (error instanceof Error ? error.message : String(error)).toLowerCase();

    const transientTriggers = [
      'network',
      'timeout',
      'rate limit',
      'service unavailable',
      'econnrefused',
      'econnreset',
      '500',
      '502',
      '503',
      '504',
    ];

    return transientTriggers.some(trigger => errorMessage.includes(trigger));
  }
}
