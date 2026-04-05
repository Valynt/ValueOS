/**
 * DecisionRouter — domain-driven routing tests
 *
 * Validates Sprint 5 sign-off criteria:
 *   S5.1  No string-matching logic in DecisionRouter
 *   S5.2  At least 3 domain-driven routing rules implemented and tested
 *
 * Test matrix:
 *   - generateBusinessCase fires when value_maturity === 'low'
 *   - gatherEvidence fires when hypothesis confidence_score < 0.4
 *   - validateHypotheses fires when hypothesis has no evidence and score < 0.7
 *   - mapStakeholders fires when no economic buyer and stage !== discovery
 *   - lifecycleStage rule maps each canonical stage to the correct agent
 *   - evaluate() returns null when no rule matches
 *   - selectAgent() defaults to 'coordinator' when no rule matches
 *   - Rule priority: generateBusinessCase (P10) beats lifecycleStage (P50)
 */

import { DecisionContext } from '@shared/domain/DecisionContext';
import { describe, expect, it } from 'vitest';

import { DecisionRouter } from '../index.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeContext(overrides: Partial<DecisionContext> = {}): DecisionContext {
  return {
    organization_id: '00000000-0000-0000-0000-000000000001',
    is_external_artifact_action: false,
    ...overrides,
  };
}

function makeOpportunity(
  lifecycle_stage: DecisionContext['opportunity'] extends infer O
    ? O extends object ? O['lifecycle_stage'] : never
    : never,
  overrides: Partial<NonNullable<DecisionContext['opportunity']>> = {}
): NonNullable<DecisionContext['opportunity']> {
  return {
    id: '00000000-0000-0000-0000-000000000002',
    lifecycle_stage,
    confidence_score: 0.8,
    value_maturity: 'high',
    ...overrides,
  };
}

function makeHypothesis(
  overrides: Partial<NonNullable<DecisionContext['hypothesis']>> = {}
): NonNullable<DecisionContext['hypothesis']> {
  return {
    id: '00000000-0000-0000-0000-000000000003',
    confidence: 'high',
    confidence_score: 0.85,
    evidence_count: 2,
    ...overrides,
  };
}

