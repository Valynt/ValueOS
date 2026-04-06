/**
 * Dead-Letter Queue for Failed Agent Tasks
 *
 * Routes failed agent tasks (after circuit breaker exhaustion) to a Redis list
 * for manual inspection and retry. Emits `system.dlq.enqueued` domain events.
 */

import { z } from "zod";

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

const DLQ_KEY_PREFIX = "dlq:agent_tasks";

/** Build a tenant-scoped DLQ key. */
function dlqKey(tenantId: string): string {
  if (!tenantId) throw new Error("DeadLetterQueue: tenantId is required");
  return `${DLQ_KEY_PREFIX}:${tenantId}`;
}

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
   * Enqueue a failed task to the DLQ (tenant-scoped).
   */
  async enqueue(entry: DLQEntry): Promise<void> {
    const validated = DLQEntrySchema.parse(entry);
    const serialized = JSON.stringify(validated);

    await this.store.lpush(dlqKey(validated.tenantId), serialized);

    this.eventEmitter.emit({
      type: "system.dlq.enqueued",
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
        source: "DeadLetterQueue",
      },
    });
  }

  /**
   * List DLQ entries with pagination (tenant-scoped).
   */
  async list(
    tenantId: string,
    offset: number = 0,
    limit: number = 50
  ): Promise<DLQEntry[]> {
    const raw = await this.store.lrange(
      dlqKey(tenantId),
      offset,
      offset + limit - 1
    );
    return raw.map(item => JSON.parse(item) as DLQEntry);
  }

  /**
   * Get the total number of entries in the DLQ for a tenant.
   */
  async count(tenantId: string): Promise<number> {
    return this.store.llen(dlqKey(tenantId));
  }

  /**
   * Inspect a specific entry by index (tenant-scoped).
   */
  async inspect(tenantId: string, index: number): Promise<DLQEntry | null> {
    const raw = await this.store.lrange(dlqKey(tenantId), index, index);
    if (raw.length === 0) return null;
    return JSON.parse(raw[0]!) as DLQEntry;
  }

  /**
   * Remove a specific entry from the DLQ (after successful retry or manual resolution).
   */
  async remove(entry: DLQEntry): Promise<boolean> {
    const serialized = JSON.stringify(entry);
    const removed = await this.store.lrem(
      dlqKey(entry.tenantId),
      1,
      serialized
    );
    return removed > 0;
  }

  /**
   * Get the Redis key used for a tenant's DLQ.
   */
  static getKey(tenantId: string): string {
    return dlqKey(tenantId);
  }
}
