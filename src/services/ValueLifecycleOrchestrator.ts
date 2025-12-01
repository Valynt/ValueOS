/**
 * Value Lifecycle Orchestrator with Saga Pattern
 * 
 * Coordinates multi-agent workflows across the value lifecycle stages
 * with compensation patterns for failure recovery.
 */

import { OpportunityAgent } from '../lib/agent-fabric/agents/OpportunityAgent';
import { TargetAgent } from '../lib/agent-fabric/agents/TargetAgent';
import { ExpansionAgent } from '../lib/agent-fabric/agents/ExpansionAgent';
import { IntegrityAgent } from '../lib/agent-fabric/agents/IntegrityAgent';
import { RealizationAgent } from '../lib/agent-fabric/agents/RealizationAgent';
import { BaseAgent } from '../lib/agent-fabric/agents/BaseAgent';
import { CircuitBreaker } from '../lib/resilience/CircuitBreaker';
import { logger } from '../lib/logger';
import { createClient } from '@supabase/supabase-js';

export type LifecycleStage = 'opportunity' | 'target' | 'expansion' | 'integrity' | 'realization';

export interface LifecycleContext {
  userId: string;
  organizationId?: string;
  sessionId?: string;
  metadata?: Record<string, any>;
}

export interface StageInput {
  [key: string]: any;
}

export interface StageResult {
  success: boolean;
  data: any;
  confidence?: string;
  assumptions?: any[];
  error?: string;
}

export class LifecycleError extends Error {
  constructor(
    public stage: LifecycleStage,
    message: string,
    public originalError?: Error
  ) {
    super(message);
    this.name = 'LifecycleError';
  }
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

import { LLMGateway } from '../lib/agent-fabric/LLMGateway';
import { MemorySystem } from '../lib/agent-fabric/MemorySystem';
import { AuditLogger } from '../lib/agent-fabric/AuditLogger';
import { AgentConfig, LifecycleContext } from '../types/agent';

// ... (other imports remain the same) ...

export class ValueLifecycleOrchestrator {
  private circuitBreaker: CircuitBreaker;
  private compensations: Map<string, (() => Promise<void>)[]> = new Map();
  private supabase: ReturnType<typeof createClient>;
  private llmGateway: LLMGateway;
  private memorySystem: MemorySystem;
  private auditLogger: AuditLogger;

  constructor(
    supabaseClient: ReturnType<typeof createClient>,
    llmGateway: LLMGateway,
    memorySystem: MemorySystem,
    auditLogger: AuditLogger
    ) {
    this.circuitBreaker = new CircuitBreaker(5, 60000);
    this.supabase = supabaseClient;
    this.llmGateway = llmGateway;
    this.memorySystem = memorySystem;
    this.auditLogger = auditLogger;
  }

  async executeLifecycleStage(
    stage: LifecycleStage,
    input: StageInput,
    context: LifecycleContext
  ): Promise<StageResult> {
    // ... (logic before agent creation remains the same) ...

      // Step 2: Execute stage-specific agent
      const agent = this.getAgentForStage(stage, context);
      const result = await this.circuitBreaker.execute(async () => {
        if (!context.sessionId) {
          throw new Error("Session ID is required to execute an agent.");
        }
        return await agent.execute(context.sessionId, input);
      });

    // ... (rest of the logic remains the same) ...
  }

  private getAgentForStage(stage: LifecycleStage, context: LifecycleContext): BaseAgent {
    const agentConfig: AgentConfig = {
      id: `${stage}-agent`, // Or a more sophisticated ID
      organizationId: context.organizationId,
      userId: context.userId,
      sessionId: context.sessionId,
      supabase: this.supabase,
      llmGateway: this.llmGateway,
      memorySystem: this.memorySystem,
      auditLogger: this.auditLogger,
    };

    const agents: Record<LifecycleStage, new (config: AgentConfig) => BaseAgent> = {
      opportunity: OpportunityAgent,
      target: TargetAgent,
      expansion: ExpansionAgent,
      integrity: IntegrityAgent,
      realization: RealizationAgent
    };

    const AgentClass = agents[stage];
    return new AgentClass(agentConfig);
  }

  // ... (rest of the class remains the same) ...


import { TargetAgentInputSchema } from '../validators/agentInputs';
import { z } from 'zod';

// ... inside ValueLifecycleOrchestrator class

  private async validatePrerequisites(
    stage: LifecycleStage,
    input: StageInput,
    context: LifecycleContext
  ): Promise<void> {
    if (stage === 'target') {
      try {
        TargetAgentInputSchema.parse(input);
      } catch (error) {
        if (error instanceof z.ZodError) {
          throw new ValidationError(`Invalid input for target stage: ${error.errors.map(e => e.message).join(', ')}`);
        }
        throw error;
      }
      return;
    }

    // Fallback to old logic for other stages
    const prerequisites: Record<LifecycleStage, string[]> = {
      opportunity: [],
      target: [], // Handled by Zod now
      expansion: ['value_tree_id'],
      integrity: ['roi_model_id'],
      realization: ['value_commit_id']
    };

    const required = prerequisites[stage];
    if (required) {
        const missing = required.filter(field => !input[field]);
        if (missing.length > 0) {
          throw new ValidationError(
            `Missing prerequisites for ${stage}: ${missing.join(', ')}`
          );
        }
    }
  }

  private async persistStageResults(
    stage: LifecycleStage,
    result: any,
    context: LifecycleContext
  ): Promise<any> {
    const tableName = `${stage}_results`;

    const { data, error } = await this.supabase
      .from(tableName)
      .insert({
        ...result,
        user_id: context.userId,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to persist ${stage} results: ${error.message}`);
    }

    return data;
  }

  private async deleteStageResults(resultId: string): Promise<void> {
    logger.info('Compensating: deleting stage results', { resultId });
    // Implementation would delete the persisted results
  }

  private async updateValueTree(
    persistedData: any,
    context: LifecycleContext
  ): Promise<void> {
    logger.info('Updating value tree', { persistedData, context });
    // Implementation would update the value tree
  }

  private async revertValueTree(valueTreeId: string): Promise<void> {
    logger.info('Compensating: reverting value tree', { valueTreeId });
    // Implementation would revert value tree changes
  }

  private hasNextStage(stage: LifecycleStage): boolean {
    const stageOrder: LifecycleStage[] = [
      'opportunity',
      'target',
      'expansion',
      'integrity',
      'realization'
    ];

    const currentIndex = stageOrder.indexOf(stage);
    return currentIndex < stageOrder.length - 1;
  }

  private async scheduleNextStage(
    currentStage: LifecycleStage,
    persistedData: any,
    context: LifecycleContext
  ): Promise<void> {
    logger.info('Scheduling next stage', { currentStage, persistedData });
    // Implementation would schedule the next stage
  }
}
