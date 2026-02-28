/**
 * Evaluation Harness Tests
 *
 * Runs each agent's eval cases through the corresponding validator,
 * verifying that mock responses satisfy the declared expectations.
 */

import { describe, expect, it } from 'vitest';

import { financialModelingEvalCases } from '../datasets/agent-evals/financial-modeling-agent.js';
import { groundtruthEvalCases } from '../datasets/agent-evals/groundtruth-agent.js';
import { narrativeEvalCases } from '../datasets/agent-evals/narrative-agent.js';
import { opportunityEvalCases } from '../datasets/agent-evals/opportunity-agent.js';
import { redTeamEvalCases } from '../datasets/agent-evals/red-team-agent.js';
import {
  runEvalChecks,
  summarizeResults,
  validateFinancialModelingResponse,
  validateGroundtruthResponse,
  validateNarrativeResponse,
  validateOpportunityResponse,
  validateRedTeamResponse,
} from '../harness.js';

// ============================================================================
// Opportunity Agent Validator
// ============================================================================

describe('validateOpportunityResponse', () => {
  for (const evalCase of opportunityEvalCases) {
    it(`passes for case: ${evalCase.name} (${evalCase.id})`, () => {
      const checks = validateOpportunityResponse(evalCase, evalCase.mockResponse);
      const result = runEvalChecks(
        evalCase.id,
        evalCase.name,
        'opportunity',
        checks,
        Date.now()
      );

      for (const check of result.checks) {
        expect(check.passed, `Check failed: ${check.name} — expected ${check.expected}, got ${check.actual}`).toBe(true);
      }
      expect(result.passed).toBe(true);
    });
  }

  it('fails when opportunity count is below minimum', () => {
    const evalCase = opportunityEvalCases[0]!;
    const badResponse = {
      ...evalCase.mockResponse,
      opportunities: [evalCase.mockResponse.opportunities[0]!],
    };
    const checks = validateOpportunityResponse(evalCase, badResponse);
    const countCheck = checks.find((c) => c.name.includes('count >='));
    expect(countCheck?.passed).toBe(false);
  });

  it('fails when required keywords are missing', () => {
    const evalCase = opportunityEvalCases[0]!;
    const badResponse = {
      opportunities: [
        {
          title: 'Generic Opportunity',
          description: 'No relevant keywords here.',
          confidence: 0.9,
          category: 'Working Capital',
        },
      ],
      analysis: 'Nothing relevant.',
    };
    const checks = validateOpportunityResponse(evalCase, badResponse);
    const keywordCheck = checks.find((c) => c.name.includes('keywords'));
    expect(keywordCheck?.passed).toBe(false);
  });
});

// ============================================================================
// Financial Modeling Agent Validator
// ============================================================================

describe('validateFinancialModelingResponse', () => {
  for (const evalCase of financialModelingEvalCases) {
    it(`passes for case: ${evalCase.name} (${evalCase.id})`, () => {
      const checks = validateFinancialModelingResponse(evalCase, evalCase.mockResponse);
      const result = runEvalChecks(
        evalCase.id,
        evalCase.name,
        'financial-modeling',
        checks,
        Date.now()
      );

      for (const check of result.checks) {
        expect(check.passed, `Check failed: ${check.name} — expected ${check.expected}, got ${check.actual}`).toBe(true);
      }
      expect(result.passed).toBe(true);
    });
  }

  it('fails when model count is below minimum', () => {
    const evalCase = financialModelingEvalCases[0]!;
    const badResponse = {
      ...evalCase.mockResponse,
      financial_models: [evalCase.mockResponse.financial_models[0]!],
    };
    const checks = validateFinancialModelingResponse(evalCase, badResponse);
    const countCheck = checks.find((c) => c.name.includes('count >='));
    expect(countCheck?.passed).toBe(false);
  });

  it('fails when formulas are missing and required', () => {
    const evalCase = financialModelingEvalCases[0]!;
    const badResponse = {
      ...evalCase.mockResponse,
      financial_models: evalCase.mockResponse.financial_models.map((m) => ({
        ...m,
        description: 'No formula here, just a plain description without any math.',
      })),
    };
    const checks = validateFinancialModelingResponse(evalCase, badResponse);
    const formulaCheck = checks.find((c) => c.name.includes('formulas'));
    expect(formulaCheck?.passed).toBe(false);
  });
});

