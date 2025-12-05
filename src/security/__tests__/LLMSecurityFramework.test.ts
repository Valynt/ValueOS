/**
 * LLM Security Framework Tests
 * 
 * Tests for structured outputs, hallucination detection, confidence scoring,
 * and prediction tracking.
 */

import { describe, expect, it, beforeEach, vi } from 'vitest';
import { z } from 'zod';
import {
  SecureAgentOutputSchema,
  createSecureAgentSchema,
  validateAgentOutput,
  validateConfidence,
  calculateConfidenceScore,
  scoreToLevel,
  getSecureAgentSystemPrompt,
  DEFAULT_CONFIDENCE_THRESHOLDS
} from '../../lib/agent-fabric/schemas/SecureAgentOutput';

describe('SecureAgentOutput - Schema Validation', () => {
  it('validates complete secure agent output', () => {
    const output = {
      result: { value: 100 },
      confidence_level: 'high' as const,
      confidence_score: 0.85,
      hallucination_check: false,
      assumptions: [
        {
          assumption: 'Market growth rate of 10%',
          source: 'industry benchmark',
          confidence: 0.8
        }
      ],
      data_gaps: [],
      reasoning: 'Based on historical data and market trends'
    };

    const result = SecureAgentOutputSchema.safeParse(output);
    expect(result.success).toBe(true);
  });

  it('requires mandatory fields', () => {
    const output = {
      result: { value: 100 },
      // Missing confidence_level
      hallucination_check: false,
      assumptions: [],
      data_gaps: []
    };

    const result = SecureAgentOutputSchema.safeParse(output);
    expect(result.success).toBe(false);
  });

  it('validates confidence level enum', () => {
    const output = {
      result: { value: 100 },
      confidence_level: 'invalid' as any,
      hallucination_check: false,
      assumptions: [],
      data_gaps: []
    };

    const result = SecureAgentOutputSchema.safeParse(output);
    expect(result.success).toBe(false);
  });

  it('validates assumption structure', () => {
    const output = {
      result: { value: 100 },
      confidence_level: 'medium' as const,
      hallucination_check: false,
      assumptions: [
        {
          assumption: 'Test assumption',
          source: 'test',
          confidence: 1.5 // Invalid: > 1
        }
      ],
      data_gaps: []
    };

    const result = SecureAgentOutputSchema.safeParse(output);
    expect(result.success).toBe(false);
  });

  it('validates data gap structure', () => {
    const output = {
      result: { value: 100 },
      confidence_level: 'low' as const,
      hallucination_check: true,
      assumptions: [],
      data_gaps: [
        {
          field: 'revenue_data',
          severity: 'high' as const,
          impact: 'Cannot calculate accurate ROI'
        }
      ]
    };

    const result = SecureAgentOutputSchema.safeParse(output);
    expect(result.success).toBe(true);
  });
});

describe('SecureAgentOutput - Custom Schema Creation', () => {
  it('creates typed schema with custom result type', () => {
    const resultSchema = z.object({
      roi: z.number(),
      payback_period: z.number()
    });

    const schema = createSecureAgentSchema(resultSchema);

    const output = {
      result: { roi: 1.5, payback_period: 18 },
      confidence_level: 'high' as const,
      hallucination_check: false,
      assumptions: [],
      data_gaps: []
    };

    const result = schema.safeParse(output);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.result.roi).toBe(1.5);
      expect(result.data.result.payback_period).toBe(18);
    }
  });

  it('rejects invalid result type', () => {
    const resultSchema = z.object({
      roi: z.number()
    });

    const schema = createSecureAgentSchema(resultSchema);

    const output = {
      result: { roi: 'invalid' }, // Should be number
      confidence_level: 'high' as const,
      hallucination_check: false,
      assumptions: [],
      data_gaps: []
    };

    const result = schema.safeParse(output);
    expect(result.success).toBe(false);
  });
});

