import { describe, expect, it } from 'vitest';

import { reconcileGovernanceDrift } from '../GovernanceDriftReconciliationWorker.js';
import { type GovernanceContext } from '../../lib/rules.js';

const baseCtx: GovernanceContext = {
  actor: { userId: 'u1', tenantId: 't1', roles: ['member'] },
  action: { type: 'value_trees:edit', name: 'value_trees:edit', payload: {} },
  environment: { stage: 'dev', nowIso: new Date().toISOString() },
};

describe('GovernanceDriftReconciliationWorker', () => {
  it('detects drift records', async () => {
    const result = await reconcileGovernanceDrift({
      mode: 'automated',
      scheduledAt: new Date().toISOString(),
      contexts: [{ ...baseCtx, environment: { ...baseCtx.environment, stage: 'prod' }, action: { ...baseCtx.action, payload: null } }],
    });
    expect(result.detected).toBeGreaterThan(0);
  });

  it('no-op when clean', async () => {
    const result = await reconcileGovernanceDrift({
      mode: 'automated',
      scheduledAt: new Date().toISOString(),
      contexts: [{ ...baseCtx, action: { ...baseCtx.action, payload: {} } }],
    });
    expect(result).toEqual({ detected: 0, remediated: 0, unresolved: 0, escalated: 0 });
  });

  it('automatically remediates safe drift', async () => {
    const result = await reconcileGovernanceDrift({
      mode: 'automated',
      scheduledAt: new Date().toISOString(),
      contexts: [{ ...baseCtx, environment: { ...baseCtx.environment, stage: 'staging' }, action: { ...baseCtx.action, payload: null } }],
    });
    expect(result.remediated).toBeGreaterThan(0);
  });

  it('escalates unresolved high-risk drift in approval-gated mode', async () => {
    const result = await reconcileGovernanceDrift({
      mode: 'approval_gated',
      scheduledAt: new Date().toISOString(),
      contexts: [{ ...baseCtx, environment: { ...baseCtx.environment, stage: 'prod' }, action: { ...baseCtx.action, name: 'proposal.publish', type: 'proposal.publish', payload: null } }],
    });
    expect(result.escalated).toBeGreaterThan(0);
  });
});
