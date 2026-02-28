/**
 * HandoverMiddleware — inter-agent sub-task delegation within the pipeline.
 *
 * After the downstream handler returns, this middleware inspects the response
 * for a `CapabilityRequest` signal. If found, it locates a suitable agent
 * (via AgentRegistry) or tool (via ToolRegistry), dispatches the sub-task
 * through AgentMessageBroker, maps the result, and merges it into the
 * original response.
 */

import { logger } from '../../lib/logger.js';
import {
  AgentMiddleware,
  AgentMiddlewareContext,
  AgentResponse,
} from '../UnifiedAgentOrchestrator.js';

import { CapabilityRequest, HandoverResult } from './types.js';

// ---------------------------------------------------------------------------
// Dependency interfaces (duck-typed for testability)
// ---------------------------------------------------------------------------

export interface HandoverDeps {
  agentRegistry: {
    getAgent(agentId: string): { id: string; capabilities: string[] } | undefined;
    getAgentsByLifecycle(
      stage: string,
      includeDegraded?: boolean,
    ): Array<{ id: string; capabilities: string[] }>;
  };
  messageBroker: {
    sendToAgent<T = unknown>(
      fromAgentId: string,
      toAgentId: string,
      payload: unknown,
      options?: { priority?: string; timeoutMs?: number },
    ): Promise<{ success: boolean; data?: T; error?: string }>;
  };
  toolRegistry: {
    get(toolName: string): { name: string } | undefined;
    execute(
      toolName: string,
      params: unknown,
      context?: Record<string, unknown>,
    ): Promise<{ success: boolean; data?: unknown; error?: { message: string } }>;
  };
  collaborationService?: {
    emit(event: string, data: unknown): void;
  };
}

// ---------------------------------------------------------------------------
// HandoverMiddleware
// ---------------------------------------------------------------------------

export class HandoverMiddleware implements AgentMiddleware {
  public readonly name = 'handover';

  private deps: HandoverDeps;

  constructor(deps: HandoverDeps) {
    this.deps = deps;
  }

  async execute(
    context: AgentMiddlewareContext,
    next: () => Promise<AgentResponse>,
  ): Promise<AgentResponse> {
    // Execute downstream first
    const response = await next();

    // Check for a CapabilityRequest in the response payload
    const capReq = this.extractCapabilityRequest(response);
    if (!capReq) {
      return response;
    }

    logger.info('HandoverMiddleware: CapabilityRequest detected', {
      capability: capReq.capability,
      mergeKey: capReq.mergeKey,
    });

    const handoverResult = await this.dispatch(capReq, context);

    // Log collaboration event for observability
    this.logCollaborationEvent(context, capReq, handoverResult);

    if (!handoverResult.success) {
      // Append warning, don't fail the response
      const warnings = (response.payload?.warnings as string[]) ?? [];
      warnings.push(
        `Handover for capability "${capReq.capability}" failed: ${handoverResult.error}`,
      );
      return {
        ...response,
        payload: { ...response.payload, warnings },
      };
    }

    // Map and merge result
    const mappedData = this.applyOutputMapping(
      handoverResult.data ?? {},
      capReq.outputMapping,
    );

    return {
      ...response,
      payload: {
        ...response.payload,
        [capReq.mergeKey]: mappedData,
      },
    };
  }

  // ---------------------------------------------------------------------------
  // Dispatch logic
  // ---------------------------------------------------------------------------

  private async dispatch(
    capReq: CapabilityRequest,
    context: AgentMiddlewareContext,
  ): Promise<HandoverResult> {
    const start = Date.now();

    // 1. Try agent registry — find an agent with the requested capability
    const agent = this.findAgentByCapability(capReq.capability);
    if (agent) {
      try {
        const result = await this.deps.messageBroker.sendToAgent(
          'orchestrator',
          agent.id,
          {
            action: 'handover',
            capability: capReq.capability,
            inputData: capReq.inputData,
            context: {
              userId: context.userId,
              sessionId: context.sessionId,
              traceId: context.traceId,
            },
          },
          {
            priority: capReq.priority ?? 'normal',
            timeoutMs: capReq.timeoutMs ?? 15_000,
          },
        );

        return {
          success: result.success,
          targetAgent: agent.id,
          data: result.data as Record<string, unknown> | undefined,
          error: result.error,
          durationMs: Date.now() - start,
        };
      } catch (err) {
        logger.warn('Agent handover failed, falling back to tool registry', {
          agentId: agent.id,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    // 2. Fallback: try tool registry
    const tool = this.deps.toolRegistry.get(capReq.capability);
    if (tool) {
      try {
        const result = await this.deps.toolRegistry.execute(
          capReq.capability,
          capReq.inputData,
          {
            userId: context.userId,
            sessionId: context.sessionId,
            traceId: context.traceId,
          },
        );

        return {
          success: result.success,
          targetTool: tool.name,
          data: result.data as Record<string, unknown> | undefined,
          error: result.error?.message,
          durationMs: Date.now() - start,
        };
      } catch (err) {
        return {
          success: false,
          targetTool: tool.name,
          error: err instanceof Error ? err.message : String(err),
          durationMs: Date.now() - start,
        };
      }
    }

    // 3. Nothing found
    logger.warn('No agent or tool found for capability', {
      capability: capReq.capability,
    });

    return {
      success: false,
      error: `No agent or tool found for capability "${capReq.capability}"`,
      durationMs: Date.now() - start,
    };
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private extractCapabilityRequest(
    response: AgentResponse,
  ): CapabilityRequest | null {
    if (!response.payload) return null;

    const payload = response.payload as Record<string, unknown>;
    const capReq = payload.capabilityRequest as CapabilityRequest | undefined;

    if (
      capReq &&
      typeof capReq.capability === 'string' &&
      typeof capReq.mergeKey === 'string'
    ) {
      return capReq;
    }

    return null;
  }

  private findAgentByCapability(
    capability: string,
  ): { id: string; capabilities: string[] } | undefined {
    // Search across all lifecycle stages
    const stages = [
      'opportunity',
      'target',
      'realization',
      'expansion',
      'integrity',
    ];

    for (const stage of stages) {
      const agents = this.deps.agentRegistry.getAgentsByLifecycle(stage, true);
      const match = agents.find((a) =>
        a.capabilities.includes(capability),
      );
      if (match) return match;
    }

    return undefined;
  }

  private applyOutputMapping(
    data: Record<string, unknown>,
    mapping?: Record<string, string>,
  ): Record<string, unknown> {
    if (!mapping) return data;

    const mapped: Record<string, unknown> = {};
    for (const [sourceField, targetField] of Object.entries(mapping)) {
      if (sourceField in data) {
        mapped[targetField] = data[sourceField];
      }
    }

    // Include unmapped fields as-is
    for (const [key, value] of Object.entries(data)) {
      if (!mapping[key]) {
        mapped[key] = value;
      }
    }

    return mapped;
  }

  private logCollaborationEvent(
    context: AgentMiddlewareContext,
    capReq: CapabilityRequest,
    result: HandoverResult,
  ): void {
    if (this.deps.collaborationService) {
      this.deps.collaborationService.emit('handover', {
        fromAgent: context.agentType,
        toAgent: result.targetAgent ?? result.targetTool ?? 'unknown',
        capability: capReq.capability,
        success: result.success,
        durationMs: result.durationMs,
        traceId: context.traceId,
        timestamp: Date.now(),
      });
    }
  }
}
