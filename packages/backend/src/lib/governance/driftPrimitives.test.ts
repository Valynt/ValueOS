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

  it('detects layer-6 drift signals when configured expected values mismatch payload', () => {
    const originalSchema = process.env.GOVERNANCE_SCHEMA_HASH_EXPECTED;
    const originalMigrationHead = process.env.APP_MIGRATION_HEAD;
    const originalContractVersion = process.env.REQUIRED_PAYLOAD_CONTRACT_VERSION;

    process.env.GOVERNANCE_SCHEMA_HASH_EXPECTED = 'schema-hash-v1';
    process.env.APP_MIGRATION_HEAD = '20260512000100_layer6';
    process.env.REQUIRED_PAYLOAD_CONTRACT_VERSION = '3.0.0';

    const context = buildContext({
      action: {
        type: 'write',
        name: 'proposal.publish',
        payload: {
          changeTicketId: 'chg-1',
          riskAcceptanceId: 'risk-1',
          schema_manifest_hash: 'schema-hash-v2',
          runtime_migration_head: '20260512000000_old',
          contract_version: '2.9.0',
        },
      },
    });

    const assessments = evaluateGovernanceDrift(context, ['proposal.publish']);
    expect(assessments.some((item) => item.driftType === 'SCHEMA_CONTRACT_DRIFT')).toBe(true);
    expect(assessments.some((item) => item.driftType === 'MIGRATION_HEAD_DRIFT')).toBe(true);
    expect(assessments.some((item) => item.driftType === 'VALIDATION_CONTRACT_DRIFT')).toBe(true);

    if (originalSchema === undefined) delete process.env.GOVERNANCE_SCHEMA_HASH_EXPECTED;
    else process.env.GOVERNANCE_SCHEMA_HASH_EXPECTED = originalSchema;
    if (originalMigrationHead === undefined) delete process.env.APP_MIGRATION_HEAD;
    else process.env.APP_MIGRATION_HEAD = originalMigrationHead;
    if (originalContractVersion === undefined) delete process.env.REQUIRED_PAYLOAD_CONTRACT_VERSION;
    else process.env.REQUIRED_PAYLOAD_CONTRACT_VERSION = originalContractVersion;
  });

  it('throws on malformed layer-6 drift env values in prod strict mode', () => {
    const originalNodeEnv = process.env.NODE_ENV;
    const originalDestructive = process.env.GOVERNANCE_DESTRUCTIVE_ACTIONS;
    const originalRoles = process.env.GOVERNANCE_ELEVATED_ROLES;
    const originalApprovalActions = process.env.GOVERNANCE_PROD_APPROVAL_REQUIRED_ACTIONS;
    const originalStageRequired = process.env.GOVERNANCE_STAGE_REQUIRED_FIELDS;
    const originalSchema = process.env.GOVERNANCE_SCHEMA_HASH_EXPECTED;
    const originalMigrationHead = process.env.APP_MIGRATION_HEAD;
    const originalContractVersion = process.env.REQUIRED_PAYLOAD_CONTRACT_VERSION;

    const context = buildContext();
    const fn = () =>
      evaluateGovernanceDrift(context, ['proposal.publish']);

    process.env.NODE_ENV = 'production';
    process.env.GOVERNANCE_DESTRUCTIVE_ACTIONS = 'value_model.delete';
    process.env.GOVERNANCE_ELEVATED_ROLES = 'admin';
    process.env.GOVERNANCE_PROD_APPROVAL_REQUIRED_ACTIONS = 'proposal.publish';
    process.env.GOVERNANCE_STAGE_REQUIRED_FIELDS = JSON.stringify({
      dev: [],
      staging: ['changeTicketId'],
      prod: ['changeTicketId', 'riskAcceptanceId'],
    });
    process.env.GOVERNANCE_SCHEMA_HASH_EXPECTED = '   ';
    process.env.APP_MIGRATION_HEAD = '20260512000000_good';
    process.env.REQUIRED_PAYLOAD_CONTRACT_VERSION = '2.0.0';

    expect(fn).toThrowError(/GOVERNANCE_SCHEMA_HASH_EXPECTED/);

    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;
    if (originalDestructive === undefined) delete process.env.GOVERNANCE_DESTRUCTIVE_ACTIONS;
    else process.env.GOVERNANCE_DESTRUCTIVE_ACTIONS = originalDestructive;
    if (originalRoles === undefined) delete process.env.GOVERNANCE_ELEVATED_ROLES;
    else process.env.GOVERNANCE_ELEVATED_ROLES = originalRoles;
    if (originalApprovalActions === undefined) delete process.env.GOVERNANCE_PROD_APPROVAL_REQUIRED_ACTIONS;
    else process.env.GOVERNANCE_PROD_APPROVAL_REQUIRED_ACTIONS = originalApprovalActions;
    if (originalStageRequired === undefined) delete process.env.GOVERNANCE_STAGE_REQUIRED_FIELDS;
    else process.env.GOVERNANCE_STAGE_REQUIRED_FIELDS = originalStageRequired;
    if (originalSchema === undefined) delete process.env.GOVERNANCE_SCHEMA_HASH_EXPECTED;
    else process.env.GOVERNANCE_SCHEMA_HASH_EXPECTED = originalSchema;
    if (originalMigrationHead === undefined) delete process.env.APP_MIGRATION_HEAD;
    else process.env.APP_MIGRATION_HEAD = originalMigrationHead;
    if (originalContractVersion === undefined) delete process.env.REQUIRED_PAYLOAD_CONTRACT_VERSION;
    else process.env.REQUIRED_PAYLOAD_CONTRACT_VERSION = originalContractVersion;
  });
});
