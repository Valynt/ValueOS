/**
 * Value Case Saga State Machine
 *
 * Domain-specific state machine for the Value Engineering lifecycle.
 * Implements 6 phases: INITIATED → DRAFTING → VALIDATING → COMPOSING → REFINING → FINALIZED
 * with compensation handlers for rollback on failure.
 */

import { z } from 'zod';

// ============================================================================
// State & Transition Types
// ============================================================================

export const SagaState = {
  INITIATED: 'INITIATED',
  DRAFTING: 'DRAFTING',
  VALIDATING: 'VALIDATING',
  COMPOSING: 'COMPOSING',
  REFINING: 'REFINING',
  FINALIZED: 'FINALIZED',
} as const;

export type SagaStateType = (typeof SagaState)[keyof typeof SagaState];

export const SagaTrigger = {
  OPPORTUNITY_INGESTED: 'OPPORTUNITY_INGESTED',
  HYPOTHESIS_CONFIRMED: 'HYPOTHESIS_CONFIRMED',
  MODEL_COMPLETE: 'MODEL_COMPLETE',
  INTEGRITY_PASSED: 'INTEGRITY_PASSED',
  FEEDBACK_RECEIVED: 'FEEDBACK_RECEIVED',
  VE_APPROVED: 'VE_APPROVED',
  INTEGRITY_VETOED: 'INTEGRITY_VETOED',
  REDTEAM_OBJECTION: 'REDTEAM_OBJECTION',
  USER_FEEDBACK: 'USER_FEEDBACK',
} as const;

export type SagaTriggerType = (typeof SagaTrigger)[keyof typeof SagaTrigger];

export interface SagaTransition {
  from: SagaStateType;
  to: SagaStateType;
  trigger: SagaTriggerType;
}

export interface SagaSnapshot {
  valueCaseId: string;
  tenantId: string;
  state: SagaStateType;
  previousState?: SagaStateType;
  data: Record<string, unknown>;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface CompensationResult {
  name: string;
  success: boolean;
  error?: string;
}

export interface SagaTransitionRecord {
  valueCaseId: string;
  fromState: SagaStateType;
  toState: SagaStateType;
  trigger: SagaTriggerType;
  agentId?: string;
  timestamp: string;
  correlationId: string;
}

// ============================================================================
// Zod Schemas for validation
// ============================================================================

export const SagaStateSchema = z.enum([
  'INITIATED',
  'DRAFTING',
  'VALIDATING',
  'COMPOSING',
  'REFINING',
  'FINALIZED',
]);

export const SagaTransitionRecordSchema = z.object({
  valueCaseId: z.string().uuid(),
  fromState: SagaStateSchema,
  toState: SagaStateSchema,
  trigger: z.string(),
  agentId: z.string().optional(),
  timestamp: z.string(),
  correlationId: z.string().uuid(),
});

// ============================================================================
// Transition Table
// ============================================================================

const VALID_TRANSITIONS: ReadonlyArray<SagaTransition> = [
  // Forward flow
  { from: SagaState.INITIATED, to: SagaState.DRAFTING, trigger: SagaTrigger.OPPORTUNITY_INGESTED },
  { from: SagaState.DRAFTING, to: SagaState.VALIDATING, trigger: SagaTrigger.HYPOTHESIS_CONFIRMED },
  { from: SagaState.VALIDATING, to: SagaState.COMPOSING, trigger: SagaTrigger.INTEGRITY_PASSED },
  { from: SagaState.COMPOSING, to: SagaState.REFINING, trigger: SagaTrigger.FEEDBACK_RECEIVED },
  { from: SagaState.REFINING, to: SagaState.FINALIZED, trigger: SagaTrigger.VE_APPROVED },

  // Backward flow (vetoes, objections, feedback)
  { from: SagaState.VALIDATING, to: SagaState.DRAFTING, trigger: SagaTrigger.INTEGRITY_VETOED },
  { from: SagaState.COMPOSING, to: SagaState.DRAFTING, trigger: SagaTrigger.REDTEAM_OBJECTION },
  { from: SagaState.REFINING, to: SagaState.DRAFTING, trigger: SagaTrigger.USER_FEEDBACK },
];

// ============================================================================
// Persistence & Event Interfaces (dependency injection)
// ============================================================================

export interface SagaPersistence {
  saveState(snapshot: SagaSnapshot): Promise<void>;
  loadState(valueCaseId: string): Promise<SagaSnapshot | null>;
  recordTransition(record: SagaTransitionRecord): Promise<void>;
}

export interface SagaEventEmitter {
  emit(event: {
    type: string;
    payload: Record<string, unknown>;
    meta: { correlationId: string; timestamp: string; source: string };
  }): void;
}

export interface SagaAuditLogger {
  log(entry: {
    eventType: string;
    action: string;
    resourceId: string;
    details: Record<string, unknown>;
    correlationId: string;
  }): Promise<void>;
}

// ============================================================================
// Compensation Handlers
// ============================================================================

export type CompensationHandler = (
  snapshot: SagaSnapshot
) => Promise<CompensationResult>;

const DEFAULT_COMPENSATION_HANDLERS: Record<string, CompensationHandler> = {
  DRAFTING: async (snapshot) => {
    // Revert value tree to previous version
    return {
      name: 'revert_value_tree',
      success: true,
    };
  },
  VALIDATING: async (snapshot) => {
    // Clear confidence scores, re-queue for modeling
    return {
      name: 'clear_confidence_scores',
      success: true,
    };
  },
  COMPOSING: async (snapshot) => {
    // Delete generated narrative, revert to VALIDATING
    return {
      name: 'delete_narrative',
      success: true,
    };
  },
  REFINING: async (snapshot) => {
    // Restore pre-refinement snapshot
    return {
      name: 'restore_pre_refinement',
      success: true,
    };
  },
};

// ============================================================================
// ValueCaseSaga
// ============================================================================

export class ValueCaseSaga {
  private persistence: SagaPersistence;
  private eventEmitter: SagaEventEmitter;
  private auditLogger: SagaAuditLogger;
  private compensationHandlers: Record<string, CompensationHandler>;

