import { type GovernanceContext } from '../rules.js';

export type DriftSeverity = 'low' | 'medium' | 'high';
export type DriftType =
  | 'ROLE_PERMISSION_STALENESS'
  | 'WORKFLOW_APPROVAL_INCONSISTENCY'
  | 'CRITICAL_CONFIG_INVARIANT';
export type DriftRemediationAction = 'REQUIRE_APPROVAL' | 'READ_ONLY' | 'REFRESH_PERMISSIONS';

export interface DriftAssessment {
  driftDetected: boolean;
  driftType?: DriftType;
  severity?: DriftSeverity;
  remediationAction?: DriftRemediationAction;
  details?: string;
}

export interface DriftRecord {
  driftType: DriftType;
  severity: DriftSeverity;
  tenantId?: string;
  workflowId?: string;
  remediationRecommendation: DriftRemediationAction;
  details: string;
}

export function stageSensitiveFields(stage: GovernanceContext['environment']['stage']): string[] {
  if (stage === 'prod') return ['changeTicketId', 'riskAcceptanceId'];
  if (stage === 'staging') return ['changeTicketId'];
  return [];
}

export function hasRequiredPayloadFields(payload: unknown, requiredFields: string[]): boolean {
  if (requiredFields.length === 0) return true;
  if (!payload || typeof payload !== 'object') return false;
  return requiredFields.every((field) => {
    const value = (payload as Record<string, unknown>)[field];
    return typeof value === 'string' ? value.trim().length > 0 : value !== undefined && value !== null;
  });
}

export function evaluateGovernanceDrift(
  ctx: GovernanceContext,
  granted: string[],
  prodApprovalRequiredActions: Set<string>
): DriftAssessment[] {
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

  if (ctx.environment.stage === 'prod' && prodApprovalRequiredActions.has(ctx.action.name)) {
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

  const requiredFields = stageSensitiveFields(ctx.environment.stage);
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

export function toDriftRecords(
  assessments: DriftAssessment[],
  identifiers: { tenantId?: string; workflowId?: string }
): DriftRecord[] {
  return assessments
    .filter((assessment): assessment is Required<Pick<DriftAssessment, 'driftType' | 'severity' | 'remediationAction'>> & DriftAssessment =>
      Boolean(assessment.driftDetected && assessment.driftType && assessment.severity && assessment.remediationAction)
    )
    .map((assessment) => ({
      driftType: assessment.driftType,
      severity: assessment.severity,
      tenantId: identifiers.tenantId,
      workflowId: identifiers.workflowId,
      remediationRecommendation: assessment.remediationAction,
      details: assessment.details ?? 'Governance drift detected.',
    }));
}
