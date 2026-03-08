/**
 * PolicyEngine — HITL trigger tests
 *
 * Validates Sprint 5 sign-off criteria:
 *   S5.2  HITL trigger: confidenceScore < 0.6 + external artifact → require approval
 *
 * Test matrix:
 *   HITL-01 blocking
 *     - blocks when confidence < 0.6 and action is external-facing
 *     - blocks at boundary (0.59)
 *     - allows at exactly the threshold (0.6)
 *     - allows when confidence > 0.6
 *     - allows when action is not external-facing (even with low confidence)
 *     - allows when opportunity is absent
 *   Result shape
 *     - blocked result: allowed=false, hitl_required=true, hitl_reason defined
 *     - allowed result: allowed=true, hitl_required=false, hitl_reason absent
 *     - details always present with rule_id, confidence_score, is_external_artifact_action
 *     - lifecycle_stage propagated into details
 *     - hitl_reason cites the threshold value and actual score
 *   All lifecycle stages
 *     - HITL fires for every stage when confidence < threshold
 *   ServiceHealthSnapshot
 *     - type is exported and structurally correct
 */

import { describe, it, expect } from 'vitest';
import {
  PolicyEngine,
  HITL_CONFIDENCE_THRESHOLD,
  ServiceHealthSnapshot,
} from '../index.js';
import { DecisionContext } from '@shared/domain/DecisionContext.js';

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
  confidence_score: number,
  lifecycle_stage: NonNullable<DecisionContext['opportunity']>['lifecycle_stage'] = 'composing'
): NonNullable<DecisionContext['opportunity']> {
  return {
    id: '00000000-0000-0000-0000-000000000002',
    lifecycle_stage,
    confidence_score,
    value_maturity: 'medium',
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PolicyEngine', () => {
  const engine = new PolicyEngine();

  // -------------------------------------------------------------------------
  // HITL-01 blocking behaviour
  // -------------------------------------------------------------------------

  describe('HITL-01: external artifact + low confidence', () => {
    it('blocks when confidence < 0.6 and action is external-facing', () => {
      const ctx = makeContext({
        opportunity: makeOpportunity(0.5),
        is_external_artifact_action: true,
      });
      const result = engine.checkHITL(ctx);
      expect(result.allowed).toBe(false);
      expect(result.hitl_required).toBe(true);
      expect(result.hitl_reason).toBeDefined();
      expect(result.details.rule_id).toBe('HITL-01');
      expect(result.details.confidence_score).toBe(0.5);
      expect(result.details.is_external_artifact_action).toBe(true);
    });

    it('blocks at confidence just below threshold (0.59)', () => {
      const ctx = makeContext({
        opportunity: makeOpportunity(0.59),
        is_external_artifact_action: true,
      });
      const result = engine.checkHITL(ctx);
      expect(result.allowed).toBe(false);
      expect(result.hitl_required).toBe(true);
    });

    it('allows at exactly the threshold (0.6)', () => {
      const ctx = makeContext({
        opportunity: makeOpportunity(HITL_CONFIDENCE_THRESHOLD),
        is_external_artifact_action: true,
      });
      const result = engine.checkHITL(ctx);
      expect(result.allowed).toBe(true);
      expect(result.hitl_required).toBe(false);
    });

    it('allows when confidence > 0.6', () => {
      const ctx = makeContext({
        opportunity: makeOpportunity(0.85),
        is_external_artifact_action: true,
      });
      const result = engine.checkHITL(ctx);
      expect(result.allowed).toBe(true);
      expect(result.hitl_required).toBe(false);
    });

    it('allows when action is not external-facing, even with low confidence', () => {
      const ctx = makeContext({
        opportunity: makeOpportunity(0.3),
        is_external_artifact_action: false,
      });
      const result = engine.checkHITL(ctx);
      expect(result.allowed).toBe(true);
      expect(result.hitl_required).toBe(false);
    });

    it('allows when opportunity is absent (no confidence to check)', () => {
      const ctx = makeContext({ is_external_artifact_action: true });
      const result = engine.checkHITL(ctx);
      expect(result.allowed).toBe(true);
      expect(result.hitl_required).toBe(false);
    });

    it('allows when confidence is exactly 0 but action is not external-facing', () => {
      const ctx = makeContext({
        opportunity: makeOpportunity(0),
        is_external_artifact_action: false,
      });
      expect(engine.checkHITL(ctx).allowed).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // Result shape invariants
  // -------------------------------------------------------------------------

  describe('result shape', () => {
    it('blocked result has allowed=false, hitl_required=true, hitl_reason defined', () => {
      const ctx = makeContext({
        opportunity: makeOpportunity(0.1),
        is_external_artifact_action: true,
      });
      const result = engine.checkHITL(ctx);
      expect(result.allowed).toBe(false);
      expect(result.hitl_required).toBe(true);
      expect(typeof result.hitl_reason).toBe('string');
      expect(result.hitl_reason!.length).toBeGreaterThan(0);
    });

    it('allowed result has allowed=true, hitl_required=false, no hitl_reason', () => {
      const ctx = makeContext({
        opportunity: makeOpportunity(0.9),
        is_external_artifact_action: true,
      });
      const result = engine.checkHITL(ctx);
      expect(result.allowed).toBe(true);
      expect(result.hitl_required).toBe(false);
      expect(result.hitl_reason).toBeUndefined();
    });

    it('details always present on blocked result', () => {
      const ctx = makeContext({
        opportunity: makeOpportunity(0.4),
        is_external_artifact_action: true,
      });
      const { details } = engine.checkHITL(ctx);
      expect(details.rule_id).toBe('HITL-01');
      expect(details.confidence_score).toBe(0.4);
      expect(details.is_external_artifact_action).toBe(true);
    });

    it('details always present on allowed result', () => {
      const ctx = makeContext({
        opportunity: makeOpportunity(0.8),
        is_external_artifact_action: false,
      });
      const { details } = engine.checkHITL(ctx);
      expect(details.rule_id).toBe('HITL-01');
      expect(details.confidence_score).toBe(0.8);
      expect(details.is_external_artifact_action).toBe(false);
    });

    it('lifecycle_stage propagated into details', () => {
      const ctx = makeContext({
        opportunity: makeOpportunity(0.4, 'composing'),
        is_external_artifact_action: true,
      });
      expect(engine.checkHITL(ctx).details.lifecycle_stage).toBe('composing');
    });

    it('lifecycle_stage is undefined in details when opportunity is absent', () => {
      const ctx = makeContext({ is_external_artifact_action: true });
      expect(engine.checkHITL(ctx).details.lifecycle_stage).toBeUndefined();
    });

    it('hitl_reason cites the threshold value', () => {
      const ctx = makeContext({
        opportunity: makeOpportunity(0.5),
        is_external_artifact_action: true,
      });
      expect(engine.checkHITL(ctx).hitl_reason).toContain(String(HITL_CONFIDENCE_THRESHOLD));
    });

    it('hitl_reason cites the actual confidence score', () => {
      const ctx = makeContext({
        opportunity: makeOpportunity(0.42),
        is_external_artifact_action: true,
      });
      expect(engine.checkHITL(ctx).hitl_reason).toContain('0.42');
    });
  });

  // -------------------------------------------------------------------------
  // All lifecycle stages trigger HITL when confidence is low
  // -------------------------------------------------------------------------

  describe('HITL fires for every lifecycle stage when confidence < threshold', () => {
    const stages: NonNullable<DecisionContext['opportunity']>['lifecycle_stage'][] = [
      'discovery', 'drafting', 'validating', 'composing', 'refining', 'realized', 'expansion',
    ];

    it.each(stages)('stage %s with confidence 0.3 + external artifact → blocked', (stage) => {
      const ctx = makeContext({
        opportunity: makeOpportunity(0.3, stage),
        is_external_artifact_action: true,
      });
      const result = engine.checkHITL(ctx);
      expect(result.allowed).toBe(false);
      expect(result.details.lifecycle_stage).toBe(stage);
    });
  });

  // -------------------------------------------------------------------------
  // ServiceHealthSnapshot type
  // -------------------------------------------------------------------------

  describe('ServiceHealthSnapshot', () => {
    it('is a structurally valid value object with all required fields', () => {
      // Compile-time check: if the type changes, this assignment will fail tsc.
      const snapshot: ServiceHealthSnapshot = {
        messageBrokerReady: true,
        queueReady: true,
        memoryBackendReady: true,
        llmGatewayReady: true,
        circuitBreakerReady: true,
      };
      expect(Object.keys(snapshot)).toHaveLength(5);
      expect(Object.values(snapshot).every((v) => typeof v === 'boolean')).toBe(true);
    });

    it('accepts a degraded snapshot with some services not ready', () => {
      const snapshot: ServiceHealthSnapshot = {
        messageBrokerReady: false,
        queueReady: false,
        memoryBackendReady: true,
        llmGatewayReady: true,
        circuitBreakerReady: true,
      };
      expect(snapshot.messageBrokerReady).toBe(false);
      expect(snapshot.llmGatewayReady).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // Constant
  // -------------------------------------------------------------------------

  describe('HITL_CONFIDENCE_THRESHOLD', () => {
    it('is 0.6 as specified in Sprint 5.5', () => {
      expect(HITL_CONFIDENCE_THRESHOLD).toBe(0.6);
    });
  });
});
