import { LAYER4_PAYLOAD_CONTRACT_VERSION } from './layer4Contract.js';

export interface BuildLayer4PayloadInput {
  requestId: string;
  schemaManifestHash: string;
  runtimeMigrationHead: string;
  changeTicketId: string;
  riskAcceptanceId: string;
}

export function buildLayer4DriftPayload(input: BuildLayer4PayloadInput): Record<string, string> {
  return {
    requestId: input.requestId,
    changeTicketId: input.changeTicketId,
    riskAcceptanceId: input.riskAcceptanceId,
    schema_manifest_hash: input.schemaManifestHash,
    runtime_migration_head: input.runtimeMigrationHead,
    contract_version: LAYER4_PAYLOAD_CONTRACT_VERSION,
  };
}