describe('SecureAgentOutput - Confidence Validation', () => {
  it('validates acceptable confidence', () => {
    const result = validateConfidence(0.8);

    expect(result.acceptable).toBe(true);
    expect(result.usable).toBe(true);
    expect(result.requiresReview).toBe(false);
  });

  it('validates low but usable confidence', () => {
    const result = validateConfidence(0.55);

    expect(result.acceptable).toBe(false);
    expect(result.usable).toBe(true);
    expect(result.requiresReview).toBe(true);
  });

  it('rejects confidence below minimum', () => {
    const result = validateConfidence(0.4);

    expect(result.acceptable).toBe(false);
    expect(result.usable).toBe(false);
    expect(result.requiresReview).toBe(true);
  });

  it('uses custom thresholds', () => {
    const customThresholds = {
      acceptable: 0.8,
      minimum: 0.6,
      review_required: 0.7
    };

    const result = validateConfidence(0.65, customThresholds);

    expect(result.acceptable).toBe(false);
    expect(result.usable).toBe(true);
    expect(result.requiresReview).toBe(true);
  });
});

describe('SecureAgentOutput - Confidence Calculation', () => {
  it('calculates confidence from components', () => {
    const score = calculateConfidenceScore({
      dataQuality: 0.8,
      assumptionConfidence: 0.7,
      evidenceStrength: 0.9,
      hallucinationRisk: 0.1
    });

    expect(score).toBeGreaterThan(0.7);
    expect(score).toBeLessThan(0.9);
  });

  it('applies hallucination penalty', () => {
    const scoreWithoutHallucination = calculateConfidenceScore({
      dataQuality: 0.8,
      assumptionConfidence: 0.8,
      evidenceStrength: 0.8,
      hallucinationRisk: 0
    });

    const scoreWithHallucination = calculateConfidenceScore({
      dataQuality: 0.8,
      assumptionConfidence: 0.8,
      evidenceStrength: 0.8,
      hallucinationRisk: 0.5
    });

    expect(scoreWithHallucination).toBeLessThan(scoreWithoutHallucination);
  });

  it('clamps score to valid range', () => {
    const score = calculateConfidenceScore({
      dataQuality: 1.0,
      assumptionConfidence: 1.0,
      evidenceStrength: 1.0,
      hallucinationRisk: 0
    });

    expect(score).toBeLessThanOrEqual(1.0);
    expect(score).toBeGreaterThanOrEqual(0);
  });
});

describe('SecureAgentOutput - Score to Level Conversion', () => {
  it('converts high score to high level', () => {
    expect(scoreToLevel(0.85)).toBe('high');
    expect(scoreToLevel(0.7)).toBe('high');
  });

  it('converts medium score to medium level', () => {
    expect(scoreToLevel(0.65)).toBe('medium');
    expect(scoreToLevel(0.5)).toBe('medium');
  });

  it('converts low score to low level', () => {
    expect(scoreToLevel(0.45)).toBe('low');
    expect(scoreToLevel(0.2)).toBe('low');
  });
});

describe('SecureAgentOutput - Output Validation', () => {
  it('validates output with warnings', () => {
    const output = {
      result: { value: 100 },
      confidence_level: 'low' as const,
      confidence_score: 0.45,
      hallucination_check: true,
      hallucination_reasons: ['Insufficient data'],
      assumptions: [
        {
          assumption: 'Test',
          source: 'guess',
          confidence: 0.3
        }
      ],
      data_gaps: [
        {
          field: 'revenue',
          severity: 'high' as const,
          impact: 'Cannot calculate'
        }
      ]
    };

    const validation = validateAgentOutput(output);

    expect(validation.valid).toBe(false);
    expect(validation.warnings.length).toBeGreaterThan(0);
    expect(validation.errors.length).toBeGreaterThan(0);
  });

  it('validates output without issues', () => {
    const output = {
      result: { value: 100 },
      confidence_level: 'high' as const,
      confidence_score: 0.85,
      hallucination_check: false,
      assumptions: [
        {
          assumption: 'Market growth',
          source: 'industry data',
          confidence: 0.9
        }
      ],
      data_gaps: []
    };

    const validation = validateAgentOutput(output);

    expect(validation.valid).toBe(true);
    expect(validation.errors.length).toBe(0);
  });

  it('calculates confidence score if missing', () => {
    const output = {
      result: { value: 100 },
      confidence_level: 'medium' as const,
      hallucination_check: false,
      assumptions: [
        {
          assumption: 'Test',
          source: 'data',
          confidence: 0.7
        }
      ],
      data_gaps: []
    };

    const validation = validateAgentOutput(output);

    expect(validation.enhanced.confidence_score).toBeDefined();
    expect(validation.enhanced.confidence_score).toBeGreaterThan(0);
  });

  it('warns about hallucination detection', () => {
    const output = {
      result: { value: 100 },
      confidence_level: 'medium' as const,
      confidence_score: 0.6,
      hallucination_check: true,
      hallucination_reasons: ['Unsupported claim'],
      assumptions: [],
      data_gaps: []
    };

    const validation = validateAgentOutput(output);

    expect(validation.warnings).toContain('Potential hallucination detected');
  });

  it('warns about critical data gaps', () => {
    const output = {
      result: { value: 100 },
      confidence_level: 'medium' as const,
      confidence_score: 0.6,
      hallucination_check: false,
      assumptions: [],
      data_gaps: [
        {
          field: 'revenue',
          severity: 'high' as const,
          impact: 'Major impact'
        },
        {
          field: 'costs',
          severity: 'high' as const,
          impact: 'Major impact'
        }
      ]
    };

    const validation = validateAgentOutput(output);

    expect(validation.warnings.some(w => w.includes('critical data gap'))).toBe(true);
  });

  it('warns about low-confidence assumptions', () => {
    const output = {
      result: { value: 100 },
      confidence_level: 'medium' as const,
      confidence_score: 0.6,
      hallucination_check: false,
      assumptions: [
        {
          assumption: 'Risky assumption',
          source: 'guess',
          confidence: 0.3
        }
      ],
      data_gaps: []
    };

    const validation = validateAgentOutput(output);

    expect(validation.warnings.some(w => w.includes('low-confidence assumption'))).toBe(true);
  });
});

