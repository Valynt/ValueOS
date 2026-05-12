import { z } from 'zod';

export const LAYER4_APPROVAL_SCHEMA_VERSION = 'v1' as const;
export const LAYER4_PAYLOAD_CONTRACT_VERSION = '3.0.0' as const;

export const Layer4DriftPayloadSchema = z.object({
  changeTicketId: z.string().min(1),
  riskAcceptanceId: z.string().min(1),
  schema_manifest_hash: z.string().min(1),
  runtime_migration_head: z.string().min(1),
  contract_version: z.literal(LAYER4_PAYLOAD_CONTRACT_VERSION),
  requestId: z.string().min(1),
});

export const Layer4ApprovalContractSchema = z.object({
  actionName: z.string().min(1),
  approvalSchemaVersion: z.literal(LAYER4_APPROVAL_SCHEMA_VERSION),
  sourceSystemId: z.string().min(1),
  approvedAt: z.string().datetime(),
  requestId: z.string().min(1),
  sessionId: z.string().min(1).optional(),
  tenantId: z.string().min(1),
  resourceType: z.string().min(1),
  resourceId: z.string().min(1),
  signatureHash: z.string().min(1),
  nonce: z.string().min(1),
  approvalSequence: z.number().int().positive(),
});

export const Layer4WorkflowMetadataSchema = z.object({
  workflowId: z.string().min(1),
  step: z.string().min(1).optional(),
  approvals: z.array(z.union([z.string(), Layer4ApprovalContractSchema])).min(1),
});

export const Layer4CompatibilityEnvelopeSchema = z.object({
  actionName: z.string().min(1),
  payload: Layer4DriftPayloadSchema,
  workflow: Layer4WorkflowMetadataSchema,
});

export type Layer4ContractFixture = z.infer<typeof Layer4CompatibilityEnvelopeSchema>;
