/**
 * Dead-Letter Queue for Failed Agent Tasks
 *
 * Routes failed agent tasks (after circuit breaker exhaustion) to a Redis list
 * for manual inspection and retry. Emits `system.dlq.enqueued` domain events.
 */
import { z } from 'zod';
export interface DLQEntry {
    taskId: string;
    agentType: string;
    input: unknown;
    error: string;
    timestamp: string;
    correlationId: string;
    tenantId: string;
    retryCount: number;
}
export interface DLQStore {
    lpush(key: string, value: string): Promise<void>;
    lrange(key: string, start: number, stop: number): Promise<string[]>;
    llen(key: string): Promise<number>;
    lrem(key: string, count: number, value: string): Promise<number>;
}
export interface DLQEventEmitter {
    emit(event: {
        type: string;
        payload: Record<string, unknown>;
        meta: {
            correlationId: string;
            timestamp: string;
            source: string;
        };
    }): void;
}
export declare const DLQEntrySchema: z.ZodObject<{
    taskId: z.ZodString;
    agentType: z.ZodString;
    input: z.ZodUnknown;
    error: z.ZodString;
    timestamp: z.ZodString;
    correlationId: z.ZodString;
    tenantId: z.ZodString;
    retryCount: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    error: string;
    timestamp: string;
    tenantId: string;
    correlationId: string;
    agentType: string;
    taskId: string;
    retryCount: number;
    input?: unknown;
}, {
    error: string;
    timestamp: string;
    tenantId: string;
    correlationId: string;
    agentType: string;
    taskId: string;
    retryCount: number;
    input?: unknown;
}>;
export declare class DeadLetterQueue {
    private store;
    private eventEmitter;
    constructor(store: DLQStore, eventEmitter: DLQEventEmitter);
    /**
     * Enqueue a failed task to the DLQ
     */
    enqueue(entry: DLQEntry): Promise<void>;
    /**
     * List DLQ entries with pagination
     */
    list(offset?: number, limit?: number): Promise<DLQEntry[]>;
    /**
     * Get the total number of entries in the DLQ
     */
    count(): Promise<number>;
    /**
     * Inspect a specific entry by index
     */
    inspect(index: number): Promise<DLQEntry | null>;
    /**
     * Remove a specific entry from the DLQ (after successful retry or manual resolution)
     */
    remove(entry: DLQEntry): Promise<boolean>;
    /**
     * Get the Redis key used for the DLQ
     */
    static getKey(): string;
}
//# sourceMappingURL=DeadLetterQueue.d.ts.map