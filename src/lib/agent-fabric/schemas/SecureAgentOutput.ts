/**
 * Secure Agent Output Schema
 * 
 * Structured output schema for LLM responses with hallucination detection,
 * confidence scoring, and data quality tracking.
 */

import { z } from 'zod';

/**
 * Confidence level for agent predictions
 */
export const ConfidenceLevelSchema = z.enum(['low', 'medium', 'high']);
export type ConfidenceLevel = z.infer<typeof ConfidenceLevelSchema>;

/**
 * Assumption made during agent reasoning
 */
export const AssumptionSchema = z.object({
  assumption: z.string().describe('The assumption made'),
  source: z.string().describe('Source of the assumption (e.g., "user input", "historical data", "industry benchmark")'),
  confidence: z.number().min(0).max(1).describe('Confidence in this assumption (0-1)'),
  impact: z.enum(['low', 'medium', 'high']).optional().describe('Impact if assumption is wrong')
});

export type Assumption = z.infer<typeof AssumptionSchema>;

/**
 * Data gap identified during processing
 */
export const DataGapSchema = z.object({
  field: z.string().describe('Missing or incomplete data field'),
  severity: z.enum(['low', 'medium', 'high']).describe('Severity of the gap'),
  impact: z.string().describe('How this gap affects the output'),
  suggestion: z.string().optional().describe('Suggestion for filling the gap')
});

export type DataGap = z.infer<typeof DataGapSchema>;

/**
 * Evidence supporting the agent's conclusion
 */
export const EvidenceSchema = z.object({
  type: z.enum(['data_point', 'calculation', 'reference', 'heuristic']).describe('Type of evidence'),
  description: z.string().describe('Description of the evidence'),
  source: z.string().describe('Source of the evidence'),
  reliability: z.number().min(0).max(1).describe('Reliability score (0-1)')
});

export type Evidence = z.infer<typeof EvidenceSchema>;

/**
 * Base schema for secure agent outputs
 * All agent responses should extend this schema
 */
export const SecureAgentOutputSchema = z.object({
  // Core result (agent-specific, will be extended)
  result: z.any().describe('The main result from the agent'),
  
  // Confidence and quality indicators
  confidence_level: ConfidenceLevelSchema.describe('Overall confidence in the result'),
  confidence_score: z.number().min(0).max(1).optional().describe('Numeric confidence score (0-1)'),
  
  // Hallucination detection
  hallucination_check: z.boolean().describe('True if potential hallucination detected'),
  hallucination_reasons: z.array(z.string()).optional().describe('Reasons for hallucination flag'),
  
  // Supporting information
  assumptions: z.array(AssumptionSchema).describe('Assumptions made during processing'),
  data_gaps: z.array(DataGapSchema).describe('Identified data gaps or missing information'),
  evidence: z.array(EvidenceSchema).optional().describe('Evidence supporting the result'),
  
  // Reasoning trace
  reasoning: z.string().optional().describe('Explanation of the reasoning process'),
  alternative_interpretations: z.array(z.string()).optional().describe('Other possible interpretations considered'),
  
  // Metadata
  processing_time_ms: z.number().optional().describe('Time taken to process'),
  data_quality_score: z.number().min(0).max(1).optional().describe('Quality of input data (0-1)')
});

export type SecureAgentOutput = z.infer<typeof SecureAgentOutputSchema>;

/**
 * Create a typed schema for a specific agent result
 */
export function createSecureAgentSchema<T extends z.ZodType>(resultSchema: T) {
  return SecureAgentOutputSchema.extend({
    result: resultSchema
  });
}

/**
 * Confidence threshold configuration
 */
export interface ConfidenceThresholds {
  /** Minimum confidence to accept result without warning */
  acceptable: number;
  /** Minimum confidence to use result (below this, reject) */
  minimum: number;
  /** Threshold for triggering human review */
  review_required: number;
}

/**
 * Default confidence thresholds
 */
export const DEFAULT_CONFIDENCE_THRESHOLDS: ConfidenceThresholds = {
  acceptable: 0.7,
  minimum: 0.5,
  review_required: 0.6
};

/**
 * Validate confidence level against thresholds
 */
