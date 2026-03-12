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
});
