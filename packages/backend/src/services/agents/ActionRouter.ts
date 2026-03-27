/**
 * Action Router
 *
 * Thin facade that keeps the public class stable while delegating governance,
 * manifesto enforcement, handler dispatch, export handling, and audit logging
 * to sibling modules.
 */

import { randomUUID } from 'crypto';

import {
  ActionContext,
  ActionHandler,
  ActionResult,
  CanonicalAction,
  ManifestoCheckResult,
  ValidationResult,
} from '@valueos/shared/types/actions';

import { logger } from '../../lib/logger.js';
import { EnforcementResult, GovernanceObligation } from '../../lib/rules';
// service-role:justified worker/service requires elevated DB access for background processing
import { getSupabaseClient } from '../../lib/supabase.js';
import { createExecutionRuntime } from '../../runtime/execution-runtime/index.js';
import {
  ActionValidationError,
  validateActionContext,
  validateCanonicalAction,
} from '../../schemas/actions.schema.js';
import type { IExecutionRuntime } from '../../types/execution/IExecutionRuntime.js';
import { AuditLogService } from '../AuditLogService.js';
import { ComponentMutationService } from '../sdui/ComponentMutationService.js';
import { ValueTreeService } from '../ValueTreeService.js';

import { AgentAPI, getAgentAPI } from './AgentAPI.js';
import { logAction } from './ActionRouterAudit.js';
import {
  actionTypeToPermission,
  applyGovernanceObligations,
  checkGovernanceRules,
} from './ActionRouterGovernance.js';
import {
  registerDefaultActionHandlers,
  type ActionRouterHandlerDeps,
} from './ActionRouterHandlers.js';
import { checkManifestoRules } from './ActionRouterManifesto.js';

export class ActionRouter {
  private handlers: Map<string, ActionHandler>;
  private auditLogService: AuditLogService;
  private executionRuntime: IExecutionRuntime;
  private agentAPI: AgentAPI;
  private valueTreeService: ValueTreeService | undefined;
  private componentMutationService: ComponentMutationService;

  constructor(
    auditLogService?: AuditLogService,
    _orchestrator?: unknown,
    agentAPI?: AgentAPI,
    componentMutationService?: ComponentMutationService,
    valueTreeService?: ValueTreeService
  ) {
    this.handlers = new Map();
    this.auditLogService = auditLogService || new AuditLogService();
    this.executionRuntime = createExecutionRuntime();
    this.agentAPI = agentAPI || getAgentAPI();
    this.componentMutationService = componentMutationService || new ComponentMutationService();

    if (valueTreeService) {
      this.valueTreeService = valueTreeService;
    } else {
      try {
        this.valueTreeService = new ValueTreeService(getSupabaseClient());
      } catch (error) {
        logger.warn('Failed to initialize ValueTreeService in ActionRouter constructor', error);
      }
    }

    this.registerDefaultHandlers();
  }

