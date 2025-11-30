/**
 * Data protection and retention configuration
 * Phase 3: classification and TTLs for sensitive artifacts.
 */

export interface DataClassificationConfig {
  defaultLevel: 'public' | 'internal' | 'confidential' | 'restricted';
  tableClassifications: Record<string, DataClassificationConfig['defaultLevel']>;
  retentionDays: {
    prompts: number;
    outputs: number;
    transientArtifacts: number;
    auditLogs: number;
  };
}

export const dataProtectionConfig: DataClassificationConfig = {
  defaultLevel: 'internal',
  tableClassifications: {
    prompts: 'confidential',
    outputs: 'confidential',
    embeddings: 'restricted',
    audit_logs: 'restricted',
  },
  retentionDays: {
    prompts: 30,
    outputs: 30,
    transientArtifacts: 7,
    auditLogs: 365,
  },
};

