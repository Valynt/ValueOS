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

export class ValueLifecycleOrchestrator {
  private circuitBreaker: CircuitBreaker;
  private compensations: Map<string, (() => Promise<void>)[]> = new Map();
  private supabase: ReturnType<typeof createClient>;

  constructor(supabaseClient: ReturnType<typeof createClient>) {
    this.circuitBreaker = new CircuitBreaker(5, 60000);
    this.supabase = supabaseClient;
  }

  async executeLifecycleStage(
    stage: LifecycleStage,
    input: StageInput,
    context: LifecycleContext
  ): Promise<StageResult> {
    const sagaId = `saga-${Date.now()}-${stage}`;
    this.compensations.set(sagaId, []);

    try {
      // Step 1: Validate prerequisites
      await this.validatePrerequisites(stage, input, context);

      // Step 2: Execute stage-specific agent
      const agent = this.getAgentForStage(stage);
      const result = await this.circuitBreaker.execute(async () => {
        return await agent.invoke(input);
      });

      // Step 3: Persist results with compensation
      const persistedData = await this.persistStageResults(
        stage,
        result,
        context
      );
      this.compensations.get(sagaId)!.push(() =>
        this.deleteStageResults(persistedData.id)
      );

      // Step 4: Update value tree
      if (stage === 'target' || stage === 'expansion') {
        await this.updateValueTree(persistedData, context);
        this.compensations.get(sagaId)!.push(() =>
          this.revertValueTree(persistedData.valueTreeId)
        );
      }

      // Step 5: Trigger next stage if applicable
      if (this.hasNextStage(stage)) {
        await this.scheduleNextStage(stage, persistedData, context);
      }

      return {
        success: true,
        data: persistedData,
        confidence: result.confidence_level,
        assumptions: result.assumptions
      };

    } catch (error) {
      // Execute compensating transactions in reverse
      const compensations = this.compensations.get(sagaId) || [];
      for (const compensate of compensations.reverse()) {
        await compensate().catch(e =>
          logger.error('Compensation failed', { sagaId, error: e })
        );
      }

      throw new LifecycleError(
        stage,
        `Stage execution failed: ${error.message}`,
        error
      );

    } finally {
      this.compensations.delete(sagaId);
    }
  }

  private getAgentForStage(stage: LifecycleStage): BaseAgent {
    const agents: Record<LifecycleStage, BaseAgent> = {
      opportunity: new OpportunityAgent(this.supabase),
      target: new TargetAgent(this.supabase),
      expansion: new ExpansionAgent(this.supabase),
      integrity: new IntegrityAgent(this.supabase),
      realization: new RealizationAgent(this.supabase)
    };

    return agents[stage];
  }

  private async validatePrerequisites(
    stage: LifecycleStage,
    input: StageInput,
    context: LifecycleContext
  ): Promise<void> {
    const prerequisites: Record<LifecycleStage, string[]> = {
      opportunity: [],
      target: ['opportunity_id'],
      expansion: ['value_tree_id'],
      integrity: ['roi_model_id'],
      realization: ['value_commit_id']
    };

    const required = prerequisites[stage];
    const missing = required.filter(field => !input[field]);

    if (missing.length > 0) {
      throw new ValidationError(
        `Missing prerequisites for ${stage}: ${missing.join(', ')}`
      );
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
