import { describe, expect, it } from 'vitest';

import { validateDomainEvent } from '../DomainEventSchemas.js';

function makeEnvelope() {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    emittedAt: '2026-01-01T00:00:00.000Z',
    traceId: 'trace-1',
    tenantId: '22222222-2222-4222-8222-222222222222',
    actorId: 'user-1',
  };
}

describe('NarrativeDraftedPayloadSchema compatibility', () => {
  it('accepts normalized narrative.drafted payload shape', () => {
    const parsed = validateDomainEvent('narrative.drafted', {
      ...makeEnvelope(),
      valueCaseId: 'case-123',
      defenseReadinessScore: 0.87,
      format: 'executive_summary',
    });

    expect(parsed).toMatchObject({
      tenantId: '22222222-2222-4222-8222-222222222222',
      valueCaseId: 'case-123',
      defenseReadinessScore: 0.87,
      format: 'executive_summary',
    });
  });

  it('maps legacy snake_case narrative.drafted fields to normalized shape', () => {
    const parsed = validateDomainEvent('narrative.drafted', {
      id: '11111111-1111-4111-8111-111111111111',
      emittedAt: '2026-01-01T00:00:00.000Z',
      traceId: 'trace-1',
      organization_id: '22222222-2222-4222-8222-222222222222',
      actorId: 'user-1',
      value_case_id: 'case-legacy',
      defense_readiness_score: 0.74,
      format: 'board_deck',
    });

    expect(parsed).toMatchObject({
      tenantId: '22222222-2222-4222-8222-222222222222',
      valueCaseId: 'case-legacy',
      defenseReadinessScore: 0.74,
      format: 'board_deck',
    });
    expect(parsed).not.toHaveProperty('organization_id');
    expect(parsed).not.toHaveProperty('value_case_id');
    expect(parsed).not.toHaveProperty('defense_readiness_score');
  });

  it('rejects payloads missing both tenantId and organization_id', () => {
    expect(() =>
      validateDomainEvent('narrative.drafted', {
        id: '11111111-1111-4111-8111-111111111111',
        emittedAt: '2026-01-01T00:00:00.000Z',
        traceId: 'trace-1',
        actorId: 'user-1',
        defenseReadinessScore: 0.74,
        format: 'board_deck',
      }),
    ).toThrow(/Invalid payload for domain event/);
  });

  // Regression tests for mismatched-alias validation (previously threw ZodError
  // directly inside z.preprocess, which bypassed safeParse error handling).
  it('rejects mismatched tenantId and organization_id via safeParse (not uncaught throw)', () => {
    expect(() =>
      validateDomainEvent('narrative.drafted', {
        ...makeEnvelope(),
        // tenantId from envelope + a conflicting organization_id
        organization_id: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
        defenseReadinessScore: 0.5,
        format: 'executive_summary',
      }),
    ).toThrow(/Invalid payload for domain event/);
  });

  it('rejects mismatched valueCaseId and value_case_id via safeParse', () => {
    expect(() =>
      validateDomainEvent('narrative.drafted', {
        ...makeEnvelope(),
        valueCaseId: 'case-a',
        value_case_id: 'case-b',
        defenseReadinessScore: 0.5,
        format: 'executive_summary',
      }),
    ).toThrow(/Invalid payload for domain event/);
  });

  it('rejects mismatched defenseReadinessScore and defense_readiness_score via safeParse', () => {
    expect(() =>
      validateDomainEvent('narrative.drafted', {
        ...makeEnvelope(),
        defenseReadinessScore: 0.8,
        defense_readiness_score: 0.5,
        format: 'executive_summary',
      }),
    ).toThrow(/Invalid payload for domain event/);
  });
});
