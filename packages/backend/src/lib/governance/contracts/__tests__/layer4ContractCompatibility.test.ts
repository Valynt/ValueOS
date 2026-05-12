import { describe, expect, it } from 'vitest';

import { evaluateGovernanceDrift } from '../../driftPrimitives.js';
import type { GovernanceContext } from '../../../rules.js';
import { buildLayer4ContractFixture } from '../fixtures.js';
import {
  LAYER4_PAYLOAD_CONTRACT_VERSION,
  Layer4ApprovalContractSchema,
  Layer4CompatibilityEnvelopeSchema,
} from '../layer4Contract.js';
import { buildLayer4DriftPayload } from '../buildLayer4Payload.js';

function toGovernanceContext(): GovernanceContext {
  const fixture = buildLayer4ContractFixture();
  return {
    actor: { userId: 'user-1', tenantId: 'tenant-1', roles: ['admin'], sessionId: 'sess-1' },
    action: {
      type: fixture.actionName,
      name: fixture.actionName,
      payload: fixture.payload,
      target: { resourceType: 'proposal', resourceId: 'proposal-1' },
    },
    environment: { stage: 'prod', nowIso: new Date('2026-05-12T01:00:00.000Z').toISOString() },
    workflow: fixture.workflow,
  };
}

describe('Layer 4 contract compatibility', () => {
  it('accepts canonical fixture schema and required fields', () => {
    const fixture = buildLayer4ContractFixture();
    expect(() => Layer4CompatibilityEnvelopeSchema.parse(fixture)).not.toThrow();

    const payload = buildLayer4DriftPayload({
      requestId: 'req-1',
      schemaManifestHash: 'schema-hash-v1',
      runtimeMigrationHead: '20260512000100_layer6',
      changeTicketId: 'chg-1',
      riskAcceptanceId: 'risk-1',
    });

    expect(payload.contract_version).toBe(LAYER4_PAYLOAD_CONTRACT_VERSION);
    expect(payload).toMatchObject({
      changeTicketId: expect.any(String),
      riskAcceptanceId: expect.any(String),
      schema_manifest_hash: expect.any(String),
      runtime_migration_head: expect.any(String),
      requestId: expect.any(String),
    });
  });

  it('detects validation contract version drift', () => {
    const originalContractVersion = process.env.REQUIRED_PAYLOAD_CONTRACT_VERSION;
    process.env.REQUIRED_PAYLOAD_CONTRACT_VERSION = '3.0.0';

    const context = toGovernanceContext();
    context.action.payload = {
      ...(context.action.payload as Record<string, unknown>),
      contract_version: '2.0.0',
    };

    const drift = evaluateGovernanceDrift(context, ['proposal.publish']);
    expect(drift.some((d) => d.driftType === 'VALIDATION_CONTRACT_DRIFT')).toBe(true);

    if (originalContractVersion === undefined) delete process.env.REQUIRED_PAYLOAD_CONTRACT_VERSION;
    else process.env.REQUIRED_PAYLOAD_CONTRACT_VERSION = originalContractVersion;
  });

  it('denies approval contract schema version mismatch by invalidating v2 contract shape', () => {
    const approval = buildLayer4ContractFixture().workflow.approvals[0] as Record<string, unknown>;
    expect(() => Layer4ApprovalContractSchema.parse({ ...approval, approvalSchemaVersion: 'v2' })).toThrow();
  });

  it('detects missing workflow metadata dependencies', () => {
    const originalRequiredActions = process.env.GOVERNANCE_PROD_APPROVAL_REQUIRED_ACTIONS;
    process.env.GOVERNANCE_PROD_APPROVAL_REQUIRED_ACTIONS = 'proposal.publish';

    const context = toGovernanceContext();
    context.workflow = { workflowId: undefined, approvals: [] };

    const drift = evaluateGovernanceDrift(context, ['proposal.publish']);
    expect(drift.some((d) => d.driftType === 'WORKFLOW_APPROVAL_INCONSISTENCY')).toBe(true);

    if (originalRequiredActions === undefined) delete process.env.GOVERNANCE_PROD_APPROVAL_REQUIRED_ACTIONS;
    else process.env.GOVERNANCE_PROD_APPROVAL_REQUIRED_ACTIONS = originalRequiredActions;
  });
});
