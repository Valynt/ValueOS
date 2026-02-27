/**
 * Dead-Letter Queue for Failed Agent Tasks
 *
 * Routes failed agent tasks (after circuit breaker exhaustion) to a Redis list
 * for manual inspection and retry. Emits `system.dlq.enqueued` domain events.
 */
import { z } from 'zod';
// ============================================================================
// Zod Schemas
// ============================================================================
export const DLQEntrySchema = z.object({
    taskId: z.string(),
    agentType: z.string(),
    input: z.unknown(),
    error: z.string(),
    timestamp: z.string(),
    correlationId: z.string(),
    tenantId: z.string(),
    retryCount: z.number().int().min(0),
});
// ============================================================================
// Constants
// ============================================================================
const DLQ_KEY = 'dlq:agent_tasks';
// ============================================================================
// DeadLetterQueue
// ============================================================================
export class DeadLetterQueue {
    store;
    eventEmitter;
    constructor(store, eventEmitter) {
        this.store = store;
        this.eventEmitter = eventEmitter;
    }
    /**
     * Enqueue a failed task to the DLQ
     */
    async enqueue(entry) {
        const validated = DLQEntrySchema.parse(entry);
        const serialized = JSON.stringify(validated);
        await this.store.lpush(DLQ_KEY, serialized);
        this.eventEmitter.emit({
            type: 'system.dlq.enqueued',
            payload: {
                taskId: validated.taskId,
                agentType: validated.agentType,
                error: validated.error,
                tenantId: validated.tenantId,
                retryCount: validated.retryCount,
            },
            meta: {
                correlationId: validated.correlationId,
                timestamp: validated.timestamp,
                source: 'DeadLetterQueue',
            },
        });
    }
    /**
     * List DLQ entries with pagination
     */
    async list(offset = 0, limit = 50) {
        const raw = await this.store.lrange(DLQ_KEY, offset, offset + limit - 1);
        return raw.map((item) => JSON.parse(item));
    }
    /**
     * Get the total number of entries in the DLQ
     */
    async count() {
        return this.store.llen(DLQ_KEY);
    }
    /**
     * Inspect a specific entry by index
     */
    async inspect(index) {
        const raw = await this.store.lrange(DLQ_KEY, index, index);
        if (raw.length === 0)
            return null;
        return JSON.parse(raw[0]);
    }
    /**
     * Remove a specific entry from the DLQ (after successful retry or manual resolution)
     */
    async remove(entry) {
        const serialized = JSON.stringify(entry);
        const removed = await this.store.lrem(DLQ_KEY, 1, serialized);
        return removed > 0;
    }
    /**
     * Get the Redis key used for the DLQ
     */
    static getKey() {
        return DLQ_KEY;
    }
}
//# sourceMappingURL=DeadLetterQueue.js.map