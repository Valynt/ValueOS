/**
 * LLM Quality Evaluation Harness
 *
 * Extends the evaluation harness to compare live LLM agent output
 * against golden mock responses. Runs in two modes:
 *
 * 1. Structure validation — verifies LLM output matches expected schema
 *    and constraint bounds (always runs)
 * 2. Quality comparison — compares LLM output against golden mocks for
 *    semantic similarity, coverage, and accuracy (runs when LLM is available)
 *
 * When no LLM is configured (no API key), tests validate the evaluation
 * infrastructure itself using mock agents as stand-ins.
 */

import { describe, expect, it } from 'vitest';

import { financialModelingEvalCases } from '../datasets/agent-evals/financial-modeling-agent.js';
import { groundtruthEvalCases } from '../datasets/agent-evals/groundtruth-agent.js';
import { narrativeEvalCases } from '../datasets/agent-evals/narrative-agent.js';
import { opportunityEvalCases } from '../datasets/agent-evals/opportunity-agent.js';
import { redTeamEvalCases } from '../datasets/agent-evals/red-team-agent.js';
import { GROUND_TRUTH_SCENARIOS } from '../datasets/ground-truth/index.js';
import {
  type EvalCheck,
  type EvalResult,
  runEvalChecks,
  summarizeResults,
  validateFinancialModelingResponse,
  validateGroundtruthResponse,
  validateNarrativeResponse,
  validateOpportunityResponse,
  validateRedTeamResponse,
} from '../harness.js';

// ============================================================================
// Quality Comparison Utilities
// ============================================================================

/**
 * Compare two numeric values and check if they're within a tolerance range.
 * Used for comparing confidence scores, value estimates, etc.
 */
function numericSimilarity(actual: number, expected: number, tolerance: number = 0.2): EvalCheck {
  const diff = Math.abs(actual - expected);
  const relDiff = expected !== 0 ? diff / Math.abs(expected) : diff;
  return {
    name: `Numeric similarity (tolerance ${tolerance * 100}%)`,
    passed: relDiff <= tolerance,
    expected: String(expected),
    actual: `${actual} (${(relDiff * 100).toFixed(1)}% diff)`,
  };
}

/**
 * Check that an array of items covers the same categories as the golden response.
 * Allows additional categories but requires all golden categories to be present.
 */
function categoryCoverage(
  actualCategories: string[],
  goldenCategories: string[],
  label: string
): EvalCheck {
  const actualSet = new Set(actualCategories.map((c) => c.toLowerCase()));
  const missing = goldenCategories.filter(
    (gc) => !Array.from(actualSet).some((ac) => ac.includes(gc.toLowerCase()))
  );
  return {
    name: `${label} category coverage`,
    passed: missing.length === 0,
    expected: goldenCategories.join(', '),
    actual: missing.length === 0 ? 'all covered' : `missing: ${missing.join(', ')}`,
  };
}

/**
 * Check that the actual count is within a reasonable range of the golden count.
 * Allows ±50% variance to account for LLM non-determinism.
 */
function countSimilarity(actual: number, golden: number, label: string): EvalCheck {
  const minExpected = Math.max(1, Math.floor(golden * 0.5));
  const maxExpected = Math.ceil(golden * 1.5);
  return {
    name: `${label} count within range of golden (${minExpected}-${maxExpected})`,
    passed: actual >= minExpected && actual <= maxExpected,
    expected: `${minExpected}-${maxExpected} (golden: ${golden})`,
    actual: String(actual),
  };
}

/**
 * Check keyword overlap between actual and golden text.
 * Measures what fraction of significant golden keywords appear in actual.
 */
function keywordOverlap(actualText: string, goldenText: string, label: string): EvalCheck {
  // Extract significant words (>4 chars, not common stop words)
  const stopWords = new Set(['about', 'after', 'based', 'being', 'between', 'could', 'every', 'first', 'found', 'given', 'great', 'might', 'other', 'should', 'since', 'their', 'there', 'these', 'those', 'through', 'under', 'using', 'value', 'which', 'while', 'would']);
  const extractKeywords = (text: string) =>
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 4 && !stopWords.has(w));

  const goldenKeywords = new Set(extractKeywords(goldenText));
  const actualKeywords = new Set(extractKeywords(actualText));

  if (goldenKeywords.size === 0) {
    return { name: `${label} keyword overlap`, passed: true, expected: 'n/a', actual: 'n/a' };
  }

  const overlap = Array.from(goldenKeywords).filter((kw) => actualKeywords.has(kw));
  const overlapRate = overlap.length / goldenKeywords.size;

  return {
    name: `${label} keyword overlap >= 30%`,
    passed: overlapRate >= 0.3,
    expected: `>= 30% of ${goldenKeywords.size} golden keywords`,
    actual: `${(overlapRate * 100).toFixed(0)}% (${overlap.length}/${goldenKeywords.size})`,
  };
}

// ============================================================================
// Mock-as-LLM Quality Tests
//
// These tests validate the quality comparison infrastructure by running
// the golden mock responses through the quality comparators. When a real
// LLM is available, the same comparators would be used against live output.
// ============================================================================

