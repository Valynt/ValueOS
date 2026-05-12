import { loadGovernanceConfig } from '../../config/governance.js';
import type { GovernanceContext, DriftAssessment } from '../rules.js';

function getGovernanceConfig() {
  return loadGovernanceConfig();
}

const DRIFT_POLICIES = {
  schema: {
    prod: { severity: 'high', remediationAction: 'REQUIRE_APPROVAL' },
    nonProd: { severity: 'medium', remediationAction: 'READ_ONLY' },
  },
  migration: {
    prod: { severity: 'high', remediationAction: 'REQUIRE_APPROVAL' },
    nonProd: { severity: 'medium', remediationAction: 'READ_ONLY' },
  },
  validationContract: {
    prod: { severity: 'high', remediationAction: 'REQUIRE_APPROVAL' },
    nonProd: { severity: 'medium', remediationAction: 'READ_ONLY' },
  },
} as const;

function hasRequiredPayloadFields(payload: unknown, requiredFields: string[]): boolean {
  if (requiredFields.length === 0) return true;
  if (!payload || typeof payload !== 'object') return false;
  return requiredFields.every((field) => {
    const value = (payload as Record<string, unknown>)[field];
    return typeof value === 'string' ? value.trim().length > 0 : value !== undefined && value !== null;
  });
}

function getPayload(payload: unknown): Record<string, unknown> {
  return payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {};
}

export function evaluateGovernanceDrift(ctx: GovernanceContext, granted: string[]): DriftAssessment[] {
  const assessments: DriftAssessment[] = [];
  const payload = getPayload(ctx.action.payload);

  if (ctx.actor.roles.length > 0 && granted.length === 0) {
    assessments.push({
      driftDetected: true,
      driftType: 'ROLE_PERMISSION_STALENESS',
      severity: 'high',
      remediationAction: 'REFRESH_PERMISSIONS',
      details: 'Actor roles are present but resolved permissions are empty.',
    });
  }

  const governanceConfig = getGovernanceConfig();

  if (ctx.environment.stage === 'prod' && governanceConfig.prodApprovalRequiredActions.has(ctx.action.name)) {
    const approvals = ctx.workflow?.approvals ?? [];
    const hasMatchingApproval = approvals.some((approval) =>
      typeof approval === 'string'
        ? approval === ctx.action.name
        : approval?.actionName === ctx.action.name
    );
    if (!hasMatchingApproval || !ctx.workflow?.workflowId) {
      assessments.push({
        driftDetected: true,
        driftType: 'WORKFLOW_APPROVAL_INCONSISTENCY',
        severity: 'high',
        remediationAction: 'REQUIRE_APPROVAL',
        details: 'Prod-gated action missing matching workflow approval context.',
      });
    }
  }

  const requiredFields = governanceConfig.stageRequiredFields[ctx.environment.stage] ?? [];
  if (!hasRequiredPayloadFields(ctx.action.payload, requiredFields)) {
    assessments.push({
      driftDetected: true,
      driftType: 'CRITICAL_CONFIG_INVARIANT',
      severity: ctx.environment.stage === 'prod' ? 'high' : 'medium',
      remediationAction: ctx.environment.stage === 'prod' ? 'REQUIRE_APPROVAL' : 'READ_ONLY',
      details: `Missing required stage-sensitive fields: ${requiredFields.join(', ')}`,
    });
  }

  const schemaHashExpected = process.env.GOVERNANCE_SCHEMA_HASH_EXPECTED;
  const schemaHashObserved = typeof payload.schema_manifest_hash === 'string' ? payload.schema_manifest_hash : undefined;
  if (schemaHashExpected && schemaHashObserved && schemaHashObserved !== schemaHashExpected) {
    const policy = ctx.environment.stage === 'prod' ? DRIFT_POLICIES.schema.prod : DRIFT_POLICIES.schema.nonProd;
    assessments.push({
      driftDetected: true,
      driftType: 'SCHEMA_CONTRACT_DRIFT',
      severity: policy.severity,
      remediationAction: policy.remediationAction,
      details: `Schema contract drift: observed ${schemaHashObserved} expected ${schemaHashExpected}; policy=${policy.severity}/${policy.remediationAction}`,
    });
  }

  const expectedMigrationHead = process.env.APP_MIGRATION_HEAD;
  const runtimeMigrationHead = typeof payload.runtime_migration_head === 'string' ? payload.runtime_migration_head : undefined;
  if (expectedMigrationHead && runtimeMigrationHead && runtimeMigrationHead !== expectedMigrationHead) {
    const policy = ctx.environment.stage === 'prod' ? DRIFT_POLICIES.migration.prod : DRIFT_POLICIES.migration.nonProd;
    assessments.push({
      driftDetected: true,
      driftType: 'MIGRATION_HEAD_DRIFT',
      severity: policy.severity,
      remediationAction: policy.remediationAction,
      details: `Migration head drift: runtime ${runtimeMigrationHead} expected ${expectedMigrationHead}; policy=${policy.severity}/${policy.remediationAction}`,
    });
  }

  const expectedContractVersion = process.env.REQUIRED_PAYLOAD_CONTRACT_VERSION;
  const runtimeContractVersion = typeof payload.contract_version === 'string' ? payload.contract_version : undefined;
  if (expectedContractVersion && runtimeContractVersion && runtimeContractVersion !== expectedContractVersion) {
    const policy = ctx.environment.stage === 'prod' ? DRIFT_POLICIES.validationContract.prod : DRIFT_POLICIES.validationContract.nonProd;
    assessments.push({
      driftDetected: true,
      driftType: 'VALIDATION_CONTRACT_DRIFT',
      severity: policy.severity,
      remediationAction: policy.remediationAction,
      details: `Validation contract drift: runtime ${runtimeContractVersion} expected ${expectedContractVersion}; policy=${policy.severity}/${policy.remediationAction}`,
    });
  }

  return assessments;
}
