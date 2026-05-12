import { describe, expect, it } from 'vitest';

import { evaluateGovernanceDrift } from './driftPrimitives.js';
import type { GovernanceContext } from '../rules.js';

function buildContext(overrides?: Partial<GovernanceContext>): GovernanceContext {
  return {
    actor: {
      userId: 'user-1',
      tenantId: 'tenant-1',
      roles: ['admin'],
    },
    action: {
      type: 'write',
      name: 'proposal.publish',
      payload: {
        changeTicketId: 'chg-1',
        riskAcceptanceId: 'risk-1',
      },
    },
    environment: {
      stage: 'prod',
      nowIso: new Date().toISOString(),
    },
    workflow: {
      workflowId: 'wf-1',
      approvals: ['proposal.publish'],
    },
    ...overrides,
  };
}

describe('evaluateGovernanceDrift config reloading', () => {
  it('honors stage required field changes between evaluations', () => {
    const original = process.env.GOVERNANCE_STAGE_REQUIRED_FIELDS;

    process.env.GOVERNANCE_STAGE_REQUIRED_FIELDS = JSON.stringify({
      dev: [],
      staging: ['changeTicketId'],
      prod: ['changeTicketId'],
    });

    const missingRiskAcceptance = buildContext({
      action: {
        type: 'write',
        name: 'proposal.publish',
        payload: { changeTicketId: 'chg-1' },
      },
    });

    const beforeConfigChange = evaluateGovernanceDrift(missingRiskAcceptance, ['proposal.publish']);
    expect(beforeConfigChange.some((item) => item.driftType === 'CRITICAL_CONFIG_INVARIANT')).toBe(false);

    process.env.GOVERNANCE_STAGE_REQUIRED_FIELDS = JSON.stringify({
      dev: [],
      staging: ['changeTicketId'],
      prod: ['changeTicketId', 'riskAcceptanceId'],
    });

    const afterConfigChange = evaluateGovernanceDrift(missingRiskAcceptance, ['proposal.publish']);
    expect(afterConfigChange.some((item) => item.driftType === 'CRITICAL_CONFIG_INVARIANT')).toBe(true);

    if (original === undefined) {
      delete process.env.GOVERNANCE_STAGE_REQUIRED_FIELDS;
    } else {
      process.env.GOVERNANCE_STAGE_REQUIRED_FIELDS = original;
    }
  });

  it('honors prod approval action changes between evaluations', () => {
    const original = process.env.GOVERNANCE_PROD_APPROVAL_REQUIRED_ACTIONS;

    process.env.GOVERNANCE_PROD_APPROVAL_REQUIRED_ACTIONS = 'proposal.publish';

    const context = buildContext({
      action: {
        type: 'write',
        name: 'tenant.settings.update',
        payload: { changeTicketId: 'chg-1', riskAcceptanceId: 'risk-1' },
      },
      workflow: {
        workflowId: undefined,
        approvals: [],
      },
    });

    const beforeConfigChange = evaluateGovernanceDrift(context, ['tenant.settings.update']);
    expect(beforeConfigChange.some((item) => item.driftType === 'WORKFLOW_APPROVAL_INCONSISTENCY')).toBe(false);

    process.env.GOVERNANCE_PROD_APPROVAL_REQUIRED_ACTIONS = 'proposal.publish,tenant.settings.update';

    const afterConfigChange = evaluateGovernanceDrift(context, ['tenant.settings.update']);
    expect(afterConfigChange.some((item) => item.driftType === 'WORKFLOW_APPROVAL_INCONSISTENCY')).toBe(true);

    if (original === undefined) {
      delete process.env.GOVERNANCE_PROD_APPROVAL_REQUIRED_ACTIONS;
    } else {
      process.env.GOVERNANCE_PROD_APPROVAL_REQUIRED_ACTIONS = original;
    }
  });
});
