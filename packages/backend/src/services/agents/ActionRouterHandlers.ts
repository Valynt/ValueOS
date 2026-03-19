import { SDUIPageDefinition } from '@valueos/sdui';
import {
  ActionContext,
  ActionHandler,
  ActionResult,
  CanonicalAction,
} from '@valueos/shared/types/actions';

import { logger } from '../../lib/logger.js';
import { getSupabaseClient } from '../../lib/supabase.js';
import { normalizeExecutionRequest } from '../../types/execution';
import type { IExecutionRuntime } from '../../types/execution/IExecutionRuntime.js';
import { assumptionService } from '../AssumptionService.js';
import { AuditLogService } from '../AuditLogService.js';
import { atomicActionExecutor } from '../post-v1/AtomicActionExecutor.js';
import { manifestoEnforcer } from '../post-v1/ManifestoEnforcer.js';
import { canvasSchemaService } from '../sdui/CanvasSchemaService.js';
import { ComponentMutationService } from '../sdui/ComponentMutationService.js';
import { LifecycleContext, ValueTreeService, ValueTreeUpdate } from '../ValueTreeService.js';
import { workspaceStateService } from '../WorkspaceStateService.js';

import type { AgentType } from './agent-types.js';
import { AgentAPI } from './AgentAPI.js';
import {
  buildInteractiveSyncDeniedMessage,
  isInteractiveSyncAgentAllowed,
} from './AgentInvocationPolicy.js';
import { handleExportAction } from './ActionRouterExport.js';

export interface ActionRouterHandlerDeps {
  auditLogService: AuditLogService;
  executionRuntime: IExecutionRuntime;
  agentAPI: AgentAPI;
  componentMutationService: ComponentMutationService;
  getValueTreeService: () => ValueTreeService | undefined;
  setValueTreeService: (service: ValueTreeService) => void;
}