// ============================================================================
// Ground Truth Agent Validator
// ============================================================================

describe('validateGroundtruthResponse', () => {
  for (const evalCase of groundtruthEvalCases) {
    it(`passes for case: ${evalCase.name} (${evalCase.id})`, () => {
      const checks = validateGroundtruthResponse(evalCase, evalCase.mockResponse);
      const result = runEvalChecks(
        evalCase.id,
        evalCase.name,
        'groundtruth',
        checks,
        Date.now()
      );

      for (const check of result.checks) {
        expect(check.passed, `Check failed: ${check.name} — expected ${check.expected}, got ${check.actual}`).toBe(true);
      }
      expect(result.passed).toBe(true);
    });
  }

  it('fails when groundtruth count is below minimum', () => {
    const evalCase = groundtruthEvalCases[0]!;
    const badResponse = {
      ...evalCase.mockResponse,
      groundtruths: [],
    };
    const checks = validateGroundtruthResponse(evalCase, badResponse);
    const countCheck = checks.find((c) => c.name.includes('count >='));
    expect(countCheck?.passed).toBe(false);
  });

  it('fails when required categories are missing', () => {
    const evalCase = groundtruthEvalCases[0]!;
    const badResponse = {
      ...evalCase.mockResponse,
      groundtruths: evalCase.mockResponse.groundtruths.map((g) => ({
        ...g,
        category: 'Unrelated',
      })),
    };
    const checks = validateGroundtruthResponse(evalCase, badResponse);
    const catCheck = checks.find((c) => c.name.includes('categories'));
    expect(catCheck?.passed).toBe(false);
  });
});

// ============================================================================
// Narrative Agent Validator
// ============================================================================

describe('validateNarrativeResponse', () => {
  for (const evalCase of narrativeEvalCases) {
    it(`passes for case: ${evalCase.name} (${evalCase.id})`, () => {
      const checks = validateNarrativeResponse(evalCase, evalCase.mockResponse);
      const result = runEvalChecks(
        evalCase.id,
        evalCase.name,
        'narrative',
        checks,
        Date.now()
      );

      for (const check of result.checks) {
        expect(check.passed, `Check failed: ${check.name} — expected ${check.expected}, got ${check.actual}`).toBe(true);
      }
      expect(result.passed).toBe(true);
    });
  }

  it('fails when narrative count is below minimum', () => {
    const evalCase = narrativeEvalCases[0]!;
    const badResponse = {
      ...evalCase.mockResponse,
      narratives: [],
    };
    const checks = validateNarrativeResponse(evalCase, badResponse);
    const countCheck = checks.find((c) => c.name.includes('count >='));
    expect(countCheck?.passed).toBe(false);
  });

  it('fails when analysis is too short', () => {
    const evalCase = narrativeEvalCases[0]!;
    const badResponse = {
      ...evalCase.mockResponse,
      analysis: 'Short.',
    };
    const checks = validateNarrativeResponse(evalCase, badResponse);
    const lengthCheck = checks.find((c) => c.name.includes('length'));
    expect(lengthCheck?.passed).toBe(false);
  });

  it('fails when dollar amounts are missing and required', () => {
    const evalCase = narrativeEvalCases[0]!;
    if (!evalCase.expectations.requiresDollarAmounts) return;

    const badResponse = {
      ...evalCase.mockResponse,
      narratives: evalCase.mockResponse.narratives.map((n) => ({
        ...n,
        description: 'No dollar amounts mentioned anywhere in this text.',
      })),
    };
    const checks = validateNarrativeResponse(evalCase, badResponse);
    const dollarCheck = checks.find((c) => c.name.includes('dollar'));
    expect(dollarCheck?.passed).toBe(false);
  });
});

