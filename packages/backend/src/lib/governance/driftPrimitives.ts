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

function resolveDriftPolicy(ctx: GovernanceContext, policyType: keyof typeof DRIFT_POLICIES) {
  return ctx.environment.stage === 'prod' ? DRIFT_POLICIES[policyType].prod : DRIFT_POLICIES[policyType].nonProd;
}

function pushSignalDrift(
  assessments: DriftAssessment[],
  ctx: GovernanceContext,
  driftType: DriftAssessment['driftType'],
  policyType: keyof typeof DRIFT_POLICIES,
  signalType: 'missing' | 'mismatch',
  details: string,
): void {
  const policy = resolveDriftPolicy(ctx, policyType);
  assessments.push({
    driftDetected: true,
    driftType,
    severity: policy.severity,
    remediationAction: policy.remediationAction,
    details: `[${signalType.toUpperCase()}] ${details}; policy=${policy.severity}/${policy.remediationAction}`,
  });
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

  const schemaHashExpected = governanceConfig.schemaHashExpected;
  const schemaHashObserved = typeof payload.schema_manifest_hash === 'string' ? payload.schema_manifest_hash : undefined;
  if (schemaHashExpected) {
    if (!schemaHashObserved) {
      pushSignalDrift(
        assessments,
        ctx,
        'SCHEMA_CONTRACT_DRIFT',
        'schema',
        'missing',
        `Schema contract drift signal missing: schema_manifest_hash; expected ${schemaHashExpected}`,
      );
    } else if (schemaHashObserved !== schemaHashExpected) {
      pushSignalDrift(
        assessments,
        ctx,
        'SCHEMA_CONTRACT_DRIFT',
        'schema',
        'mismatch',
        `Schema contract drift: observed ${schemaHashObserved} expected ${schemaHashExpected}`,
      );
    }
  }

  const expectedMigrationHead = governanceConfig.appMigrationHead;
  const runtimeMigrationHead = typeof payload.runtime_migration_head === 'string' ? payload.runtime_migration_head : undefined;
  if (expectedMigrationHead) {
    if (!runtimeMigrationHead) {
      pushSignalDrift(
        assessments,
        ctx,
        'MIGRATION_HEAD_DRIFT',
        'migration',
        'missing',
        `Migration head drift signal missing: runtime_migration_head; expected ${expectedMigrationHead}`,
      );
    } else if (runtimeMigrationHead !== expectedMigrationHead) {
      pushSignalDrift(
        assessments,
        ctx,
        'MIGRATION_HEAD_DRIFT',
        'migration',
        'mismatch',
        `Migration head drift: runtime ${runtimeMigrationHead} expected ${expectedMigrationHead}`,
      );
    }
  }

  const expectedContractVersion = governanceConfig.requiredPayloadContractVersion;
  const runtimeContractVersion = typeof payload.contract_version === 'string' ? payload.contract_version : undefined;
  if (expectedContractVersion) {
    if (!runtimeContractVersion) {
      pushSignalDrift(
        assessments,
        ctx,
        'VALIDATION_CONTRACT_DRIFT',
        'validationContract',
        'missing',
        `Validation contract drift signal missing: contract_version; expected ${expectedContractVersion}`,
      );
    } else if (runtimeContractVersion !== expectedContractVersion) {
      pushSignalDrift(
        assessments,
        ctx,
        'VALIDATION_CONTRACT_DRIFT',
        'validationContract',
        'mismatch',
        `Validation contract drift: runtime ${runtimeContractVersion} expected ${expectedContractVersion}`,
      );
    }
  }

  return assessments;
}