export function registerDefaultActionHandlers(
  registerHandler: ActionRouterRegisterHandler,
  deps: ActionRouterHandlerDeps
): void {
  registerHandler('invokeAgent', async (action, context) => {
    if (action.type !== 'invokeAgent') {
      return { success: false, error: 'Invalid action type' };
    }

    try {
      const rawExecution = (action.execution ?? context.execution ?? {}) as Record<string, unknown>;
      const execution = normalizeExecutionRequest({
        agent_id: 'action-router',
        ...rawExecution,
      });
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

      const targetAgent = action.agentId as AgentType;
      if (!isInteractiveSyncAgentAllowed(targetAgent)) {
        return {
          success: false,
          error: buildInteractiveSyncDeniedMessage(targetAgent, 'ActionRouterHandlers.invokeAgent'),
        };
      }

      const result = await deps.agentAPI.invokeAgent({
        agent: targetAgent,
        query: String(action.input ?? ''),
        context: agentContext,
      });

      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  registerHandler('runWorkflowStep', async (action, context) => {
    if (action.type !== 'runWorkflowStep') {
      return { success: false, error: 'Invalid action type' };
    }

    try {
      const envelope = {
        intent: 'run-workflow-step',
        actor: { id: context.userId },
        organizationId: context.organizationId || 'unknown',
        entryPoint: 'action-router',
        reason: 'workflow-step',
        timestamps: { requestedAt: new Date().toISOString() },
      } as const;
      const result = await deps.executionRuntime.executeWorkflow(
        envelope,
        action.workflowId,
        { stepId: action.stepId, ...context },
        context.userId
      );

      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  registerHandler('updateValueTree', async (action, context) => {
    if (action.type !== 'updateValueTree') {
      return { success: false, error: 'Invalid action type' };
    }

    let valueTreeService = deps.getValueTreeService();
    if (!valueTreeService) {
      try {
        valueTreeService = new ValueTreeService(getSupabaseClient());
        deps.setValueTreeService(valueTreeService);
      } catch (error) {
        logger.error('ValueTreeService not available', error);
        return { success: false, error: 'ValueTreeService not available' };
      }
    }

    if (!validateValueTreeStructure(action.updates)) {
      return { success: false, error: 'Invalid value tree structure updates' };
    }

    try {
      const lifecycleContext: LifecycleContext = {
        userId: context.userId,
        organizationId: context.organizationId,
        sessionId: context.sessionId,
      };

      const result = await valueTreeService.updateValueTree(
        action.treeId,
        action.updates as ValueTreeUpdate,
        lifecycleContext
      );

      return {
        success: true,
        data: {
          treeId: result.id,
          updated: true,
          version: result.version,
        },
      };
    } catch (error) {
      logger.error('Failed to update value tree', {
        treeId: action.treeId,
        error: error instanceof Error ? error.message : String(error),
      });
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  registerHandler('updateAssumption', async (action, context) => {
    if (action.type !== 'updateAssumption') {
      return { success: false, error: 'Invalid action type' };
    }

    if (!validateAssumptionEvidence(action.updates)) {
      return { success: false, error: 'Invalid assumption evidence updates' };
    }

    try {
      const result = await assumptionService.updateAssumption(
        action.assumptionId,
        action.updates as Record<string, unknown>,
        {
          userId: context.userId,
          externalSub: typeof context.metadata?.auth0_sub === 'string' ? context.metadata.auth0_sub : undefined,
          sessionId: context.sessionId,
          valueCaseId: context.workspaceId,
          organizationId: context.organizationId,
        }
      );

      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  registerHandler('exportArtifact', handleExportAction);

  registerHandler('openAuditTrail', async (action, context) => {
    if (action.type !== 'openAuditTrail') {
      return { success: false, error: 'Invalid action type' };
    }

    try {
      const logs = await deps.auditLogService.query({
        tenantId: context.organizationId,
        resourceId: action.entityId,
        resourceType: action.entityType,
        limit: 100,
      });

      return {
        success: true,
        data: {
          entityId: action.entityId,
          entityType: action.entityType,
          logs,
        },
      };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  registerHandler('showExplanation', async (action, context) => {
    if (action.type !== 'showExplanation') {
      return { success: false, error: 'Invalid action type' };
    }

    try {
      const currentSchema = await canvasSchemaService.getCachedSchema(context.workspaceId ?? '');
      if (!currentSchema) {
        return {
          success: false,
          error: 'No schema available for workspace to explain component',
        };
      }

      const found = findComponentById(currentSchema, action.componentId);
      if (!found) {
        return {
          success: false,
          error: `Component not found with ID: ${action.componentId}`,
        };
      }

      const componentData = found.component as Record<string, unknown>;
      const componentName = typeof componentData.component === 'string' ? componentData.component : 'unknown';
      const componentProps = componentData.props ?? {};
      const explanationContext = {
        ...context,
        componentName,
        componentProps,
        topic: action.topic,
      };

      const explanationAgent: AgentType = 'narrative';
      if (!isInteractiveSyncAgentAllowed(explanationAgent)) {
        return {
          success: false,
          error: buildInteractiveSyncDeniedMessage(explanationAgent, 'ActionRouterHandlers.showExplanation'),
        };
      }

      const agentResponse = await deps.agentAPI.invokeAgent({
        agent: explanationAgent,
        query: `Explain the "${action.topic}" for the component "${componentName}".\nThe component has the following configuration: ${JSON.stringify(componentProps, null, 2)}.\nPlease provide a clear, concise explanation suitable for a user.`,
        context: explanationContext,
      });

      if (!agentResponse.success) {
        return {
          success: false,
          error: agentResponse.error || 'Failed to generate explanation',
        };
      }

      return {
        success: true,
        data: {
          componentId: action.componentId,
          topic: action.topic,
          explanation: agentResponse.data,
        },
      };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  registerHandler('navigateToStage', async (action) => {
    if (action.type !== 'navigateToStage') {
      return { success: false, error: 'Invalid action type' };
    }

    return { success: true, data: { stage: action.stage } };
  });

  registerHandler('saveWorkspace', async (action) => {
    if (action.type !== 'saveWorkspace') {
      return { success: false, error: 'Invalid action type' };
    }

    try {
      await workspaceStateService.persistState(action.workspaceId);
      return { success: true, data: { workspaceId: action.workspaceId, saved: true } };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  registerHandler('mutateComponent', async (action, context) => {
    if (action.type !== 'mutateComponent') {
      return { success: false, error: 'Invalid action type' };
    }

    try {
      const currentSchema = await canvasSchemaService.getCachedSchema(context.workspaceId ?? '');
      if (!currentSchema) {
        return { success: false, error: 'No schema available for workspace' };
      }

      const executionResult = await atomicActionExecutor.executeAction(
        action.action as Parameters<typeof atomicActionExecutor.executeAction>[0],
        currentSchema,
        context.workspaceId ?? ''
      );

      if (executionResult.success) {
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
      };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  registerHandler('requestOverride', async (action, context) => {
    try {
      const record = action as unknown as Record<string, unknown>;
      const actionId = record.actionId as string;
      const violations = record.violations as Parameters<typeof manifestoEnforcer.requestOverride>[2];
      const justification = record.justification as string;

      const requestId = await manifestoEnforcer.requestOverride(
        actionId,
        context.userId,
        violations,
        justification
      );

      return { success: true, data: { requestId } };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  registerHandler('approveOverride', async (action, context) => {
    try {
      const record = action as unknown as Record<string, unknown>;
      const requestId = record.requestId as string;
      const reason = record.reason as string;

      await manifestoEnforcer.decideOverride(requestId, true, context.userId, reason);
      return { success: true, data: { requestId, approved: true } };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  registerHandler('rejectOverride', async (action, context) => {
    try {
      const record = action as unknown as Record<string, unknown>;
      const requestId = record.requestId as string;
      const reason = record.reason as string;

      await manifestoEnforcer.decideOverride(requestId, false, context.userId, reason);
      return { success: true, data: { requestId, approved: false } };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  logger.info('Registered default action handlers');
}

export type ActionRouterRegisterHandler = (
  actionType: string,
  handler: ActionHandler | ((action: CanonicalAction, context: ActionContext) => Promise<ActionResult>)
) => void;

export function validateValueTreeStructure(updates: unknown): boolean {
  if (!updates || typeof updates !== 'object') return true;

  const record = updates as Record<string, unknown>;
  if (record.structure && typeof record.structure === 'object') {
    const structure = record.structure as Record<string, unknown>;
    return (
      structure.capabilities !== undefined &&
      structure.outcomes !== undefined &&
      structure.kpis !== undefined
    );
  }

  return true;
}

export function validateAssumptionEvidence(updates: unknown): boolean {
  if (!updates || typeof updates !== 'object') return true;

  const record = updates as Record<string, unknown>;
  if (typeof record.source === 'string') {
    return record.source !== 'estimate' && record.source.length > 0;
  }

  return true;
}

export function findComponentById(
  schema: SDUIPageDefinition,
  componentId: string
): { component: unknown; path: string } | null {
  for (let i = 0; i < schema.sections.length; i++) {
    const section = schema.sections[i];
    if (section.props?.id === componentId) {
      return { component: section, path: `sections[${i}]` };
    }

    const implicitId = `${section.component}_${i}`;
    if (implicitId === componentId) {
      return { component: section, path: `sections[${i}]` };
    }

    if ((section as Record<string, unknown>).id === componentId) {
      return { component: section, path: `sections[${i}]` };
    }

    const found = findComponentInProps(section.props, componentId, `sections[${i}]`);
    if (found) return found;
  }
  return null;
}

function findComponentInProps(
  props: unknown,
  componentId: string,
  currentPath: string
): { component: unknown; path: string } | null {
  if (!props || typeof props !== 'object') return null;

  if (Array.isArray(props)) {
    for (let i = 0; i < props.length; i++) {
      const result = findComponentInProps(props[i], componentId, `${currentPath}[${i}]`);
      if (result) return result;
    }
    return null;
  }

  const record = props as Record<string, unknown>;
  if (record.component && typeof record.component === 'string') {
    const innerProps = record.props as Record<string, unknown> | undefined;
    if (innerProps?.id === componentId || record.id === componentId) {
      return { component: props, path: currentPath };
    }
  }

  for (const key of Object.keys(record)) {
    const value = record[key];
    if (typeof value === 'object' && value !== null) {
      const result = findComponentInProps(value, componentId, `${currentPath}.${key}`);
      if (result) return result;
    }
  }

  return null;
}
