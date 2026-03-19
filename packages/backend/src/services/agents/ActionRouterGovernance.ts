import { ActionContext, CanonicalAction } from '@valueos/shared/types/actions';

import { logger } from '../../lib/logger.js';
import { EnforcementResult, enforceRules, GovernanceObligation } from '../../lib/rules';


export function applyGovernanceObligations(
  action: CanonicalAction,
  context: ActionContext,
  obligations: GovernanceObligation[]
): CanonicalAction {
  let result = { ...action };

  for (const obligation of obligations) {
    switch (obligation.type) {
      case 'LOG_AUDIT':
        logger.info('governance: audit obligation — action approved', {
          actionType: action.type,
          userId: context.userId,
          workspaceId: context.workspaceId,
          traceId: context.traceId,
          timestamp: new Date().toISOString(),
        });
        break;
      case 'REDACT_FIELDS': {
        if (result.payload && typeof result.payload === 'object') {
          const redacted = { ...(result.payload as Record<string, unknown>) };
          for (const field of obligation.fields) {
            delete redacted[field];
          }
          result = { ...result, payload: redacted };
        }
        logger.info('governance: REDACT_FIELDS obligation applied', {
          actionType: action.type,
          fields: obligation.fields,
        });
        break;
      }
      case 'REQUIRE_APPROVAL':
        logger.warn('governance: unexpected REQUIRE_APPROVAL in applyGovernanceObligations — already handled', {
          actionType: action.type,
        });
        break;
      case 'READ_ONLY':
        logger.warn('governance: READ_ONLY obligation — downgrading action', {
          actionType: action.type,
          userId: context.userId,
        });
        result = {
          ...result,
          payload: { ...(result.payload as Record<string, unknown> ?? {}), __readOnly: true },
        };
        break;
    }
  }

  return result;
}

export async function checkGovernanceRules(
  action: CanonicalAction,
  context: ActionContext
): Promise<EnforcementResult> {
  try {
    const governanceResult = await enforceRules({
      agentId: `action-router-${action.type}`,
      agentType: mapActionToAgentType(action.type),
      userId: context.userId,
      tenantId: context.organizationId,
      sessionId: context.sessionId || `session-${Date.now()}`,
      action: actionTypeToPermission(action.type),
      payload: action,
      environment:
        (process.env.NODE_ENV as 'development' | 'staging' | 'production') || 'development',
    });

    if (!governanceResult.allowed) {
      logger.error('GOVERNANCE VIOLATION - ACTION BLOCKED', {
        actionType: action.type,
        userId: context.userId,
        tenantId: context.workspaceId,
        violations: governanceResult.violations.map((v) => `${v.ruleId}: ${v.message}`),
        globalRulesChecked: governanceResult.metadata?.globalRulesChecked,
        localRulesChecked: governanceResult.metadata?.localRulesChecked,
      });
    } else {
      logger.debug('Governance rules passed', {
        actionType: action.type,
        globalRulesChecked: governanceResult.metadata?.globalRulesChecked,
        localRulesChecked: governanceResult.metadata?.localRulesChecked,
        warnings: governanceResult.warnings.length,
      });
    }

    return governanceResult;
  } catch (error) {
    logger.error('CRITICAL: Governance rules check failed - FAILING SAFE', {
      actionType: action.type,
      error: error instanceof Error ? error.message : String(error),
    });

    return {
      allowed: false,
      violations: [
        {
          ruleId: 'SYSTEM',
          ruleName: 'Governance System Error',
          severity: 'critical',
          message: 'Governance rules enforcement failed - action blocked for safety',
        },
      ],
      warnings: [],
      metadata: {
        globalRulesChecked: 0,
        localRulesChecked: 0,
        timestamp: Date.now(),
        requestId: `error-${Date.now()}`,
      },
    };
  }
}

export function actionTypeToPermission(actionType: string): string {
  const map: Record<string, string> = {
    invokeAgent: 'agents:execute',
    runWorkflowStep: 'agents:execute',
    updateValueTree: 'value_trees:edit',
    updateAssumption: 'value_trees:edit',
    exportArtifact: 'projects:view',
    openAuditTrail: 'audit.read',
    showExplanation: 'projects:view',
    navigateToStage: 'projects:view',
    saveWorkspace: 'projects:edit',
    mutateComponent: 'projects:edit',
  };
  return map[actionType] ?? actionType;
}

export function mapActionToAgentType(
  actionType: string
):
  | 'coordinator'
  | 'system_mapper'
  | 'intervention_designer'
  | 'outcome_engineer'
  | 'realization_loop'
  | 'value_eval'
  | 'communicator' {
  const actionToAgentMap: Record<
    string,
    | 'coordinator'
    | 'system_mapper'
    | 'intervention_designer'
    | 'outcome_engineer'
    | 'realization_loop'
    | 'value_eval'
    | 'communicator'
  > = {
    invokeAgent: 'coordinator',
    updateValueTree: 'outcome_engineer',
    exportArtifact: 'communicator',
    navigateToStage: 'coordinator',
    createSystemMap: 'system_mapper',
    designIntervention: 'intervention_designer',
    trackMetrics: 'realization_loop',
    evaluateValue: 'value_eval',
    sendMessage: 'communicator',
  };

  return actionToAgentMap[actionType] || 'coordinator';
}
