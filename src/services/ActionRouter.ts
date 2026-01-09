/**
 * Action Router
 * 
 * Central router for all user interactions in the SDUI system.
 * Enforces governance, validates actions, and routes to appropriate handlers.
 */

import { logger } from '../lib/logger';
import {
  ActionContext,
  ActionHandler,
  ActionResult,
  CanonicalAction,
  ManifestoCheckResult,
  ManifestoViolation,
  ValidationResult,
} from '../types/sdui-integration';
import { ExecutionRequest, normalizeExecutionRequest } from '../types/execution';
import { AuditLogService } from './AuditLogService';
import { getUnifiedOrchestrator, UnifiedAgentOrchestrator } from './UnifiedAgentOrchestrator';
import { AgentAPI, getAgentAPI } from './AgentAPI';
import { ComponentMutationService } from './ComponentMutationService';
import { manifestoEnforcer } from './ManifestoEnforcer';
import { atomicActionExecutor } from './AtomicActionExecutor';
import { canvasSchemaService } from './CanvasSchemaService';
import { EnforcementResult, enforceRules } from '../lib/rules';
import { workspaceStateService } from './WorkspaceStateService';

/**
 * Action Router
 */
export class ActionRouter {
  private handlers: Map<string, ActionHandler>;
  private auditLogService: AuditLogService;
  private orchestrator: UnifiedAgentOrchestrator;
  private agentAPI: AgentAPI;
  
  private componentMutationService: ComponentMutationService;

  constructor(
    auditLogService?: AuditLogService,
    orchestrator?: UnifiedAgentOrchestrator,
    agentAPI?: AgentAPI,
    componentMutationService?: ComponentMutationService
  ) {
    this.handlers = new Map();
    this.auditLogService = auditLogService || new AuditLogService();
    this.orchestrator = orchestrator || getUnifiedOrchestrator();
    this.agentAPI = agentAPI || getAgentAPI();
    this.componentMutationService = componentMutationService || new ComponentMutationService();

    // Register default handlers
    this.registerDefaultHandlers();
  }

