import Redis from "ioredis";

import { createCounter, createHistogram } from "../../lib/observability/index.js";
import { Logger, logger } from "../../utils/logger.js";

import { EventName, EventPayloadMap, validateEventPayload } from "./EventSchemas.js";

export interface RedisStreamBrokerOptions {
  streamName?: string;
  groupName?: string;
  consumerName?: string;
  redisUrl?: string;
  maxDeliveries?: number;
  idempotencyTtlMs?: number;
  readCount?: number;
  batchSize?: number;
  batchConcurrency?: number;
  claimIdleMs?: number;
  claimCount?: number;
  blockMs?: number;
  consumerGroupSize?: number; // NEW: Number of consumers in group
  enableConsumerGroups?: boolean; // NEW: Enable consumer groups
  batchProcessingEnabled?: boolean; // NEW: Enable batch processing
}

export interface StreamEvent<TName extends EventName> {
  id: string;
  name: TName;
  payload: EventPayloadMap[TName];
  attempt: number;
}

export class RedisStreamBroker {
  private readonly streamName: string;
  private readonly groupName: string;
  private readonly consumerName: string;
  private readonly redis: Redis.Redis;
  private readonly dlqStream: string;
  private readonly maxDeliveries: number;
  private readonly idempotencyTtlMs: number;
  private readonly readCount: number;
  private readonly batchSize: number;
  private readonly batchConcurrency: number;
  private readonly claimIdleMs: number;
  private readonly claimCount: number;
  private readonly blockMs: number;
  private readonly consumerGroupSize: number; // NEW
  private readonly enableConsumerGroups: boolean; // NEW
  private readonly batchProcessingEnabled: boolean; // NEW
  private readonly log: Logger;
  private readonly publishCounter = createCounter(
    "broker.events.published",
    "Total events published"
  );
  private readonly consumeCounter = createCounter(
    "broker.events.consumed",
    "Total events consumed"
  );
  private readonly failureCounter = createCounter(
    "broker.events.failed",
    "Total events that failed processing"
  );
  private readonly batchSizeHistogram = createHistogram(
    "broker.batch.size",
    "Number of events processed per broker batch"
  );
  private readonly batchLatencyHistogram = createHistogram(
    "broker.batch.latency_ms",
    "Batch processing latency in milliseconds"
  );
  private readonly pendingClaimHistogram = createHistogram(
    "broker.pending.claimed",
    "Number of pending messages claimed per cycle"
  );
  private readonly processingDuration = createHistogram(
    "broker.event.processing_ms",
    "Processing duration for brokered events"
  );

  constructor(options: RedisStreamBrokerOptions = {}) {
    this.streamName = options.streamName || "valuecanvas.events";
    this.groupName = options.groupName || "valuecanvas-workers";
    this.consumerName = options.consumerName || `consumer-${process.pid}`;
    this.dlqStream = `${this.streamName}:dlq`;
    this.maxDeliveries = options.maxDeliveries ?? 3;
    this.idempotencyTtlMs = options.idempotencyTtlMs ?? 1000 * 60 * 60; // 1 hour
    this.readCount = options.readCount ?? 50;
    this.batchSize = options.batchSize ?? 50;
    this.batchConcurrency = options.batchConcurrency ?? 5;
    this.claimIdleMs = options.claimIdleMs ?? 60000;
    this.claimCount = options.claimCount ?? 50;
    this.blockMs = options.blockMs ?? 2000;
    this.consumerGroupSize = options.consumerGroupSize ?? 3; // NEW: Default 3 consumers
    this.enableConsumerGroups = options.enableConsumerGroups ?? true; // NEW: Enable by default
    this.batchProcessingEnabled = options.batchProcessingEnabled ?? true; // NEW: Enable by default
    this.redis = new Redis(options.redisUrl || process.env.REDIS_URL || "redis://localhost:6379");
    this.log = logger.withContext({ component: "redis-stream-broker" });
  }

