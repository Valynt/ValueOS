import { loadGovernanceConfig } from '../../config/governance.js';
import type { GovernanceContext, DriftAssessment } from '../rules.js';

const governanceConfig = loadGovernanceConfig();
const PROD_APPROVAL_REQUIRED_ACTIONS = governanceConfig.prodApprovalRequiredActions;

function hasRequiredPayloadFields(payload: unknown, requiredFields: string[]): boolean {
  if (requiredFields.length === 0) return true;
  if (!payload || typeof payload !== 'object') return false;
  return requiredFields.every((field) => {
    const value = (payload as Record<string, unknown>)[field];
    return typeof value === 'string' ? value.trim().length > 0 : value !== undefined && value !== null;
  });
}

export function evaluateGovernanceDrift(ctx: GovernanceContext, granted: string[]): DriftAssessment[] {
  const assessments: DriftAssessment[] = [];

  if (ctx.actor.roles.length > 0 && granted.length === 0) {
    assessments.push({
      driftDetected: true,
      driftType: 'ROLE_PERMISSION_STALENESS',
      severity: 'high',
      remediationAction: 'REFRESH_PERMISSIONS',
      details: 'Actor roles are present but resolved permissions are empty.',
    });
  }

  if (ctx.environment.stage === 'prod' && PROD_APPROVAL_REQUIRED_ACTIONS.has(ctx.action.name)) {
    const approvals = ctx.workflow?.approvals ?? [];
    if (!approvals.includes(ctx.action.name) || !ctx.workflow?.workflowId) {
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

  return assessments;
}