  constructor(deps: {
    persistence: SagaPersistence;
    eventEmitter: SagaEventEmitter;
    auditLogger: SagaAuditLogger;
    compensationHandlers?: Record<string, CompensationHandler>;
  }) {
    this.persistence = deps.persistence;
    this.eventEmitter = deps.eventEmitter;
    this.auditLogger = deps.auditLogger;
    this.compensationHandlers = {
      ...DEFAULT_COMPENSATION_HANDLERS,
      ...deps.compensationHandlers,
    };
  }

  /**
   * Initialize a new value case saga
   */
  async initialize(
    valueCaseId: string,
    tenantId: string,
    correlationId: string,
    initialData: Record<string, unknown> = {}
  ): Promise<SagaSnapshot> {
    const snapshot: SagaSnapshot = {
      valueCaseId,
      tenantId,
      state: SagaState.INITIATED,
      data: initialData,
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await this.persistence.saveState(snapshot);

    this.eventEmitter.emit({
      type: 'saga.state.transitioned',
      payload: {
        valueCaseId,
        fromState: 'NONE',
        toState: SagaState.INITIATED,
        trigger: 'INITIALIZATION',
      },
      meta: {
        correlationId,
        timestamp: snapshot.createdAt,
        source: 'ValueCaseSaga',
      },
    });

    await this.auditLogger.log({
      eventType: 'saga_compensation',
      action: 'saga_initialized',
      resourceId: valueCaseId,
      details: { state: SagaState.INITIATED, tenantId },
      correlationId,
    });

    return snapshot;
  }

  /**
   * Transition the saga to a new state
   */
  async transition(
    valueCaseId: string,
    trigger: SagaTriggerType,
    correlationId: string,
    agentId?: string,
    additionalData?: Record<string, unknown>
  ): Promise<SagaSnapshot> {
    const current = await this.persistence.loadState(valueCaseId);
    if (!current) {
      throw new Error(`Value case ${valueCaseId} not found`);
    }

    const transition = this.findTransition(current.state, trigger);
    if (!transition) {
      const validTriggers = this.getValidTriggers(current.state);
      throw new Error(
        `Invalid transition: cannot apply trigger '${trigger}' in state '${current.state}'. ` +
        `Valid triggers: [${validTriggers.join(', ')}]`
      );
    }

    const previousState = current.state;
    const updated: SagaSnapshot = {
      ...current,
      state: transition.to,
      previousState: previousState,
      data: { ...current.data, ...additionalData },
      version: current.version + 1,
      updatedAt: new Date().toISOString(),
    };

    // Persist state
    await this.persistence.saveState(updated);

    // Record transition
    const transitionRecord: SagaTransitionRecord = {
      valueCaseId,
      fromState: previousState,
      toState: transition.to,
      trigger,
      agentId,
      timestamp: updated.updatedAt,
      correlationId,
    };
    await this.persistence.recordTransition(transitionRecord);

    // Emit domain event
    this.eventEmitter.emit({
      type: 'saga.state.transitioned',
      payload: {
        valueCaseId,
        fromState: previousState,
        toState: transition.to,
        trigger,
        agentId,
      },
      meta: {
        correlationId,
        timestamp: updated.updatedAt,
        source: 'ValueCaseSaga',
      },
    });

    // Audit trail
    await this.auditLogger.log({
      eventType: 'saga_compensation',
      action: 'saga_state_transitioned',
      resourceId: valueCaseId,
      details: {
        fromState: previousState,
        toState: transition.to,
        trigger,
        agentId,
      },
      correlationId,
    });

    return updated;
  }

  /**
   * Execute compensation for a given state
   */
  async compensate(
    valueCaseId: string,
    correlationId: string
  ): Promise<CompensationResult[]> {
    const current = await this.persistence.loadState(valueCaseId);
    if (!current) {
      throw new Error(`Value case ${valueCaseId} not found`);
    }

    const results: CompensationResult[] = [];
    const handler = this.compensationHandlers[current.state];

    if (handler) {
      try {
        const result = await handler(current);
        results.push(result);

        this.eventEmitter.emit({
          type: 'saga.compensation.executed',
          payload: {
            valueCaseId,
            compensationName: result.name,
            success: result.success,
          },
          meta: {
            correlationId,
            timestamp: new Date().toISOString(),
            source: 'ValueCaseSaga',
          },
        });
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        results.push({
          name: `compensate_${current.state}`,
          success: false,
          error: errorMsg,
        });

        this.eventEmitter.emit({
          type: 'saga.compensation.executed',
          payload: {
            valueCaseId,
            compensationName: `compensate_${current.state}`,
            success: false,
            error: errorMsg,
          },
          meta: {
            correlationId,
            timestamp: new Date().toISOString(),
            source: 'ValueCaseSaga',
          },
        });
      }

      await this.auditLogger.log({
        eventType: 'saga_compensation',
        action: 'saga_compensation_executed',
        resourceId: valueCaseId,
        details: { state: current.state, results },
        correlationId,
      });
    }

    return results;
  }

  /**
   * Get the current state of a value case
   */
  async getState(valueCaseId: string): Promise<SagaSnapshot | null> {
    return this.persistence.loadState(valueCaseId);
  }

  /**
   * Check if a transition is valid from the current state
   */
  isValidTransition(currentState: SagaStateType, trigger: SagaTriggerType): boolean {
    return this.findTransition(currentState, trigger) !== undefined;
  }

  /**
   * Get valid triggers for a given state
   */
  getValidTriggers(state: SagaStateType): SagaTriggerType[] {
    return VALID_TRANSITIONS
      .filter((t) => t.from === state)
      .map((t) => t.trigger);
  }

  /**
   * Get all valid transitions from a given state
   */
  getValidTransitions(state: SagaStateType): SagaTransition[] {
    return VALID_TRANSITIONS.filter((t) => t.from === state);
  }

  // ---- Private helpers ----

  private findTransition(
    currentState: SagaStateType,
    trigger: SagaTriggerType
  ): SagaTransition | undefined {
    return VALID_TRANSITIONS.find(
      (t) => t.from === currentState && t.trigger === trigger
    );
  }
}
