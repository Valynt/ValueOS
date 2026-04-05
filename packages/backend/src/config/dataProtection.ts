import {
  resolveOperationalRetentionDays,
  SECURITY_AUDIT_RETENTION_CLASS_ID,
} from "./complianceRetentionAdapter.js";

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
    auditLogs: resolveOperationalRetentionDays({
      classId: SECURITY_AUDIT_RETENTION_CLASS_ID,
      framework: process.env.COMPLIANCE_RETENTION_FRAMEWORK,
    }),
  },
};