  async initialize(): Promise<void> {
    if (!this.enableConsumerGroups) {
      // Legacy single consumer group mode
      try {
        await this.redis.xgroup("CREATE", this.streamName, this.groupName, "$", "MKSTREAM");
        this.log.info("Created single consumer group", {
          stream: this.streamName,
          group: this.groupName,
        });
      } catch (error: unknown) {
        if (error instanceof Error && error.message?.includes("BUSYGROUP")) {
          this.log.debug("Consumer group already exists", {
            stream: this.streamName,
            group: this.groupName,
          });
        } else {
          throw error;
        }
      }
      return;
    }

    // NEW: Create multiple consumer groups for load distribution
    for (let i = 0; i < this.consumerGroupSize; i++) {
      const groupName = `${this.groupName}-${i}`;
      try {
        await this.redis.xgroup("CREATE", this.streamName, groupName, "$", "MKSTREAM");
        this.log.info("Created consumer group", {
          stream: this.streamName,
          group: groupName,
          index: i,
        });
      } catch (error: unknown) {
        if (error instanceof Error && error.message?.includes("BUSYGROUP")) {
          this.log.debug("Consumer group already exists", {
            stream: this.streamName,
            group: groupName,
          });
        } else {
          throw error;
        }
      }
    }
  }

  async publish<TName extends EventName>(
    name: TName,
    payload: EventPayloadMap[TName]
  ): Promise<string> {
    const validatedPayload = validateEventPayload(name, payload);
    const idempotencyKey = validatedPayload.idempotencyKey;

    const messageId = await this.redis.xadd(
      this.streamName,
      "*",
      "eventName",
      name,
      "payload",
      JSON.stringify(validatedPayload),
      "idempotencyKey",
      idempotencyKey,
      "attempt",
      "0"
    );

    this.publishCounter.add(1, { "event.name": name });
    this.log.info("Published broker event", { name, messageId });

    return messageId;
  }

  async startConsumer(
    handler: <TName extends EventName>(event: StreamEvent<TName>) => Promise<void>
  ): Promise<void> {
    await this.initialize();

    if (!this.enableConsumerGroups) {
      // Legacy single consumer mode
      return this.startSingleConsumer(handler);
    }

    // NEW: Start multiple consumers for load distribution
    const consumers = Array.from({ length: this.consumerGroupSize }, (_, i) =>
      this.startGroupConsumer(handler, i)
    );

    // Wait for all consumers (they run indefinitely)
    await Promise.all(consumers);
  }

  /**
   * NEW: Start a consumer for a specific group
   */
  private async startGroupConsumer(
    handler: <TName extends EventName>(event: StreamEvent<TName>) => Promise<void>,
    groupIndex: number
  ): Promise<void> {
    const groupName = `${this.groupName}-${groupIndex}`;
    const consumerName = `${this.consumerName}-${groupIndex}`;

    while (true) {
      const claimedEntries = await this.claimPendingEntriesForGroup(groupName, consumerName);
      if (claimedEntries.length > 0) {
        if (this.batchProcessingEnabled) {
          await this.processEntriesInBatches(claimedEntries, handler);
        } else {
          await this.processEntriesIndividually(claimedEntries, handler);
        }
        continue;
      }

      const response = await this.redis.xreadgroup(
        "GROUP",
        groupName,
        consumerName,
        "BLOCK",
        this.blockMs,
        "COUNT",
        this.readCount,
        "STREAMS",
        this.streamName,
        ">"
      );

      if (!response) {
        continue;
      }

      for (const [, entries] of response) {
        if (entries.length === 0) {
          continue;
        }

        if (this.batchProcessingEnabled) {
          await this.processEntriesInBatches(entries, handler);
        } else {
          await this.processEntriesIndividually(entries, handler);
        }
      }
    }
  }

