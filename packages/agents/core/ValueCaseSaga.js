"use strict";
/**
 * Value Case Saga State Machine
 *
 * Domain-specific state machine for the Value Engineering lifecycle.
 * Implements 6 phases: INITIATED → DRAFTING → VALIDATING → COMPOSING → REFINING → FINALIZED
 * with compensation handlers for rollback on failure.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ValueCaseSaga = exports.SagaTransitionRecordSchema = exports.SagaStateSchema = exports.SagaTrigger = exports.SagaState = void 0;
const zod_1 = require("zod");
// ============================================================================
// State & Transition Types
// ============================================================================
exports.SagaState = {
    INITIATED: 'INITIATED',
    DRAFTING: 'DRAFTING',
    VALIDATING: 'VALIDATING',
    COMPOSING: 'COMPOSING',
    REFINING: 'REFINING',
    FINALIZED: 'FINALIZED',
};
exports.SagaTrigger = {
    OPPORTUNITY_INGESTED: 'OPPORTUNITY_INGESTED',
    HYPOTHESIS_CONFIRMED: 'HYPOTHESIS_CONFIRMED',
    MODEL_COMPLETE: 'MODEL_COMPLETE',
    INTEGRITY_PASSED: 'INTEGRITY_PASSED',
    FEEDBACK_RECEIVED: 'FEEDBACK_RECEIVED',
    VE_APPROVED: 'VE_APPROVED',
    INTEGRITY_VETOED: 'INTEGRITY_VETOED',
    REDTEAM_OBJECTION: 'REDTEAM_OBJECTION',
    USER_FEEDBACK: 'USER_FEEDBACK',
};
// ============================================================================
// Zod Schemas for validation
// ============================================================================
exports.SagaStateSchema = zod_1.z.enum([
    'INITIATED',
    'DRAFTING',
    'VALIDATING',
    'COMPOSING',
    'REFINING',
    'FINALIZED',
]);
exports.SagaTransitionRecordSchema = zod_1.z.object({
    valueCaseId: zod_1.z.string().uuid(),
    fromState: exports.SagaStateSchema,
    toState: exports.SagaStateSchema,
    trigger: zod_1.z.string(),
    agentId: zod_1.z.string().optional(),
    timestamp: zod_1.z.string(),
    correlationId: zod_1.z.string().uuid(),
});
// ============================================================================
// Transition Table
// ============================================================================
const VALID_TRANSITIONS = [
    // Forward flow
    { from: exports.SagaState.INITIATED, to: exports.SagaState.DRAFTING, trigger: exports.SagaTrigger.OPPORTUNITY_INGESTED },
    { from: exports.SagaState.DRAFTING, to: exports.SagaState.VALIDATING, trigger: exports.SagaTrigger.HYPOTHESIS_CONFIRMED },
    { from: exports.SagaState.VALIDATING, to: exports.SagaState.COMPOSING, trigger: exports.SagaTrigger.INTEGRITY_PASSED },
    { from: exports.SagaState.COMPOSING, to: exports.SagaState.REFINING, trigger: exports.SagaTrigger.FEEDBACK_RECEIVED },
    { from: exports.SagaState.REFINING, to: exports.SagaState.FINALIZED, trigger: exports.SagaTrigger.VE_APPROVED },
    // Backward flow (vetoes, objections, feedback)
    { from: exports.SagaState.VALIDATING, to: exports.SagaState.DRAFTING, trigger: exports.SagaTrigger.INTEGRITY_VETOED },
    { from: exports.SagaState.COMPOSING, to: exports.SagaState.DRAFTING, trigger: exports.SagaTrigger.REDTEAM_OBJECTION },
    { from: exports.SagaState.REFINING, to: exports.SagaState.DRAFTING, trigger: exports.SagaTrigger.USER_FEEDBACK },
];
const DEFAULT_COMPENSATION_HANDLERS = {
    DRAFTING: async (_snapshot) => {
        // Revert value tree to previous version
        return {
            name: 'revert_value_tree',
            success: true,
        };
    },
    VALIDATING: async (_snapshot) => {
        // Clear confidence scores, re-queue for modeling
        return {
            name: 'clear_confidence_scores',
            success: true,
        };
    },
    COMPOSING: async (_snapshot) => {
        // Delete generated narrative, revert to VALIDATING
        return {
            name: 'delete_narrative',
            success: true,
        };
    },
    REFINING: async (_snapshot) => {
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
class ValueCaseSaga {
    persistence;
    eventEmitter;
    auditLogger;
    compensationHandlers;
    constructor(deps) {
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
    async initialize(valueCaseId, tenantId, correlationId, initialData = {}) {
        const snapshot = {
            valueCaseId,
            tenantId,
            state: exports.SagaState.INITIATED,
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
                toState: exports.SagaState.INITIATED,
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
            details: { state: exports.SagaState.INITIATED, tenantId },
            correlationId,
        });
        return snapshot;
    }
    /**
     * Transition the saga to a new state
     */
    async transition(valueCaseId, trigger, correlationId, agentId, additionalData) {
        const current = await this.persistence.loadState(valueCaseId);
        if (!current) {
            throw new Error(`Value case ${valueCaseId} not found`);
        }
        const transition = this.findTransition(current.state, trigger);
        if (!transition) {
            const validTriggers = this.getValidTriggers(current.state);
            throw new Error(`Invalid transition: cannot apply trigger '${trigger}' in state '${current.state}'. ` +
                `Valid triggers: [${validTriggers.join(', ')}]`);
        }
        const previousState = current.state;
        const updated = {
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
        const transitionRecord = {
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
    async compensate(valueCaseId, correlationId) {
        const current = await this.persistence.loadState(valueCaseId);
        if (!current) {
            throw new Error(`Value case ${valueCaseId} not found`);
        }
        const results = [];
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
            }
            catch (err) {
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
    async getState(valueCaseId) {
        return this.persistence.loadState(valueCaseId);
    }
    /**
     * Check if a transition is valid from the current state
     */
    isValidTransition(currentState, trigger) {
        return this.findTransition(currentState, trigger) !== undefined;
    }
    /**
     * Get valid triggers for a given state
     */
    getValidTriggers(state) {
        return VALID_TRANSITIONS
            .filter((t) => t.from === state)
            .map((t) => t.trigger);
    }
    /**
     * Get all valid transitions from a given state
     */
    getValidTransitions(state) {
        return VALID_TRANSITIONS.filter((t) => t.from === state);
    }
    // ---- Private helpers ----
    findTransition(currentState, trigger) {
        return VALID_TRANSITIONS.find((t) => t.from === currentState && t.trigger === trigger);
    }
}
exports.ValueCaseSaga = ValueCaseSaga;
//# sourceMappingURL=ValueCaseSaga.js.map