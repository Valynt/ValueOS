import {
  LAYER4_APPROVAL_SCHEMA_VERSION,
  LAYER4_PAYLOAD_CONTRACT_VERSION,
  type Layer4ContractFixture,
} from './layer4Contract.js';

export function buildLayer4ContractFixture(overrides?: Partial<Layer4ContractFixture>): Layer4ContractFixture {
  return {
    actionName: 'proposal.publish',
    payload: {
      changeTicketId: 'chg-1',
      riskAcceptanceId: 'risk-1',
      schema_manifest_hash: 'schema-hash-v1',
      runtime_migration_head: '20260512000100_layer6',
      contract_version: LAYER4_PAYLOAD_CONTRACT_VERSION,
      requestId: 'req-1',
    },
    workflow: {
      workflowId: 'wf-1',
      step: 'approval',
      approvals: [
        {
          actionName: 'proposal.publish',
          approvalSchemaVersion: LAYER4_APPROVAL_SCHEMA_VERSION,
          sourceSystemId: 'governance-api',
          approvedAt: new Date('2026-05-12T00:00:00.000Z').toISOString(),
          requestId: 'req-1',
          sessionId: 'sess-1',
          tenantId: 'tenant-1',
          resourceType: 'proposal',
          resourceId: 'proposal-1',
          signatureHash: 'sig-1',
          nonce: 'nonce-1',
          approvalSequence: 1,
        },
      ],
    },
    ...overrides,
  };
}