describe('SecureAgentOutput - System Prompt Generation', () => {
  it('generates system prompt with agent details', () => {
    const prompt = getSecureAgentSystemPrompt('OpportunityAgent', 'opportunity');

    expect(prompt).toContain('OpportunityAgent');
    expect(prompt).toContain('opportunity');
    expect(prompt).toContain('hallucination_check');
    expect(prompt).toContain('confidence_level');
  });

  it('includes critical instructions', () => {
    const prompt = getSecureAgentSystemPrompt('TargetAgent', 'target');

    expect(prompt).toContain('CRITICAL INSTRUCTIONS');
    expect(prompt).toContain('assumptions');
    expect(prompt).toContain('data gaps');
    expect(prompt).toContain('evidence');
  });

  it('specifies response format', () => {
    const prompt = getSecureAgentSystemPrompt('TestAgent', 'test');

    expect(prompt).toContain('RESPONSE FORMAT');
    expect(prompt).toContain('JSON');
  });
});

describe('SecureAgentOutput - Integration Scenarios', () => {
  it('handles complete prediction workflow', () => {
    // 1. Create schema
    const resultSchema = z.object({
      predicted_value: z.number(),
      timeframe: z.string()
    });
    const schema = createSecureAgentSchema(resultSchema);

    // 2. Parse output
    const output = {
      result: {
        predicted_value: 150000,
        timeframe: '12 months'
      },
      confidence_level: 'high' as const,
      confidence_score: 0.82,
      hallucination_check: false,
      assumptions: [
        {
          assumption: '10% market growth',
          source: 'industry report',
          confidence: 0.85
        }
      ],
      data_gaps: [],
      evidence: [
        {
          type: 'data_point' as const,
          description: 'Historical revenue data',
          source: 'company records',
          reliability: 0.9
        }
      ],
      reasoning: 'Based on historical trends and market analysis'
    };

    const parseResult = schema.safeParse(output);
    expect(parseResult.success).toBe(true);

    // 3. Validate output
    if (parseResult.success) {
      const validation = validateAgentOutput(parseResult.data);
      expect(validation.valid).toBe(true);
      expect(validation.enhanced.confidence_score).toBeGreaterThan(0.7);
    }
  });

  it('handles low-quality prediction', () => {
    const output = {
      result: { value: 100 },
      confidence_level: 'low' as const,
      confidence_score: 0.35,
      hallucination_check: true,
      hallucination_reasons: ['Insufficient data', 'Unsupported assumptions'],
      assumptions: [
        {
          assumption: 'Guessed value',
          source: 'none',
          confidence: 0.2
        }
      ],
      data_gaps: [
        {
          field: 'all_data',
          severity: 'high' as const,
          impact: 'Cannot make reliable prediction'
        }
      ]
    };

    const validation = validateAgentOutput(output);

    expect(validation.valid).toBe(false);
    expect(validation.errors.length).toBeGreaterThan(0);
    expect(validation.warnings.length).toBeGreaterThan(0);
  });
});
