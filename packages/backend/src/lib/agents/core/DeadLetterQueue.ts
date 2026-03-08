/**
 * Dead-Letter Queue for Failed Agent Tasks
 *
 * Routes failed agent tasks (after circuit breaker exhaustion) to a Redis list
 * for manual inspection and retry. Emits `system.dlq.enqueued` domain events.
 */

import { z } from 'zod';

// ============================================================================
// Types
// ============================================================================

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
    meta: { correlationId: string; timestamp: string; source: string };
  }): void;
}

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
  private store: DLQStore;
  private eventEmitter: DLQEventEmitter;

  constructor(store: DLQStore, eventEmitter: DLQEventEmitter) {
    this.store = store;
    this.eventEmitter = eventEmitter;
  }

  /**
   * Enqueue a failed task to the DLQ
   */
  async enqueue(entry: DLQEntry): Promise<void> {
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
  async list(offset: number = 0, limit: number = 50): Promise<DLQEntry[]> {
    const raw = await this.store.lrange(DLQ_KEY, offset, offset + limit - 1);
    return raw.map((item) => JSON.parse(item) as DLQEntry);
  }

  /**
   * Get the total number of entries in the DLQ
   */
  async count(): Promise<number> {
    return this.store.llen(DLQ_KEY);
  }

  /**
   * Inspect a specific entry by index
   */
  async inspect(index: number): Promise<DLQEntry | null> {
    const raw = await this.store.lrange(DLQ_KEY, index, index);
    if (raw.length === 0) return null;
    return JSON.parse(raw[0]!) as DLQEntry;
  }

  /**
   * Remove a specific entry from the DLQ (after successful retry or manual resolution)
   */
  async remove(entry: DLQEntry): Promise<boolean> {
    const serialized = JSON.stringify(entry);
    const removed = await this.store.lrem(DLQ_KEY, 1, serialized);
    return removed > 0;
  }

  /**
   * Get the Redis key used for the DLQ
   */
  static getKey(): string {
    return DLQ_KEY;
  }
}