export function validateConfidence(
  confidence: number,
  thresholds: ConfidenceThresholds = DEFAULT_CONFIDENCE_THRESHOLDS
): {
  acceptable: boolean;
  usable: boolean;
  requiresReview: boolean;
  message: string;
} {
  const usable = confidence >= thresholds.minimum;
  const acceptable = confidence >= thresholds.acceptable;
  const requiresReview = confidence < thresholds.review_required;

  let message = '';
  if (!usable) {
    message = `Confidence ${confidence.toFixed(2)} below minimum threshold ${thresholds.minimum}`;
  } else if (requiresReview) {
    message = `Confidence ${confidence.toFixed(2)} requires human review (threshold: ${thresholds.review_required})`;
  } else if (!acceptable) {
    message = `Confidence ${confidence.toFixed(2)} below acceptable threshold ${thresholds.acceptable}`;
  } else {
    message = `Confidence ${confidence.toFixed(2)} is acceptable`;
  }

  return {
    acceptable,
    usable,
    requiresReview,
    message
  };
}

/**
 * Calculate overall confidence score from components
 */
export function calculateConfidenceScore(components: {
  dataQuality: number;
  assumptionConfidence: number;
  evidenceStrength: number;
  hallucinationRisk: number;
}): number {
  // Weighted average with hallucination risk as penalty
  const baseScore = (
    components.dataQuality * 0.3 +
    components.assumptionConfidence * 0.3 +
    components.evidenceStrength * 0.4
  );

  // Apply hallucination penalty
  const penalizedScore = baseScore * (1 - components.hallucinationRisk * 0.5);

  return Math.max(0, Math.min(1, penalizedScore));
}

/**
 * Determine confidence level from numeric score
 */
export function scoreToLevel(score: number): ConfidenceLevel {
  if (score >= 0.7) return 'high';
  if (score >= 0.5) return 'medium';
  return 'low';
}

/**
 * System prompt template for structured outputs
 */
export function getSecureAgentSystemPrompt(agentName: string, agentStage: string): string {
  return `You are ${agentName}, operating in the ${agentStage} stage of the value lifecycle.

CRITICAL INSTRUCTIONS:
1. Set hallucination_check=true if your response lacks supporting data or makes unsupported claims
2. Set confidence_level based on data quality and assumption strength:
   - "high": Strong data support, minimal assumptions, clear evidence
   - "medium": Moderate data support, some assumptions, reasonable evidence
   - "low": Limited data, many assumptions, weak evidence
3. Document ALL assumptions with their sources and confidence levels
4. Identify data gaps that affect your analysis
5. Provide evidence for your conclusions when available
6. If you're uncertain, say so explicitly in the reasoning

RESPONSE FORMAT:
You must respond with a valid JSON object matching the schema provided.
Do not include any text outside the JSON structure.`;
}

/**
 * Validate and enhance agent output
 */
export function validateAgentOutput(
  output: SecureAgentOutput,
  thresholds: ConfidenceThresholds = DEFAULT_CONFIDENCE_THRESHOLDS
): {
  valid: boolean;
  warnings: string[];
  errors: string[];
  enhanced: SecureAgentOutput;
} {
  const warnings: string[] = [];
  const errors: string[] = [];

  // Calculate confidence score if not provided
  let confidenceScore = output.confidence_score;
  if (!confidenceScore && output.assumptions.length > 0) {
    const avgAssumptionConfidence = output.assumptions.reduce(
      (sum, a) => sum + a.confidence, 0
    ) / output.assumptions.length;

    confidenceScore = calculateConfidenceScore({
      dataQuality: output.data_quality_score || 0.5,
      assumptionConfidence: avgAssumptionConfidence,
      evidenceStrength: output.evidence?.reduce((sum, e) => sum + e.reliability, 0) / (output.evidence?.length || 1) || 0.5,
      hallucinationRisk: output.hallucination_check ? 0.5 : 0
    });
  }

  // Validate confidence
  if (confidenceScore) {
    const validation = validateConfidence(confidenceScore, thresholds);
    if (!validation.usable) {
      errors.push(validation.message);
    } else if (validation.requiresReview) {
      warnings.push(validation.message);
    } else if (!validation.acceptable) {
      warnings.push(validation.message);
    }
  }

  // Check for hallucination
  if (output.hallucination_check) {
    warnings.push('Potential hallucination detected');
    if (output.hallucination_reasons) {
      warnings.push(...output.hallucination_reasons.map(r => `  - ${r}`));
    }
  }

  // Check for high-severity data gaps
  const criticalGaps = output.data_gaps.filter(g => g.severity === 'high');
  if (criticalGaps.length > 0) {
    warnings.push(`${criticalGaps.length} critical data gap(s) identified`);
  }

  // Check for low-confidence assumptions
  const riskyAssumptions = output.assumptions.filter(a => a.confidence < 0.5);
  if (riskyAssumptions.length > 0) {
    warnings.push(`${riskyAssumptions.length} low-confidence assumption(s)`);
  }

  return {
    valid: errors.length === 0,
    warnings,
    errors,
    enhanced: {
      ...output,
      confidence_score: confidenceScore
    }
  };
}
