/**
 * Agent Output Listener
 * 
 * Listens to agent outputs and triggers SDUI updates.
 * This service acts as an event bus between agents and the SDUI system.
 */

import { EventEmitter } from 'events';

import { logger } from '../../lib/logger.js'
import { AgentOutput } from '../../types/agent-output';
import { canvasSchemaService } from '../sdui/CanvasSchemaService.js'
import { getComponentMutationService } from '../sdui/ComponentMutationService.js'
import { AgentResult } from './core/AgentContract.js';

import { agentSDUIAdapter } from './AgentSDUIAdapter.js'

/**
 * Agent output event types
 */
export type AgentOutputEvent = 'agent:output' | 'agent:error' | 'agent:complete';

/**
 * Agent output listener callback
 */
export type AgentOutputCallback = (output: AgentOutput) => void | Promise<void>;

/**
 * Agent Output Listener Service
 */
export class AgentOutputListener extends EventEmitter {
  // Named `agentListeners` to avoid shadowing EventEmitter's `listeners` method.
  private agentListeners: Map<string, AgentOutputCallback[]>;
  private enabled: boolean;

  constructor() {
    super();
    this.agentListeners = new Map();
    this.enabled = true;
  }

  /**
   * Enable listener
   */
  enable(): void {
    this.enabled = true;
    logger.info('Agent output listener enabled');
  }

  /**
   * Disable listener
   */
  disable(): void {
    this.enabled = false;
    logger.info('Agent output listener disabled');
  }

  /**
   * Register callback for agent output
   */
  onAgentOutput(agentId: string, callback: AgentOutputCallback): void {
    if (!this.agentListeners.has(agentId)) {
      this.agentListeners.set(agentId, []);
    }
    this.agentListeners.get(agentId)!.push(callback);
    logger.debug('Registered agent output callback', { agentId });
  }

  /**
   * Register callback for all agent outputs
   */
  onAnyAgentOutput(callback: AgentOutputCallback): void {
    this.onAgentOutput('*', callback);
  }

  /**
   * Handle agent output
   */
  async handleAgentOutput(output: AgentOutput): Promise<void> {
    if (!this.enabled) {
      logger.debug('Agent output listener disabled, skipping', {
        agentId: output.agent_id,
      });
      return;
    }

    logger.info('Handling agent output', {
      agentId: output.agent_id,
      agentType: output.agent_type,
      workspaceId: output.workspaceId,
    });

    try {
      // Emit event
      this.emit('agent:output', output);

      // Call registered callbacks
      await this.callCallbacks(output);

      // Process output for SDUI update
      await this.processForSDUI(output);

      // Emit complete event
      this.emit('agent:complete', output);

      logger.info('Agent output handled successfully', {
        agentId: output.agent_id,
      });
    } catch (error) {
      logger.error('Failed to handle agent output', {
        agentId: output.agent_id,
        error: error instanceof Error ? error.message : String(error),
      });

      // Emit error event
      this.emit('agent:error', {
        output,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Call registered callbacks
   */
  private async callCallbacks(output: AgentOutput): Promise<void> {
    // Call agent-specific callbacks
    const agentCallbacks = this.agentListeners.get(output.agent_id) || [];
    for (const callback of agentCallbacks) {
      try {
        await callback(output);
      } catch (error) {
        logger.error('Agent callback failed', {
          agentId: output.agent_id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // Call wildcard callbacks
    const wildcardCallbacks = this.agentListeners.get('*') || [];
    for (const callback of wildcardCallbacks) {
      try {
        await callback(output);
      } catch (error) {
        logger.error('Wildcard callback failed', {
          agentId: output.agent_id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  /**
   * Process agent output for SDUI update
   */
  private async processForSDUI(output: AgentOutput): Promise<void> {
    try {
      const legacyData: unknown = output.result?.data;
      const resultData =
        legacyData && typeof legacyData === 'object'
          ? (legacyData as Record<string, unknown>)
          : {};
      // Generate SDUI update from agent output
      const mappedResult: AgentResult<Record<string, unknown>> = {
        success: output.status === 'success' || output.status === 'partial_success',
        output: {
          ...resultData,
          agentId: output.agent_id,
          agentType: output.agent_type,
        },
        error: output.result?.errors?.map((entry) => entry.message).join('; ') || undefined,
        meta: {
          traceId: output.execution_id,
          contractVersion: 'legacy-agent-output.v1',
          durationMs: output.metadata?.execution_time_ms ?? 0,
          validation: {
            passed: (output.result?.errors?.length ?? 0) === 0,
            errors: output.result?.errors?.map((entry) => entry.message),
            warnings: output.result?.warnings,
          },
          retry: {
            count: output.metadata?.retry_count ?? 0,
          },
        },
      };
      const sduiUpdate = await agentSDUIAdapter.processAgentOutputWithIntents(
        output.agent_id,
        mappedResult,
        output.workspaceId
      );

      // Apply SDUI update
      if (sduiUpdate.type === 'full_schema') {
        // Invalidate cache to trigger full regeneration
        canvasSchemaService.invalidateCache(output.workspaceId);
        logger.info('Triggered full schema regeneration', {
          workspaceId: output.workspaceId,
        });
      } else if (sduiUpdate.type === 'atomic_actions' && sduiUpdate.actions) {
        // Apply atomic actions
        const mutationService = getComponentMutationService();
        const currentSchema = await canvasSchemaService.getCachedSchema(output.workspaceId);

        if (currentSchema) {
          const { layout: newSchema, results } = await mutationService.applyActions(currentSchema, sduiUpdate.actions);

          // Check if any action was successful
          const anySuccess = results.some(r => r.success);

          if (anySuccess) {
            // Update cache with new schema
            await canvasSchemaService.cacheSchemaWithCAS(output.workspaceId, newSchema);
            logger.info('Applied atomic actions and updated schema', {
              workspaceId: output.workspaceId,
              actionCount: sduiUpdate.actions.length,
              successCount: results.filter(r => r.success).length,
            });
          } else {
             logger.warn('All atomic actions failed', {
               workspaceId: output.workspaceId,
               results
             });
          }
        } else {
           logger.warn('Could not apply atomic actions: No cached schema found', {
             workspaceId: output.workspaceId
           });
           // Invalidate to force regeneration next time
           canvasSchemaService.invalidateCache(output.workspaceId);
        }
      }
    } catch (error) {
      logger.error('Failed to process agent output for SDUI', {
        agentId: output.agent_id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Remove callback
   */
  removeCallback(agentId: string, callback: AgentOutputCallback): void {
    const callbacks = this.agentListeners.get(agentId);
    if (callbacks) {
      const index = callbacks.indexOf(callback);
      if (index !== -1) {
        callbacks.splice(index, 1);
        logger.debug('Removed agent output callback', { agentId });
      }
    }
  }

  /**
   * Clear all callbacks
   */
  clearCallbacks(): void {
    this.agentListeners.clear();
    logger.info('Cleared all agent output callbacks');
  }
}

// Singleton instance
export const agentOutputListener = new AgentOutputListener();

// Register default SDUI update handler
agentOutputListener.onAnyAgentOutput(async (output) => {
  logger.debug('Default SDUI handler processing agent output', {
    agentId: output.agent_id,
    agentType: output.agent_type,
  });
});
