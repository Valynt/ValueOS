/**
 * Value Case Saga State Machine
 *
 * Domain-specific state machine for the Value Engineering lifecycle.
 * Implements 6 phases: INITIATED → DRAFTING → VALIDATING → COMPOSING → REFINING → FINALIZED
 * with compensation handlers for rollback on failure.
 */
import { z } from 'zod';
export declare const SagaState: {
    readonly INITIATED: "INITIATED";
    readonly DRAFTING: "DRAFTING";
    readonly VALIDATING: "VALIDATING";
    readonly COMPOSING: "COMPOSING";
    readonly REFINING: "REFINING";
    readonly FINALIZED: "FINALIZED";
};
export type SagaStateType = (typeof SagaState)[keyof typeof SagaState];
export declare const SagaTrigger: {
    readonly OPPORTUNITY_INGESTED: "OPPORTUNITY_INGESTED";
    readonly HYPOTHESIS_CONFIRMED: "HYPOTHESIS_CONFIRMED";
    readonly MODEL_COMPLETE: "MODEL_COMPLETE";
    readonly INTEGRITY_PASSED: "INTEGRITY_PASSED";
    readonly FEEDBACK_RECEIVED: "FEEDBACK_RECEIVED";
    readonly VE_APPROVED: "VE_APPROVED";
    readonly INTEGRITY_VETOED: "INTEGRITY_VETOED";
    readonly REDTEAM_OBJECTION: "REDTEAM_OBJECTION";
    readonly USER_FEEDBACK: "USER_FEEDBACK";
};
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
export declare const SagaStateSchema: z.ZodEnum<["INITIATED", "DRAFTING", "VALIDATING", "COMPOSING", "REFINING", "FINALIZED"]>;
export declare const SagaTransitionRecordSchema: z.ZodObject<{
    valueCaseId: z.ZodString;
    fromState: z.ZodEnum<["INITIATED", "DRAFTING", "VALIDATING", "COMPOSING", "REFINING", "FINALIZED"]>;
    toState: z.ZodEnum<["INITIATED", "DRAFTING", "VALIDATING", "COMPOSING", "REFINING", "FINALIZED"]>;
    trigger: z.ZodString;
    agentId: z.ZodOptional<z.ZodString>;
    timestamp: z.ZodString;
    correlationId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    timestamp: string;
    correlationId: string;
    valueCaseId: string;
    fromState: "INITIATED" | "DRAFTING" | "VALIDATING" | "COMPOSING" | "REFINING" | "FINALIZED";
    toState: "INITIATED" | "DRAFTING" | "VALIDATING" | "COMPOSING" | "REFINING" | "FINALIZED";
    trigger: string;
    agentId?: string | undefined;
}, {
    timestamp: string;
    correlationId: string;
    valueCaseId: string;
    fromState: "INITIATED" | "DRAFTING" | "VALIDATING" | "COMPOSING" | "REFINING" | "FINALIZED";
    toState: "INITIATED" | "DRAFTING" | "VALIDATING" | "COMPOSING" | "REFINING" | "FINALIZED";
    trigger: string;
    agentId?: string | undefined;
}>;
export interface SagaPersistence {
    saveState(_snapshot: SagaSnapshot): Promise<void>;
    loadState(_valueCaseId: string): Promise<SagaSnapshot | null>;
    recordTransition(_record: SagaTransitionRecord): Promise<void>;
}
export interface SagaEventEmitter {
    emit(_event: {
        type: string;
        payload: Record<string, unknown>;
        meta: {
            correlationId: string;
            timestamp: string;
            source: string;
        };
    }): void;
}
export interface SagaAuditLogger {
    log(_entry: {
        eventType: string;
        action: string;
        resourceId: string;
        details: Record<string, unknown>;
        correlationId: string;
    }): Promise<void>;
}
export type CompensationHandler = (_snapshot: SagaSnapshot) => Promise<CompensationResult>;
export declare class ValueCaseSaga {
    private persistence;
    private eventEmitter;
    private auditLogger;
    private compensationHandlers;
    constructor(deps: {
        persistence: SagaPersistence;
        eventEmitter: SagaEventEmitter;
        auditLogger: SagaAuditLogger;
        compensationHandlers?: Record<string, CompensationHandler>;
    });
    /**
     * Initialize a new value case saga
     */
    initialize(valueCaseId: string, tenantId: string, correlationId: string, initialData?: Record<string, unknown>): Promise<SagaSnapshot>;
    /**
     * Transition the saga to a new state
     */
    transition(valueCaseId: string, trigger: SagaTriggerType, correlationId: string, agentId?: string, additionalData?: Record<string, unknown>): Promise<SagaSnapshot>;
    /**
     * Execute compensation for a given state
     */
    compensate(valueCaseId: string, correlationId: string): Promise<CompensationResult[]>;
    /**
     * Get the current state of a value case
     */
    getState(valueCaseId: string): Promise<SagaSnapshot | null>;
    /**
     * Check if a transition is valid from the current state
     */
    isValidTransition(currentState: SagaStateType, trigger: SagaTriggerType): boolean;
    /**
     * Get valid triggers for a given state
     */
    getValidTriggers(state: SagaStateType): SagaTriggerType[];
    /**
     * Get all valid transitions from a given state
     */
    getValidTransitions(state: SagaStateType): SagaTransition[];
    private findTransition;
}
//# sourceMappingURL=ValueCaseSaga.d.ts.map