  /**
   * Legacy single consumer implementation
   */
  private async startSingleConsumer(
    handler: <TName extends EventName>(event: StreamEvent<TName>) => Promise<void>
  ): Promise<void> {
    while (true) {
      const claimedEntries = await this.claimPendingEntries();
      if (claimedEntries.length > 0) {
        await this.processEntriesInBatches(claimedEntries, handler);
        continue;
      }

      const response = await this.redis.xreadgroup(
        "GROUP",
        this.groupName,
        this.consumerName,
        "BLOCK",
        this.blockMs,
        "COUNT",
        this.readCount,
        "STREAMS",
        this.streamName,
        ">"
      );

      if (!response) {
        continue;
      }

      for (const [, entries] of response) {
        if (entries.length === 0) {
          continue;
        }
        await this.processEntriesInBatches(entries, handler);
      }
    }
  }

  private async processEntriesInBatches(
    entries: Array<[string, string[]]>,
    handler: <TName extends EventName>(event: StreamEvent<TName>) => Promise<void>
  ): Promise<void> {
    for (let i = 0; i < entries.length; i += this.batchSize) {
      const batch = entries.slice(i, i + this.batchSize);
      await this.processBatch(batch, handler);
    }
  }

  private async processBatch(
    entries: Array<[string, string[]]>,
    handler: <TName extends EventName>(event: StreamEvent<TName>) => Promise<void>
  ): Promise<void> {
    const batchStart = Date.now();
    this.batchSizeHistogram.record(entries.length);

    const outcomes = await this.runWithConcurrency(
      entries,
      Math.max(1, this.batchConcurrency),
      async ([id, fields]) => this.processEntry(id, fields, handler)
    );

    const ackIds: string[] = [];
    const pipeline = this.redis.pipeline();
    let pipelineHasCommands = false;

    for (const outcome of outcomes) {
      if (outcome.status === "ack") {
        ackIds.push(outcome.id);
        continue;
      }

      if (outcome.status === "retry") {
        pipeline.xack(this.streamName, this.groupName, outcome.id);
        pipeline.xadd(
          this.streamName,
          "*",
          "eventName",
          outcome.eventName,
          "payload",
          JSON.stringify(outcome.payload),
          "idempotencyKey",
          outcome.payload?.idempotencyKey ||
            outcome.payload?.id ||
            `${outcome.eventName}-${Date.now()}`,
          "attempt",
          String(outcome.nextAttempt)
        );
        pipelineHasCommands = true;
        continue;
      }

      if (outcome.status === "dlq") {
        pipeline.xack(this.streamName, this.groupName, outcome.id);
        pipeline.xadd(
          this.dlqStream,
          "*",
          "eventName",
          outcome.eventName,
          "payload",
          JSON.stringify(outcome.payload),
          "failedAt",
          new Date().toISOString(),
          "error",
          outcome.error?.message ?? "unknown"
        );
        pipelineHasCommands = true;
      }
    }

    if (ackIds.length > 0) {
      pipeline.xack(this.streamName, this.groupName, ...ackIds);
      pipelineHasCommands = true;
    }

    if (pipelineHasCommands) {
      await pipeline.exec();
    }

    this.batchLatencyHistogram.record(Date.now() - batchStart);
  }

  private async processEntry(
    id: string,
    fields: string[],
    handler: <TName extends EventName>(event: StreamEvent<TName>) => Promise<void>
  ): Promise<{
    id: string;
    eventName: EventName;
    status: "ack" | "retry" | "dlq";
    payload?: Record<string, unknown>;
    nextAttempt?: number;
    error?: Error;
  }> {
    const fieldMap: Record<string, string> = {};
    for (let i = 0; i < fields.length; i += 2) {
      fieldMap[fields[i]] = fields[i + 1];
    }

    const eventName = fieldMap["eventName"] as EventName;
    const attempt = Number(fieldMap["attempt"] || "0");
    const payload = JSON.parse(fieldMap["payload"]) as Record<string, unknown>;
    const idempotencyKey = fieldMap["idempotencyKey"];

    const start = Date.now();

    try {
      const validatedPayload = validateEventPayload(eventName, payload);
      const idempotencyKeyExists = await this.registerIdempotencyKey(idempotencyKey);

      if (!idempotencyKeyExists) {
        this.log.info("Skipped duplicate event", { eventName, idempotencyKey });
        return { id, eventName, status: "ack" };
      }

      await handler({ id, name: eventName, payload: validatedPayload, attempt });
      this.consumeCounter.add(1, { "event.name": eventName });
      this.processingDuration.record(Date.now() - start, { "event.name": eventName });
      return { id, eventName, status: "ack" };
    } catch (error) {
      return this.handleFailure({ id, eventName, attempt, error: error as Error, payload });
    }
  }