  async routeAction(action: CanonicalAction, context: ActionContext): Promise<ActionResult> {
    const startTime = Date.now();
    const traceId = randomUUID();
    const enhancedContext: ActionContext = {
      ...context,
      traceId,
      timestamp: context.timestamp || new Date().toISOString(),
    };

    logger.info('Routing action', {
      actionType: action.type,
      workspaceId: context.workspaceId,
      userId: context.userId,
      traceId,
    });

    let validatedAction: CanonicalAction = action;
    let validatedContext: ActionContext = enhancedContext;

    try {
      validatedAction = validateCanonicalAction(action) as unknown as CanonicalAction;
      validatedContext = validateActionContext(enhancedContext) as unknown as ActionContext;

      const governanceCheck = await this.checkGovernanceRules(validatedAction, validatedContext);
      if (!governanceCheck.allowed) {
        const reasonCode = (governanceCheck.metadata?.reasonCode as string) ?? 'DENY_POLICY';
        const matchedRules = (governanceCheck.metadata?.matchedRules as string[]) ?? [];
        const evaluatedAt = (governanceCheck.metadata?.evaluatedAt as string) ?? new Date().toISOString();

        logger.error('Governance rules violated - BLOCKING ACTION', {
          actionType: action.type,
          reasonCode,
          violations: governanceCheck.violations.map((v) => `${v.ruleId}: ${v.message}`),
          traceId,
        });

        return {
          success: false,
          error: `Governance rules violated: ${governanceCheck.violations.map((v) => v.message).join(', ')}`,
          metadata: {
            reasonCode,
            violations: governanceCheck.violations,
            warnings: governanceCheck.warnings,
            audit: {
              policyVersion: (governanceCheck.metadata?.policyVersion as string) ?? 'v1',
              evaluatedAt,
              matchedRules,
            },
          },
        };
      }

      const obligations = (governanceCheck.metadata?.obligations as GovernanceObligation[]) ?? [];
      const approvalObligation = obligations.find((o) => o.type === 'REQUIRE_APPROVAL');
      if (approvalObligation) {
        logger.warn('governance: REQUIRE_APPROVAL obligation — action pending approval', {
          actionType: validatedAction.type,
          approvalType: (approvalObligation as { type: 'REQUIRE_APPROVAL'; approvalType: string }).approvalType,
          userId: validatedContext.userId,
          traceId,
        });
        return {
          success: false,
          error: 'Action requires approval before it can be executed.',
          code: 'PENDING_APPROVAL',
          metadata: {
            pendingApproval: true,
            approvalType: (approvalObligation as { type: 'REQUIRE_APPROVAL'; approvalType: string }).approvalType,
            traceId,
          },
        };
      }

      validatedAction = applyGovernanceObligations(validatedAction, validatedContext, obligations);

      const manifestoCheck = await this.checkManifestoRules(validatedAction, validatedContext);
      if (!manifestoCheck.allowed) {
        logger.warn('Manifesto rules violated', {
          actionType: validatedAction.type,
          violations: manifestoCheck.violations,
          traceId,
        });

        return {
          success: false,
          error: `Manifesto rules violated: ${manifestoCheck.violations.map((v) => v.message).join(', ')}`,
          metadata: {
            violations: manifestoCheck.violations,
            warnings: manifestoCheck.warnings,
            traceId,
          },
        };
      }

      const handler = this.handlers.get(validatedAction.type);
      if (!handler) {
        logger.error('No handler registered for action type', {
          actionType: validatedAction.type,
          traceId,
        });

        return {
          success: false,
          error: `No handler registered for action type: ${validatedAction.type}`,
        };
      }

      const result = await handler.execute(validatedAction, validatedContext);
      await this.logAction(validatedAction, validatedContext, result, Date.now() - startTime);

      logger.info('Action routed successfully', {
        actionType: validatedAction.type,
        success: result.success,
        duration: Date.now() - startTime,
        traceId,
      });

      return result;
    } catch (error) {
      if (error instanceof ActionValidationError) {
        logger.error('Action validation failed', {
          actionType: error.actionType,
          issues: error.issues,
          traceId,
        });

        return {
          success: false,
          error: `Validation failed: ${error.message}`,
          metadata: { traceId },
        };
      }

      logger.error('Action routing failed', {
        actionType: validatedAction?.type || 'unknown',
        error: error instanceof Error ? error.message : String(error),
        traceId,
      });

      await this.logAction(
        validatedAction || action,
        validatedContext || context,
        {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        },
        Date.now() - startTime
      );

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  validateAction(action: CanonicalAction): ValidationResult {
    try {
      validateCanonicalAction(action);
      return { valid: true, errors: [] };
    } catch (error) {
      if (error instanceof ActionValidationError) {
        return { valid: false, errors: [error.message] };
      }
      return { valid: false, errors: [String(error)] };
    }
  }

  async checkManifestoRules(
    action: CanonicalAction,
    context: ActionContext
  ): Promise<ManifestoCheckResult> {
    return checkManifestoRules(action, context);
  }

  async checkGovernanceRules(
    action: CanonicalAction,
    context: ActionContext
  ): Promise<EnforcementResult> {
    return checkGovernanceRules(action, context);
  }

  static actionTypeToPermission(actionType: string): string {
    return actionTypeToPermission(actionType);
  }

  registerHandler(
    actionType: string,
    handler: ActionHandler | ((action: CanonicalAction, context: ActionContext) => Promise<ActionResult>)
  ): void {
    const normalized: ActionHandler = typeof handler === 'function'
      ? { name: actionType, execute: handler as ActionHandler['execute'] }
      : handler;
    this.handlers.set(actionType, normalized);
    logger.debug('Registered action handler', { actionType });
  }

  private registerDefaultHandlers(): void {
    const deps: ActionRouterHandlerDeps = {
      auditLogService: this.auditLogService,
      executionRuntime: this.executionRuntime,
      agentAPI: this.agentAPI,
      componentMutationService: this.componentMutationService,
      getValueTreeService: () => this.valueTreeService,
      setValueTreeService: (service) => {
        this.valueTreeService = service;
      },
    };

    registerDefaultActionHandlers(this.registerHandler.bind(this), deps);

    logger.info('Registered default action handlers', {
      handlerCount: this.handlers.size,
    });
  }

  private async logAction(
    action: CanonicalAction,
    context: ActionContext,
    result: ActionResult,
    duration: number
  ): Promise<void> {
    await logAction(this.auditLogService, action, context, result, duration);
  }
}

export const actionRouter = new ActionRouter();
