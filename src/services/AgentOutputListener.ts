/**
 * Agent Output Listener
 * 
 * Listens to agent outputs and triggers SDUI updates.
 * This service acts as an event bus between agents and the SDUI system.
 */

import { logger } from '../lib/logger';
import { AgentOutput } from '../types/agent-output';
import { agentSDUIAdapter } from './AgentSDUIAdapter';
import { canvasSchemaService } from './CanvasSchemaService';
import { EventEmitter } from 'events';

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
  private listeners: Map<string, AgentOutputCallback[]>;
  private enabled: boolean;

  constructor() {
    super();
    this.listeners = new Map();
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
    if (!this.listeners.has(agentId)) {
      this.listeners.set(agentId, []);
    }
    this.listeners.get(agentId)!.push(callback);
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
        agentId: output.agentId,
      });
      return;
    }

    logger.info('Handling agent output', {
      agentId: output.agentId,
      agentType: output.agentType,
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
        agentId: output.agentId,
      });
    } catch (error) {
      logger.error('Failed to handle agent output', {
        agentId: output.agentId,
        error: error instanceof Error ? error.message : String(error),
      });

      // Emit error event
      this.emit('agent:error', { output, error });
    }
  }

  /**
   * Call registered callbacks
   */
  private async callCallbacks(output: AgentOutput): Promise<void> {
    // Call agent-specific callbacks
    const agentCallbacks = this.listeners.get(output.agentId) || [];
    for (const callback of agentCallbacks) {
      try {
        await callback(output);
      } catch (error) {
        logger.error('Agent callback failed', {
          agentId: output.agentId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // Call wildcard callbacks
    const wildcardCallbacks = this.listeners.get('*') || [];
    for (const callback of wildcardCallbacks) {
      try {
        await callback(output);
      } catch (error) {
        logger.error('Wildcard callback failed', {
          agentId: output.agentId,
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
      // Generate SDUI update from agent output
      const sduiUpdate = await agentSDUIAdapter.processAgentOutput(
        output.agentId,
        output,
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
        // TODO: Integrate with ComponentMutationService
        logger.info('Generated atomic actions', {
          workspaceId: output.workspaceId,
          actionCount: sduiUpdate.actions.length,
        });
      }
    } catch (error) {
      logger.error('Failed to process agent output for SDUI', {
        agentId: output.agentId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Remove callback
   */
  removeCallback(agentId: string, callback: AgentOutputCallback): void {
    const callbacks = this.listeners.get(agentId);
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
    this.listeners.clear();
    logger.info('Cleared all agent output callbacks');
  }
}

// Singleton instance
export const agentOutputListener = new AgentOutputListener();

// Register default SDUI update handler
agentOutputListener.onAnyAgentOutput(async (output) => {
  logger.debug('Default SDUI handler processing agent output', {
    agentId: output.agentId,
    agentType: output.agentType,
  });
});