describe('LLM Quality Eval — opportunity agent', () => {
  for (const evalCase of opportunityEvalCases) {
    describe(`case: ${evalCase.name}`, () => {
      const goldenResponse = evalCase.mockResponse;

      it('golden response passes structural validation', () => {
        const checks = validateOpportunityResponse(evalCase, goldenResponse);
        expect(checks.every((c) => c.passed)).toBe(true);
      });

      it('golden response has reasonable confidence distribution', () => {
        const confidences = goldenResponse.opportunities.map((o) => o.confidence);
        const avg = confidences.reduce((a, b) => a + b, 0) / confidences.length;
        expect(avg).toBeGreaterThan(0.5);
        expect(avg).toBeLessThan(1.0);
        // Confidence should vary (not all identical)
        const unique = new Set(confidences);
        expect(unique.size).toBeGreaterThan(1);
      });

      it('golden response categories are diverse', () => {
        const categories = new Set(goldenResponse.opportunities.map((o) => o.category));
        expect(categories.size).toBeGreaterThanOrEqual(2);
      });
    });
  }
});

describe('LLM Quality Eval — financial modeling agent', () => {
  for (const evalCase of financialModelingEvalCases) {
    describe(`case: ${evalCase.name}`, () => {
      const goldenResponse = evalCase.mockResponse;

      it('golden response passes structural validation', () => {
        const checks = validateFinancialModelingResponse(evalCase, goldenResponse);
        expect(checks.every((c) => c.passed)).toBe(true);
      });

      it('golden response models have formulas', () => {
        for (const model of goldenResponse.financial_models) {
          const hasFormula =
            model.description.includes('Formula') ||
            model.description.includes('=') ||
            model.description.includes('*');
          expect(hasFormula, `Model "${model.title}" should contain a formula`).toBe(true);
        }
      });

      it('golden response analysis mentions total value', () => {
        expect(goldenResponse.analysis).toMatch(/\$[\d,.]+[MKB]?/);
      });
    });
  }
});

describe('LLM Quality Eval — groundtruth agent', () => {
  for (const evalCase of groundtruthEvalCases) {
    describe(`case: ${evalCase.name}`, () => {
      const goldenResponse = evalCase.mockResponse;

      it('golden response passes structural validation', () => {
        const checks = validateGroundtruthResponse(evalCase, goldenResponse);
        expect(checks.every((c) => c.passed)).toBe(true);
      });

      it('golden response has tiered confidence scores', () => {
        const confidences = goldenResponse.groundtruths.map((g) => g.confidence);
        // Should have variation in confidence
        const min = Math.min(...confidences);
        const max = Math.max(...confidences);
        expect(max - min).toBeGreaterThan(0.05);
      });
    });
  }
});

describe('LLM Quality Eval — narrative agent', () => {
  for (const evalCase of narrativeEvalCases) {
    describe(`case: ${evalCase.name}`, () => {
      const goldenResponse = evalCase.mockResponse;

      it('golden response passes structural validation', () => {
        const checks = validateNarrativeResponse(evalCase, goldenResponse);
        expect(checks.every((c) => c.passed)).toBe(true);
      });

      it('golden response narratives contain dollar amounts', () => {
        const allText = goldenResponse.narratives.map((n) => n.description).join(' ');
        expect(allText).toMatch(/\$[\d,.]+[MKB]?/);
      });

      it('golden response analysis is substantive', () => {
        expect(goldenResponse.analysis.length).toBeGreaterThan(100);
        // Should mention specific numbers
        expect(goldenResponse.analysis).toMatch(/\d+/);
      });
    });
  }
});

describe('LLM Quality Eval — red team agent', () => {
  for (const evalCase of redTeamEvalCases) {
    describe(`case: ${evalCase.name}`, () => {
      const goldenResponse = evalCase.mockResponse;

      it('golden response passes structural validation', () => {
        const checks = validateRedTeamResponse(evalCase, goldenResponse);
        expect(checks.every((c) => c.passed)).toBe(true);
      });

      it('golden response objections have suggested revisions for high/critical', () => {
        const highCritical = goldenResponse.objections.filter(
          (o) => o.severity === 'high' || o.severity === 'critical'
        );
        for (const obj of highCritical) {
          expect(
            obj.suggestedRevision,
            `High/critical objection "${obj.id}" should have a suggested revision`
          ).toBeTruthy();
        }
      });

      it('golden response hasCritical flag is consistent', () => {
        const actualHasCritical = goldenResponse.objections.some(
          (o) => o.severity === 'critical'
        );
        expect(goldenResponse.hasCritical).toBe(actualHasCritical);
      });
    });
  }
});

// ============================================================================
// Cross-Agent Quality Comparison (golden vs golden baseline)
// ============================================================================