  /**
   * Route an action to appropriate handler
   */
  async routeAction(
    action: CanonicalAction,
    context: ActionContext
  ): Promise<ActionResult> {
    const startTime = Date.now();

    logger.info('Routing action', {
      actionType: action.type,
      workspaceId: context.workspaceId,
      userId: context.userId,
    });

    try {
      // Validate action structure
      const validation = this.validateAction(action);
      if (!validation.valid) {
        logger.warn('Action validation failed', {
          actionType: action.type,
          errors: validation.errors,
        });

        return {
          success: false,
          error: `Validation failed: ${validation.errors.join(', ')}`,
        };
      }

      // CRITICAL: Check Governance Rules (GR/LR) first - Policy-as-Code enforcement
      const governanceCheck = await this.checkGovernanceRules(action, context);
      if (!governanceCheck.allowed) {
        logger.error('Governance rules violated - BLOCKING ACTION', {
          actionType: action.type,
          violations: governanceCheck.violations.map(v => `${v.ruleId}: ${v.message}`),
        });

        return {
          success: false,
          error: `Governance rules violated: ${governanceCheck.violations.map(v => v.message).join(', ')}`,
          metadata: {
            violations: governanceCheck.violations,
            warnings: governanceCheck.warnings,
          },
        };
      }

      // Check Manifesto rules (business value principles)
      const manifestoCheck = await this.checkManifestoRules(action, context);
      if (!manifestoCheck.allowed) {
        logger.warn('Manifesto rules violated', {
          actionType: action.type,
          violations: manifestoCheck.violations,
        });

        return {
          success: false,
          error: `Manifesto rules violated: ${manifestoCheck.violations.map(v => v.message).join(', ')}`,
          metadata: {
            violations: manifestoCheck.violations,
            warnings: manifestoCheck.warnings,
          },
        };
      }

      // Get handler for action type
      const handler = this.handlers.get(action.type);
      if (!handler) {
        logger.error('No handler registered for action type', {
          actionType: action.type,
        });

        return {
          success: false,
          error: `No handler registered for action type: ${action.type}`,
        };
      }

      // Execute handler
      const result = await handler(action, context);

      // Log action to audit trail
      await this.logAction(action, context, result, Date.now() - startTime);

      logger.info('Action routed successfully', {
        actionType: action.type,
        success: result.success,
        duration: Date.now() - startTime,
      });

      return result;
    } catch (error) {
      logger.error('Action routing failed', {
        actionType: action.type,
        error: error instanceof Error ? error.message : String(error),
      });

      // Log error to audit trail
      await this.logAction(
        action,
        context,
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

  /**
   * Validate action before routing
   */
  validateAction(action: CanonicalAction): ValidationResult {
    const errors: string[] = [];

    // Validate action type
    if (!action.type) {
      errors.push('Action type is required');
    }

    // Validate action-specific fields
    switch (action.type) {
      case 'invokeAgent':
        if (!action.agentId) errors.push('agentId is required');
        if (!action.input) errors.push('input is required');
        // execution can come from action or context
        break;

      case 'runWorkflowStep':
        if (!action.workflowId) errors.push('workflowId is required');
        if (!action.stepId) errors.push('stepId is required');
        break;

      case 'updateValueTree':
        if (!action.treeId) errors.push('treeId is required');
        if (!action.updates) errors.push('updates is required');
        break;

      case 'updateAssumption':
        if (!action.assumptionId) errors.push('assumptionId is required');
        if (!action.updates) errors.push('updates is required');
        break;

      case 'exportArtifact':
        if (!action.artifactType) errors.push('artifactType is required');
        if (!action.format) errors.push('format is required');
        break;

      case 'openAuditTrail':
        if (!action.entityId) errors.push('entityId is required');
        if (!action.entityType) errors.push('entityType is required');
        break;

      case 'showExplanation':
        if (!action.componentId) errors.push('componentId is required');
        if (!action.topic) errors.push('topic is required');
        break;

      case 'navigateToStage':
        if (!action.stage) errors.push('stage is required');
        break;

      case 'saveWorkspace':
        if (!action.workspaceId) errors.push('workspaceId is required');
        break;

      case 'mutateComponent':
        if (!action.action) errors.push('action is required');
        break;
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Check Manifesto rules for action
   */
  async checkManifestoRules(
    action: CanonicalAction,
    context: ActionContext
  ): Promise<ManifestoCheckResult> {
    try {
      // Use ManifestoEnforcer for comprehensive rule checking
      const result = await manifestoEnforcer.checkAction(action, context);

      // Log violations and warnings
      if (result.violations.length > 0) {
        logger.warn('Manifesto rule violations detected', {
          actionType: action.type,
          violations: result.violations.map((v) => v.rule),
        });
      }

      if (result.warnings.length > 0) {
        logger.info('Manifesto rule warnings', {
          actionType: action.type,
          warnings: result.warnings.map((w) => w.rule),
        });
      }

      return result;
    } catch (error) {
      logger.error('Failed to check Manifesto rules', {
        actionType: action.type,
        error: error instanceof Error ? error.message : String(error),
      });

      // On error, allow action but log warning
      return {
        allowed: true,
        violations: [],
        warnings: [{
          rule: 'SYSTEM',
          message: 'Manifesto rules check failed',
          suggestion: 'Manual review recommended',
        }],
      };
    }
  }

  /**
   * Check Governance Rules (GR/LR) - Policy-as-Code enforcement
   * CRITICAL: This must run before any action execution
   */
  async checkGovernanceRules(
    action: CanonicalAction,
    context: ActionContext
  ): Promise<EnforcementResult> {
    try {
      // Build governance rule context from action
      const governanceResult = await enforceRules({
        agentId: `action-router-${action.type}`,
        agentType: this.mapActionToAgentType(action.type),
        userId: context.userId,
        tenantId: context.workspaceId, // Use workspaceId as tenantId
        sessionId: context.sessionId || `session-${Date.now()}`,
        action: action.type,
        payload: action,
        environment: process.env.NODE_ENV as 'development' | 'staging' | 'production' || 'development',
      });

      // Log governance enforcement result
      if (!governanceResult.allowed) {
        logger.error('GOVERNANCE VIOLATION - ACTION BLOCKED', {
          actionType: action.type,
          userId: context.userId,
          tenantId: context.workspaceId,
          violations: governanceResult.violations.map(v => `${v.ruleId}: ${v.message}`),
          globalRulesChecked: governanceResult.metadata.globalRulesChecked,
          localRulesChecked: governanceResult.metadata.localRulesChecked,
        });
      } else {
        logger.debug('Governance rules passed', {
          actionType: action.type,
          globalRulesChecked: governanceResult.metadata.globalRulesChecked,
          localRulesChecked: governanceResult.metadata.localRulesChecked,
          warnings: governanceResult.warnings.length,
        });
      }

      return governanceResult;
    } catch (error) {
      logger.error('CRITICAL: Governance rules check failed - FAILING SAFE', {
        actionType: action.type,
        error: error instanceof Error ? error.message : String(error),
      });

      // CRITICAL: On governance failure, BLOCK action (fail-closed)
      return {
        allowed: false,
        globalResults: [],
        localResults: [],
        violations: [{
          ruleId: 'SYSTEM',
          ruleName: 'Governance System Error',
          category: 'systemic_safety',
          severity: 'critical',
          message: 'Governance rules enforcement failed - action blocked for safety',
          details: { error: error instanceof Error ? error.message : String(error) },
        }],
        warnings: [],
        fallbackActions: [],
        userMessages: ['System safety check failed. Action cannot proceed.'],
        executionTimeMs: 0,
        metadata: {
          globalRulesChecked: 0,
          localRulesChecked: 0,
          timestamp: Date.now(),
          requestId: `error-${Date.now()}`,
        },
      };
    }
  }

  /**
   * Map action type to agent type for governance rules
   */
  private mapActionToAgentType(actionType: string): 'coordinator' | 'system_mapper' | 'intervention_designer' | 'outcome_engineer' | 'realization_loop' | 'value_eval' | 'communicator' {
    // Map action types to agent types for governance rules
    const actionToAgentMap: Record<string, 'coordinator' | 'system_mapper' | 'intervention_designer' | 'outcome_engineer' | 'realization_loop' | 'value_eval' | 'communicator'> = {
      'invokeAgent': 'coordinator',
      'updateValueTree': 'outcome_engineer',
      'exportArtifact': 'communicator',
      'navigateToStage': 'coordinator',
      'createSystemMap': 'system_mapper',
      'designIntervention': 'intervention_designer',
      'trackMetrics': 'realization_loop',
      'evaluateValue': 'value_eval',
      'sendMessage': 'communicator',
    };

    return actionToAgentMap[actionType] || 'coordinator'; // Default to coordinator
  }

  /**
   * Validate value tree structure
   */
  private validateValueTreeStructure(updates: any): boolean {
    // Check if updates maintain standard structure
    if (!updates) return true;
    
    // If updating structure, ensure it has required fields
    if (updates.structure) {
      return (
        updates.structure.capabilities !== undefined &&
        updates.structure.outcomes !== undefined &&
        updates.structure.kpis !== undefined
      );
    }

    return true;
  }

  /**
   * Validate assumption evidence
   */
  private validateAssumptionEvidence(updates: any): boolean {
    // Check if assumption has evidence source
    if (!updates) return true;

    if (updates.source) {
      return updates.source !== 'estimate' && updates.source.length > 0;
    }

    return true;
  }

  /**
   * Register action handler
   */
  registerHandler(actionType: string, handler: ActionHandler): void {
    this.handlers.set(actionType, handler);
    logger.debug('Registered action handler', { actionType });
  }

  /**
   * Register default handlers for all action types
   */
  private registerDefaultHandlers(): void {
    // invokeAgent handler
    this.registerHandler('invokeAgent', async (action, context) => {
      if (action.type !== 'invokeAgent') {
        return { success: false, error: 'Invalid action type' };
      }

      try {
        const execution = normalizeExecutionRequest('action-router', action.execution || context.execution);
        const agentContext = {
          ...execution.parameters,
          ...action.payload,
          intent: execution.intent,
          environment: execution.environment,
          workspaceId: context.workspaceId,
          userId: context.userId,
          sessionId: context.sessionId,
          timestamp: context.timestamp,
          metadata: {
            ...execution.metadata,
            ...context.metadata,
          },
        };

        // Route to agent API
        const result = await this.agentAPI.invokeAgent({
          agent: action.agentId,
          query: action.input,
          context: agentContext,
        });

        return {
          success: true,
          data: result,
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    });

    // runWorkflowStep handler
    this.registerHandler('runWorkflowStep', async (action, context) => {
      if (action.type !== 'runWorkflowStep') {
        return { success: false, error: 'Invalid action type' };
      }

      try {
        // Route to workflow orchestrator
        const envelope = {
          intent: 'run-workflow-step',
          actor: { id: context.userId },
          organizationId: context.organizationId || 'unknown',
          entryPoint: 'action-router',
          reason: action.reason || 'workflow-step',
          timestamps: { requestedAt: new Date().toISOString() },
        } as const;
        const result = await this.orchestrator.executeWorkflow(
          envelope,
          action.workflowId,
          { ...action.input, ...context },
          context.userId
        );

        return {
          success: true,
          data: result,
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    });

    // updateValueTree handler
    this.registerHandler('updateValueTree', async (action, context) => {
      if (action.type !== 'updateValueTree') {
        return { success: false, error: 'Invalid action type' };
      }

      // TODO: Implement value tree update
      return {
        success: true,
        data: { treeId: action.treeId, updated: true },
      };
    });

    // updateAssumption handler
    this.registerHandler('updateAssumption', async (action, context) => {
      if (action.type !== 'updateAssumption') {
        return { success: false, error: 'Invalid action type' };
      }

      // TODO: Implement assumption update
      return {
        success: true,
        data: { assumptionId: action.assumptionId, updated: true },
      };
    });

    // exportArtifact handler
    this.registerHandler('exportArtifact', async (action, context) => {
      if (action.type !== 'exportArtifact') {
        return { success: false, error: 'Invalid action type' };
      }

      // TODO: Implement artifact export
      return {
        success: true,
        data: { artifactType: action.artifactType, format: action.format },
      };
    });

    // openAuditTrail handler
    this.registerHandler('openAuditTrail', async (action, context) => {
      if (action.type !== 'openAuditTrail') {
        return { success: false, error: 'Invalid action type' };
      }

      // TODO: Implement audit trail opening
      return {
        success: true,
        data: { entityId: action.entityId, entityType: action.entityType },
      };
    });

    // showExplanation handler
    this.registerHandler('showExplanation', async (action, context) => {
      if (action.type !== 'showExplanation') {
        return { success: false, error: 'Invalid action type' };
      }

      // TODO: Implement explanation showing
      return {
        success: true,
        data: { componentId: action.componentId, topic: action.topic },
      };
    });

    // navigateToStage handler
    this.registerHandler('navigateToStage', async (action, context) => {
      if (action.type !== 'navigateToStage') {
        return { success: false, error: 'Invalid action type' };
      }

      // Navigation is handled by schema regeneration
      return {
        success: true,
        data: { stage: action.stage },
      };
    });

    // saveWorkspace handler
    this.registerHandler('saveWorkspace', async (action, context) => {
      if (action.type !== 'saveWorkspace') {
        return { success: false, error: 'Invalid action type' };
      }

      try {
        await workspaceStateService.persistState(action.workspaceId);

        return {
          success: true,
          data: { workspaceId: action.workspaceId, saved: true },
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    });

    // mutateComponent handler
    this.registerHandler('mutateComponent', async (action, context) => {
      if (action.type !== 'mutateComponent') {
        return { success: false, error: 'Invalid action type' };
      }

      try {
        // Get current schema
        const currentSchema = canvasSchemaService.getCachedSchema(context.workspaceId);
        
        if (!currentSchema) {
          return {
            success: false,
            error: 'No schema available for workspace',
          };
        }

        // Execute atomic action
        const executionResult = await atomicActionExecutor.executeAction(
          action.action,
          currentSchema,
          context.workspaceId
        );

        // If successful, update cached schema
        if (executionResult.success) {
          // Cache the updated schema
          // Note: In production, this would trigger a proper schema update
          logger.info('Atomic action executed successfully', {
            executionId: executionResult.executionId,
            affectedComponents: executionResult.actionResult.affected_components.length,
          });
        }

        return {
          success: executionResult.success,
          data: {
            executionId: executionResult.executionId,
            ...executionResult.actionResult,
          },
          atomicActions: executionResult.success ? [action.action] : undefined,
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    });

    // requestOverride handler
    this.registerHandler('requestOverride', async (action: any, context) => {
      try {
        const { actionId, violations, justification } = action;

        const requestId = await manifestoEnforcer.requestOverride(
          actionId,
          context.userId,
          violations,
          justification
        );

        return {
          success: true,
          data: { requestId },
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    });

    // approveOverride handler
    this.registerHandler('approveOverride', async (action: any, context) => {
      try {
        const { requestId, reason } = action;

        await manifestoEnforcer.decideOverride(
          requestId,
          true,
          context.userId,
          reason
        );

        return {
          success: true,
          data: { requestId, approved: true },
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    });

    // rejectOverride handler
    this.registerHandler('rejectOverride', async (action: any, context) => {
      try {
        const { requestId, reason } = action;

        await manifestoEnforcer.decideOverride(
          requestId,
          false,
          context.userId,
          reason
        );

        return {
          success: true,
          data: { requestId, approved: false },
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    });

    logger.info('Registered default action handlers', {
      handlerCount: this.handlers.size,
    });
  }

  /**
   * Log action to audit trail
   */
  private async logAction(
    action: CanonicalAction,
    context: ActionContext,
    result: ActionResult,
    duration: number
  ): Promise<void> {
    try {
      await this.auditLogService.logAction({
        action_type: action.type,
        workspace_id: context.workspaceId,
        user_id: context.userId,
        session_id: context.sessionId,
        action_data: action,
        result_data: result,
        success: result.success,
        error_message: result.error,
        duration_ms: duration,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Failed to log action to audit trail', {
        actionType: action.type,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

// Singleton instance
export const actionRouter = new ActionRouter();