  private async handleFailure(params: {
    id: string;
    eventName: EventName;
    attempt: number;
    error: Error;
    payload: Record<string, unknown>;
  }): Promise<{
    id: string;
    eventName: EventName;
    status: "retry" | "dlq";
    payload: Record<string, unknown>;
    nextAttempt: number;
    error: Error;
  }> {
    const { id, eventName, attempt, error, payload } = params;
    const nextAttempt = attempt + 1;
    this.failureCounter.add(1, { "event.name": eventName });

    if (nextAttempt >= this.maxDeliveries) {
      this.log.error("Moved message to DLQ", error, { eventName, id, attempt });
      return {
        id,
        eventName,
        status: "dlq",
        payload,
        nextAttempt,
        error,
      };
    }

    this.log.warn("Retrying broker message", { eventName, id, nextAttempt });
    return {
      id,
      eventName,
      status: "retry",
      payload,
      nextAttempt,
      error,
    };
  }

  private async registerIdempotencyKey(key: string): Promise<boolean> {
    if (!key) return true;
    const inserted = await this.redis.set(
      `${this.streamName}:dedupe:${key}`,
      "processed",
      "PX",
      this.idempotencyTtlMs,
      "NX"
    );

    return Boolean(inserted);
  }

  /**
   * NEW: Process entries individually (for non-batch mode)
   */
  private async processEntriesIndividually(
    entries: Array<[string, string[]]>,
    handler: <TName extends EventName>(event: StreamEvent<TName>) => Promise<void>
  ): Promise<void> {
    for (const [id, fields] of entries) {
      await this.processEntry(id, fields, handler);
    }
  }

  /**
   * NEW: Claim pending entries for a specific consumer group
   */
  private async claimPendingEntriesForGroup(
    groupName: string,
    consumerName: string
  ): Promise<Array<[string, string[]]>> {
    const response = await this.redis.call(
      "XAUTOCLAIM",
      this.streamName,
      groupName,
      consumerName,
      this.claimIdleMs,
      "0-0",
      "COUNT",
      this.claimCount
    );

    if (!Array.isArray(response)) {
      return [];
    }

    const entries = Array.isArray(response[1]) ? (response[1] as Array<[string, string[]]>) : [];
    this.pendingClaimHistogram.record(entries.length);
    return entries;
  }

  private async claimPendingEntries(): Promise<Array<[string, string[]]>> {
    const response = await this.redis.call(
      "XAUTOCLAIM",
      this.streamName,
      this.groupName,
      this.consumerName,
      this.claimIdleMs,
      "0-0",
      "COUNT",
      this.claimCount
    );

    if (!Array.isArray(response)) {
      return [];
    }

    const entries = Array.isArray(response[1]) ? (response[1] as Array<[string, string[]]>) : [];
    this.pendingClaimHistogram.record(entries.length);
    return entries;
  }

  private async runWithConcurrency<T, TResult>(
    items: T[],
    limit: number,
    worker: (item: T) => Promise<TResult>
  ): Promise<TResult[]> {
    const results: TResult[] = new Array(items.length);
    let index = 0;
    const workerCount = Math.min(limit, items.length);

    await Promise.all(
      Array.from({ length: workerCount }, async () => {
        while (index < items.length) {
          const currentIndex = index;
          index += 1;
          results[currentIndex] = await worker(items[currentIndex]);
        }
      })
    );

    return results;
  }
}

export const redisStreamBroker = new RedisStreamBroker();