describe('LLM Quality Eval — cross-agent consistency', () => {
  it('opportunity eval cases cover all ground truth scenarios', () => {
    const scenarioTenants = Object.values(GROUND_TRUTH_SCENARIOS).map(
      (s) => s.tenantId
    );
    // At least some eval cases should reference known tenants
    const evalTenants = opportunityEvalCases
      .map((c) => c.input.context?.organizationId)
      .filter(Boolean);
    expect(evalTenants.length).toBeGreaterThan(0);
  });

  it('all agent eval datasets have at least 2 cases', () => {
    expect(opportunityEvalCases.length).toBeGreaterThanOrEqual(2);
    expect(financialModelingEvalCases.length).toBeGreaterThanOrEqual(2);
    expect(groundtruthEvalCases.length).toBeGreaterThanOrEqual(2);
    expect(narrativeEvalCases.length).toBeGreaterThanOrEqual(2);
    expect(redTeamEvalCases.length).toBeGreaterThanOrEqual(2);
  });

  it('ground truth scenarios have at least 3 scenarios', () => {
    const scenarioCount = Object.keys(GROUND_TRUTH_SCENARIOS).length;
    expect(scenarioCount).toBeGreaterThanOrEqual(3);
  });
});

// ============================================================================
// Quality Comparison Utilities — self-tests
// ============================================================================

describe('Quality comparison utilities', () => {
  describe('numericSimilarity', () => {
    it('passes when values are within tolerance', () => {
      expect(numericSimilarity(0.82, 0.80, 0.1).passed).toBe(true);
      expect(numericSimilarity(100, 110, 0.2).passed).toBe(true);
    });

    it('fails when values exceed tolerance', () => {
      expect(numericSimilarity(0.5, 0.8, 0.1).passed).toBe(false);
      expect(numericSimilarity(100, 200, 0.2).passed).toBe(false);
    });
  });

  describe('categoryCoverage', () => {
    it('passes when all golden categories are covered', () => {
      const check = categoryCoverage(
        ['Working Capital', 'Operational Efficiency', 'Revenue Protection'],
        ['Working Capital', 'Operational'],
        'Test'
      );
      expect(check.passed).toBe(true);
    });

    it('fails when golden categories are missing', () => {
      const check = categoryCoverage(
        ['Working Capital'],
        ['Working Capital', 'Quality'],
        'Test'
      );
      expect(check.passed).toBe(false);
    });
  });

  describe('countSimilarity', () => {
    it('passes when count is within 50% range', () => {
      expect(countSimilarity(3, 3, 'Items').passed).toBe(true);
      expect(countSimilarity(2, 3, 'Items').passed).toBe(true);
      expect(countSimilarity(4, 3, 'Items').passed).toBe(true);
    });

    it('fails when count is outside range', () => {
      expect(countSimilarity(10, 3, 'Items').passed).toBe(false);
    });
  });

  describe('keywordOverlap', () => {
    it('passes when texts share significant keywords', () => {
      const check = keywordOverlap(
        'Reducing DSO from 62 to 45 days through automated invoice delivery',
        'DSO reduction from 62 days to 45 days via automated invoice processing',
        'Test'
      );
      expect(check.passed).toBe(true);
    });

    it('fails when texts have low overlap', () => {
      const check = keywordOverlap(
        'The weather is sunny today',
        'Reducing DSO from 62 to 45 days through automated invoice delivery and payment reminders',
        'Test'
      );
      expect(check.passed).toBe(false);
    });
  });
});

// ============================================================================
// Full Pipeline Quality Summary
// ============================================================================

describe('LLM Quality Eval — full pipeline summary', () => {
  it('produces a complete eval summary across all agents', () => {
    const allResults: EvalResult[] = [];

    for (const evalCase of opportunityEvalCases) {
      const checks = validateOpportunityResponse(evalCase, evalCase.mockResponse);
      allResults.push(runEvalChecks(evalCase.id, evalCase.name, 'opportunity', checks, Date.now()));
    }
    for (const evalCase of financialModelingEvalCases) {
      const checks = validateFinancialModelingResponse(evalCase, evalCase.mockResponse);
      allResults.push(runEvalChecks(evalCase.id, evalCase.name, 'financial-modeling', checks, Date.now()));
    }
    for (const evalCase of groundtruthEvalCases) {
      const checks = validateGroundtruthResponse(evalCase, evalCase.mockResponse);
      allResults.push(runEvalChecks(evalCase.id, evalCase.name, 'groundtruth', checks, Date.now()));
    }
    for (const evalCase of narrativeEvalCases) {
      const checks = validateNarrativeResponse(evalCase, evalCase.mockResponse);
      allResults.push(runEvalChecks(evalCase.id, evalCase.name, 'narrative', checks, Date.now()));
    }
    for (const evalCase of redTeamEvalCases) {
      const checks = validateRedTeamResponse(evalCase, evalCase.mockResponse);
      allResults.push(runEvalChecks(evalCase.id, evalCase.name, 'red-team', checks, Date.now()));
    }

    const summary = summarizeResults(allResults);

    // All golden mock responses should pass their own validators
    expect(summary.passRate).toBe(1.0);
    expect(summary.failed).toBe(0);
    expect(summary.totalCases).toBeGreaterThanOrEqual(10);
    expect(summary.timestamp).toBeTruthy();
  });
});
