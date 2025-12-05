/**
 * Secure Opportunity Agent Example
 * 
 * Example implementation showing how to use the LLM Security Framework
 * with structured outputs and hallucination detection.
 * 
 * This is a reference implementation. To update existing agents:
 * 1. Import SecureAgentOutput schemas
 * 2. Define result schema with Zod
 * 3. Use secureInvoke() instead of direct LLM calls
 * 4. Handle validation results appropriately
 */

import { z } from 'zod';
import { BaseAgent } from './BaseAgent';
import { LLMGateway } from '../LLMGateway';
import { MemorySystem } from '../MemorySystem';
import { AuditLogger } from '../AuditLogger';
import { SupabaseClient } from '@supabase/supabase-js';

// Define the result schema for opportunity analysis
const OpportunityResultSchema = z.object({
  opportunity_summary: z.string().describe('Brief summary of the opportunity'),
  persona_fit: z.object({
    score: z.number().min(0).max(1).describe('Fit score (0-1)'),
    role: z.string().describe('Target role'),
    seniority: z.string().describe('Seniority level'),
    decision_authority: z.enum(['low', 'medium', 'high']).describe('Decision-making authority'),
    fit_reasoning: z.string().describe('Why this persona is a good fit')
  }),
  business_objectives: z.array(z.object({
    name: z.string(),
    description: z.string(),
    priority: z.number().min(1).max(5),
    owner: z.string().optional()
  })),
  pain_points: z.array(z.object({
    category: z.enum(['cost', 'time', 'quality', 'risk', 'compliance']),
    description: z.string(),
    severity: z.enum(['low', 'medium', 'high']),
    frequency: z.string(),
    estimated_annual_cost: z.number().optional(),
    affected_stakeholders: z.array(z.string())
  })),
  initial_value_model: z.object({
    outcomes: z.array(z.object({
      name: z.string(),
      description: z.string(),
      measurement: z.string(),
      timeframe: z.string()
    })),
    kpis: z.array(z.object({
      name: z.string(),
      baseline: z.number(),
      target: z.number(),
      unit: z.string(),
      measurement_type: z.enum(['time', 'cost', 'quality', 'quantity'])
    })),
    financial_impact: z.object({
      revenue_opportunity: z.number(),
      cost_savings: z.number(),
      risk_reduction: z.number(),
      total_value: z.number(),
      confidence_level: z.enum(['low', 'medium', 'high'])
    })
  }),
  recommended_capability_tags: z.array(z.string())
});

type OpportunityResult = z.infer<typeof OpportunityResultSchema>;

export class SecureOpportunityAgent extends BaseAgent {
  public lifecycleStage = 'opportunity';
  public version = '2.0.0'; // Updated version with security framework
  public name = 'OpportunityAgent';

  constructor(
    llmGateway: LLMGateway,
    memorySystem: MemorySystem,
    auditLogger: AuditLogger,
    supabase?: SupabaseClient | null
  ) {
    super('opportunity-agent', llmGateway, memorySystem, auditLogger, supabase);
  }

  /**
   * Execute opportunity analysis with secure invocation
   */
  async execute(sessionId: string, input: any): Promise<any> {
    // Use the secure invocation method
    const result = await this.secureInvoke(
      sessionId,
      input,
      OpportunityResultSchema,
      {
        confidenceThresholds: {
          acceptable: 0.7,
          minimum: 0.5,
          review_required: 0.6
        },
        throwOnLowConfidence: false, // Don't throw, handle gracefully
        trackPrediction: true, // Store for accuracy tracking
        context: {
          stage: 'opportunity',
          requiresHighConfidence: false
        }
      }
    );

    // Handle low confidence results
    if (result.confidence_level === 'low') {
      await this.handleLowConfidence(sessionId, result);
    }

    // Handle hallucination detection
    if (result.hallucination_check) {
      await this.handleHallucination(sessionId, result);
    }

    // Log data gaps for improvement
    if (result.data_gaps.length > 0) {
      await this.logDataGaps(sessionId, result.data_gaps);
    }

    // Return the result with metadata
    return {
      ...result.result,
      metadata: {
        confidence_level: result.confidence_level,
        confidence_score: result.confidence_score,
        hallucination_detected: result.hallucination_check,
        assumptions_count: result.assumptions.length,
        data_gaps_count: result.data_gaps.length,
        processing_time_ms: result.processing_time_ms
      }
    };
  }

  /**
   * Handle low confidence results
   */
  private async handleLowConfidence(sessionId: string, result: any): Promise<void> {
    await this.auditLogger.logAction(sessionId, this.agentId, 'low_confidence_detected', {
      confidence_level: result.confidence_level,
      confidence_score: result.confidence_score,
      assumptions: result.assumptions,
      data_gaps: result.data_gaps
    });

    // Could trigger human review, request more data, etc.
  }

  /**
   * Handle hallucination detection
   */
  private async handleHallucination(sessionId: string, result: any): Promise<void> {
    await this.auditLogger.logAction(sessionId, this.agentId, 'hallucination_detected', {
      hallucination_reasons: result.hallucination_reasons,
      confidence_level: result.confidence_level,
      assumptions: result.assumptions
    });

    // Could trigger alert, fallback to rule-based system, etc.
  }

  /**
   * Log data gaps for improvement
   */
  private async logDataGaps(sessionId: string, dataGaps: any[]): Promise<void> {
    for (const gap of dataGaps) {
      await this.auditLogger.logAction(sessionId, this.agentId, 'data_gap_identified', {
        field: gap.field,
        severity: gap.severity,
        impact: gap.impact,
        suggestion: gap.suggestion
      });
    }
  }
}

/**
 * Example usage:
 * 
 * const agent = new SecureOpportunityAgent(llmGateway, memorySystem, auditLogger, supabase);
 * 
 * const result = await agent.execute('session-123', {
 *   customer_context: 'Manufacturing company seeking efficiency improvements',
 *   pain_points: ['Manual processes', 'High operational costs'],
 *   company_size: 'enterprise',
 *   industry: 'manufacturing'
 * });
 * 
 * // Result includes:
 * // - Structured opportunity analysis
 * // - Confidence scores
 * // - Hallucination detection
 * // - Assumptions and data gaps
 * // - Evidence and reasoning
 * 
 * // Check confidence
 * if (result.metadata.confidence_level === 'low') {
 *   console.warn('Low confidence result - may need human review');
 * }
 * 
 * // Check for hallucinations
 * if (result.metadata.hallucination_detected) {
 *   console.warn('Potential hallucination detected');
 * }
 */