function expectDecision(result: ReturnType<DecisionRouter['evaluate']>) {
  expect(result).not.toBeNull();
  if (!result) {
    throw new Error('Expected DecisionRouter to return a decision');
  }
  return result;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('DecisionRouter', () => {
  const router = new DecisionRouter();

  // -------------------------------------------------------------------------
  // Sprint 5.4 — generateBusinessCase rule
  // -------------------------------------------------------------------------

  describe('generateBusinessCase rule (P10)', () => {
    it('returns generateBusinessCase when value_maturity is low', () => {
      const ctx = makeContext({
        opportunity: makeOpportunity('drafting', { value_maturity: 'low' }),
      });
      const result = expectDecision(router.evaluate(ctx));
      expect(result.action).toBe('generateBusinessCase');
      expect(result.agent).toBe('financial-modeling');
    });

    it('does not fire when value_maturity is medium', () => {
      const ctx = makeContext({
        opportunity: makeOpportunity('drafting', { value_maturity: 'medium' }),
      });
      // Should fall through to lifecycleStage rule
      const result = router.evaluate(ctx);
      expect(result?.action).not.toBe('generateBusinessCase');
    });

    it('does not fire when value_maturity is high', () => {
      const ctx = makeContext({
        opportunity: makeOpportunity('drafting', { value_maturity: 'high' }),
      });
      const result = router.evaluate(ctx);
      expect(result?.action).not.toBe('generateBusinessCase');
    });

    it('does not fire when opportunity is absent', () => {
      const ctx = makeContext({ hypothesis: makeHypothesis({ confidence_score: 0.9 }) });
      const result = router.evaluate(ctx);
      expect(result?.action).not.toBe('generateBusinessCase');
    });
  });

  // -------------------------------------------------------------------------
  // Sprint 5.4 — gatherEvidence rule
  // -------------------------------------------------------------------------

  describe('gatherEvidence rule (P20)', () => {
    it('returns gatherEvidence when confidence_score < 0.4', () => {
      const ctx = makeContext({
        opportunity: makeOpportunity('validating', { value_maturity: 'high' }),
        hypothesis: makeHypothesis({ confidence: 'low', confidence_score: 0.3 }),
      });
      const result = expectDecision(router.evaluate(ctx));
      expect(result.action).toBe('gatherEvidence');
      expect(result.agent).toBe('integrity');
    });

    it('returns gatherEvidence at exactly the boundary (0.39)', () => {
      const ctx = makeContext({
        opportunity: makeOpportunity('validating', { value_maturity: 'high' }),
        hypothesis: makeHypothesis({ confidence: 'low', confidence_score: 0.39 }),
      });
      const result = expectDecision(router.evaluate(ctx));
      expect(result.action).toBe('gatherEvidence');
    });

    it('does not fire when confidence_score === 0.4', () => {
      const ctx = makeContext({
        opportunity: makeOpportunity('validating', { value_maturity: 'high' }),
        hypothesis: makeHypothesis({ confidence: 'medium', confidence_score: 0.4 }),
      });
      const result = router.evaluate(ctx);
      expect(result?.action).not.toBe('gatherEvidence');
    });

    it('falls back to enum mapping when confidence_score is absent', () => {
      const ctx = makeContext({
        opportunity: makeOpportunity('validating', { value_maturity: 'high' }),
        hypothesis: makeHypothesis({ confidence: 'low', confidence_score: undefined }),
      });
      // 'low' enum maps to 0.35 < 0.4 → should fire
      const result = expectDecision(router.evaluate(ctx));
      expect(result.action).toBe('gatherEvidence');
    });

    it('does not fire when hypothesis is absent', () => {
      const ctx = makeContext({
        opportunity: makeOpportunity('validating', { value_maturity: 'high' }),
      });
      const result = router.evaluate(ctx);
      expect(result?.action).not.toBe('gatherEvidence');
    });
  });

  // -------------------------------------------------------------------------
  // validateHypotheses rule
  // -------------------------------------------------------------------------

  describe('validateHypotheses rule (P30)', () => {
    it('returns validateHypotheses when evidence_count is 0 and score < 0.7', () => {
      const ctx = makeContext({
        opportunity: makeOpportunity('validating', { value_maturity: 'high' }),
        hypothesis: makeHypothesis({
          confidence: 'medium',
          confidence_score: 0.55,
          evidence_count: 0,
        }),
      });
      const result = expectDecision(router.evaluate(ctx));
      expect(result.action).toBe('validateHypotheses');
      expect(result.agent).toBe('integrity');
    });

    it('does not fire the P30 rule when evidence_count > 0 (falls through to lifecycle rule)', () => {
      const ctx = makeContext({
        opportunity: makeOpportunity('validating', { value_maturity: 'high' }),
        hypothesis: makeHypothesis({
          confidence: 'medium',
          confidence_score: 0.55,
          evidence_count: 1,
        }),
      });
      const result = router.evaluate(ctx);
      // P30 does not fire; the lifecycle rule (P50) may still return validateHypotheses
      // for the 'validating' stage — that is correct behaviour.
      // Assert the rule_priority is NOT 30 (P30 did not win).
      expect(result?.rule_priority).not.toBe(30);
    });
  });

  // -------------------------------------------------------------------------
  // mapStakeholders rule
  // -------------------------------------------------------------------------

  describe('mapStakeholders rule (P40)', () => {
    it('returns mapStakeholders when no economic buyer and stage is not discovery', () => {
      const ctx = makeContext({
        opportunity: makeOpportunity('drafting', { value_maturity: 'high' }),
        buying_committee: {
          covered_roles: ['champion'],
          has_economic_buyer: false,
          stakeholder_count: 1,
        },
      });
      const result = expectDecision(router.evaluate(ctx));
      expect(result.action).toBe('mapStakeholders');
      expect(result.agent).toBe('opportunity');
    });

    it('does not fire when economic buyer is present', () => {
      const ctx = makeContext({
        opportunity: makeOpportunity('drafting', { value_maturity: 'high' }),
        buying_committee: {
          covered_roles: ['economic_buyer', 'champion'],
          has_economic_buyer: true,
          stakeholder_count: 2,
        },
      });
      const result = router.evaluate(ctx);
      expect(result?.action).not.toBe('mapStakeholders');
    });

    it('does not fire during discovery stage', () => {
      const ctx = makeContext({
        opportunity: makeOpportunity('discovery', { value_maturity: 'high' }),
        buying_committee: {
          covered_roles: [],
          has_economic_buyer: false,
          stakeholder_count: 0,
        },
      });
      const result = router.evaluate(ctx);
      expect(result?.action).not.toBe('mapStakeholders');
    });
  });

  // -------------------------------------------------------------------------
  // lifecycleStage rule — all 7 canonical stages
  // -------------------------------------------------------------------------

  describe('lifecycleStage rule (P50)', () => {
    const cases: Array<[NonNullable<DecisionContext['opportunity']>['lifecycle_stage'], string, string]> = [
      ['discovery',  'opportunity',       'generateHypotheses'],
      ['drafting',   'target',            'buildFinancialModel'],
      ['validating', 'integrity',         'validateHypotheses'],
      ['composing',  'financial-modeling','generateBusinessCase'],
      ['refining',   'integrity',         'validateHypotheses'],
      ['realized',   'realization',       'planRealization'],
      ['expansion',  'expansion',         'identifyExpansion'],
    ];

    it.each(cases)(
      'stage %s → agent %s, action %s',
      (stage, expectedAgent, expectedAction) => {
        const ctx = makeContext({
          opportunity: makeOpportunity(stage, { value_maturity: 'high', confidence_score: 0.9 }),
        });
        const result = expectDecision(router.evaluate(ctx));
        expect(result.agent).toBe(expectedAgent);
        expect(result.action).toBe(expectedAction);
      }
    );
  });

  // -------------------------------------------------------------------------
  // Priority ordering
  // -------------------------------------------------------------------------

  describe('rule priority', () => {
    it('generateBusinessCase (P10) beats lifecycleStage (P50) for drafting stage', () => {
      const ctx = makeContext({
        opportunity: makeOpportunity('drafting', {
          value_maturity: 'low',
          confidence_score: 0.9,
        }),
      });
      const result = expectDecision(router.evaluate(ctx));
      // P10 fires before P50
      expect(result.action).toBe('generateBusinessCase');
      expect(result.rule_priority).toBe(10);
    });

    it('gatherEvidence (P20) beats lifecycleStage (P50)', () => {
      const ctx = makeContext({
        opportunity: makeOpportunity('validating', {
          value_maturity: 'high',
          confidence_score: 0.9,
        }),
        hypothesis: makeHypothesis({ confidence: 'low', confidence_score: 0.2 }),
      });
      const result = expectDecision(router.evaluate(ctx));
      expect(result.action).toBe('gatherEvidence');
      expect(result.rule_priority).toBe(20);
    });
  });

  // -------------------------------------------------------------------------
  // No-match fallback
  // -------------------------------------------------------------------------

  describe('fallback behaviour', () => {
    it('evaluate() returns null when no context fields are set', () => {
      const ctx = makeContext();
      expect(router.evaluate(ctx)).toBeNull();
    });

    it('selectAgent() returns coordinator when no rule matches', () => {
      const ctx = makeContext();
      expect(router.selectAgent(ctx)).toBe('coordinator');
    });
  });

  // -------------------------------------------------------------------------
  // Custom rule injection
  // -------------------------------------------------------------------------

  describe('custom rule injection', () => {
    it('accepts a custom rule set and evaluates it', () => {
      const customRouter = new DecisionRouter(undefined, [
        {
          id: 'custom-test',
          priority: 1,
          description: 'Always returns opportunity agent',
          evaluate: () => ({
            agent: 'opportunity' as const,
            action: 'generateHypotheses' as const,
            reasoning: 'custom rule',
            rule_priority: 1,
          }),
        },
      ]);
      const ctx = makeContext();
      expect(customRouter.selectAgent(ctx)).toBe('opportunity');
    });
  });
});
