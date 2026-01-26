/**
 * Base Agent
 * 
 * Abstract base class for all agents in the agent fabric
 */

import { logger } from '../../logger.js';
import type { AgentConfig, AgentOutput, LifecycleContext } from '../../../types/agent.js';

export abstract class BaseAgent {
  protected config: AgentConfig;

  constructor(config: AgentConfig) {
    this.config = config;
  }

  abstract execute(context: LifecycleContext): Promise<AgentOutput>;

  async validateInput(context: LifecycleContext): Promise<boolean> {
    if (!context.workspace_id || !context.organization_id || !context.user_id) {
      logger.error('Invalid agent input context', {
        agent_id: this.config.id,
        has_workspace: !!context.workspace_id,
        has_org: !!context.organization_id,
        has_user: !!context.user_id,
      });
      return false;
    }
    return true;
  }

  async prepareOutput(result: Record<string, any>, status: string): Promise<AgentOutput> {
    return {
      agent_id: this.config.id,
      agent_type: this.config.type,
      lifecycle_stage: this.config.lifecycle_stage,
      status: status as any,
      result,
      confidence: 'medium',
      metadata: {
        execution_time_ms: 0,
        model_version: this.config.model.model_name,
        timestamp: new Date().toISOString(),
      },
    };
  }

  getCapabilities(): string[] {
    return this.config.capabilities;
  }

  getId(): string {
    return this.config.id;
  }

  getName(): string {
    return this.config.name;
  }
}