// ============================================================================
// Red Team Agent Validator
// ============================================================================

describe('validateRedTeamResponse', () => {
  for (const evalCase of redTeamEvalCases) {
    it(`passes for case: ${evalCase.name} (${evalCase.id})`, () => {
      const checks = validateRedTeamResponse(evalCase, evalCase.mockResponse);
      const result = runEvalChecks(
        evalCase.id,
        evalCase.name,
        'red-team',
        checks,
        Date.now()
      );

      for (const check of result.checks) {
        expect(check.passed, `Check failed: ${check.name} — expected ${check.expected}, got ${check.actual}`).toBe(true);
      }
      expect(result.passed).toBe(true);
    });
  }

  it('fails when objection count is below minimum', () => {
    const evalCase = redTeamEvalCases[0]!;
    const badResponse = {
      ...evalCase.mockResponse,
      objections: [],
    };
    const checks = validateRedTeamResponse(evalCase, badResponse);
    const countCheck = checks.find((c) => c.name.includes('count >='));
    expect(countCheck?.passed).toBe(false);
  });

  it('fails when hasCritical flag is inconsistent', () => {
    const evalCase = redTeamEvalCases[0]!;
    const badResponse = {
      ...evalCase.mockResponse,
      hasCritical: true, // No critical objections in case 001
    };
    const checks = validateRedTeamResponse(evalCase, badResponse);
    const criticalCheck = checks.find((c) => c.name.includes('hasCritical'));
    expect(criticalCheck?.passed).toBe(false);
  });

  it('detects critical objections correctly for manufacturing case', () => {
    const evalCase = redTeamEvalCases[1]!; // Manufacturing case with critical
    const checks = validateRedTeamResponse(evalCase, evalCase.mockResponse);
    const criticalCheck = checks.find((c) => c.name.includes('Critical objections'));
    expect(criticalCheck?.passed).toBe(true);
  });
});

// ============================================================================
// Harness Utilities
// ============================================================================

describe('runEvalChecks', () => {
  it('produces a passing result when all checks pass', () => {
    const checks = [
      { name: 'check1', passed: true, expected: 'a', actual: 'a' },
      { name: 'check2', passed: true, expected: 'b', actual: 'b' },
    ];
    const result = runEvalChecks('id', 'name', 'agent', checks, Date.now());
    expect(result.passed).toBe(true);
    expect(result.checks).toHaveLength(2);
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('produces a failing result when any check fails', () => {
    const checks = [
      { name: 'check1', passed: true, expected: 'a', actual: 'a' },
      { name: 'check2', passed: false, expected: 'b', actual: 'c' },
    ];
    const result = runEvalChecks('id', 'name', 'agent', checks, Date.now());
    expect(result.passed).toBe(false);
  });
});

describe('summarizeResults', () => {
  it('computes correct pass rate', () => {
    const results = [
      { caseId: '1', caseName: 'a', agentType: 'x', passed: true, checks: [], durationMs: 1 },
      { caseId: '2', caseName: 'b', agentType: 'x', passed: false, checks: [], durationMs: 1 },
      { caseId: '3', caseName: 'c', agentType: 'x', passed: true, checks: [], durationMs: 1 },
    ];
    const summary = summarizeResults(results);
    expect(summary.totalCases).toBe(3);
    expect(summary.passed).toBe(2);
    expect(summary.failed).toBe(1);
    expect(summary.passRate).toBeCloseTo(2 / 3);
    expect(summary.timestamp).toBeTruthy();
  });

  it('handles empty results', () => {
    const summary = summarizeResults([]);
    expect(summary.totalCases).toBe(0);
    expect(summary.passRate).toBe(0);
  });
});
