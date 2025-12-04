import Redis from 'ioredis';
import { Logger, logger } from '../../utils/logger';
import { createCounter, createHistogram } from '../../lib/observability';
import { EventName, EventPayloadMap, validateEventPayload } from './EventSchemas';

export interface RedisStreamBrokerOptions {
  streamName?: string;
  groupName?: string;
  consumerName?: string;
  redisUrl?: string;
  maxDeliveries?: number;
  idempotencyTtlMs?: number;
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
  private readonly log: Logger;
  private readonly publishCounter = createCounter('broker.events.published', 'Total events published');
  private readonly consumeCounter = createCounter('broker.events.consumed', 'Total events consumed');
  private readonly failureCounter = createCounter('broker.events.failed', 'Total events that failed processing');
  private readonly processingDuration = createHistogram(
    'broker.event.processing_ms',
    'Processing duration for brokered events'
  );

  constructor(options: RedisStreamBrokerOptions = {}) {
    this.streamName = options.streamName || 'valuecanvas.events';
    this.groupName = options.groupName || 'valuecanvas-workers';
    this.consumerName = options.consumerName || `consumer-${process.pid}`;
    this.dlqStream = `${this.streamName}:dlq`;
    this.maxDeliveries = options.maxDeliveries ?? 5;
    this.idempotencyTtlMs = options.idempotencyTtlMs ?? 1000 * 60 * 60; // 1 hour
    this.redis = new Redis(options.redisUrl || process.env.REDIS_URL || 'redis://localhost:6379');
    this.log = logger.withContext({ component: 'redis-stream-broker' });
  }

  async initialize(): Promise<void> {
    try {
      await this.redis.xgroup('CREATE', this.streamName, this.groupName, '$', 'MKSTREAM');
      this.log.info('Created consumer group', { stream: this.streamName, group: this.groupName });
    } catch (error: any) {
      if (error?.message?.includes('BUSYGROUP')) {
        this.log.debug('Consumer group already exists', { stream: this.streamName, group: this.groupName });
      } else {
        throw error;
      }
    }
  }

  async publish<TName extends EventName>(name: TName, payload: EventPayloadMap[TName]): Promise<string> {
    const validatedPayload = validateEventPayload(name, payload);
    const idempotencyKey = validatedPayload.idempotencyKey;

    const messageId = await this.redis.xadd(
      this.streamName,
      '*',
      'eventName',
      name,
      'payload',
      JSON.stringify(validatedPayload),
      'idempotencyKey',
      idempotencyKey,
      'attempt',
      '0'
    );

    this.publishCounter.add(1, { 'event.name': name });
    this.log.info('Published broker event', { name, messageId });

    return messageId;
  }

  async startConsumer(
    handler: <TName extends EventName>(event: StreamEvent<TName>) => Promise<void>
  ): Promise<void> {
    await this.initialize();

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const response = await this.redis.xreadgroup(
        'GROUP',
        this.groupName,
        this.consumerName,
        'BLOCK',
        2000,
        'COUNT',
        10,
        'STREAMS',
        this.streamName,
        '>'
      );

      if (!response) {
        continue;
      }

      for (const [, entries] of response) {
        for (const [id, fields] of entries) {
          await this.processEntry(id, fields, handler);
        }
      }
    }
  }

  private async processEntry(
    id: string,
    fields: string[],
    handler: <TName extends EventName>(event: StreamEvent<TName>) => Promise<void>
  ): Promise<void> {
    const fieldMap: Record<string, string> = {};
    for (let i = 0; i < fields.length; i += 2) {
      fieldMap[fields[i]] = fields[i + 1];
    }

    const eventName = fieldMap['eventName'] as EventName;
    const attempt = Number(fieldMap['attempt'] || '0');
    const payload = JSON.parse(fieldMap['payload']);
    const idempotencyKey = fieldMap['idempotencyKey'];

    const start = Date.now();

    try {
      const validatedPayload = validateEventPayload(eventName, payload);
      const idempotencyKeyExists = await this.registerIdempotencyKey(idempotencyKey);

      if (!idempotencyKeyExists) {
        await this.redis.xack(this.streamName, this.groupName, id);
        this.log.info('Skipped duplicate event', { eventName, idempotencyKey });
        return;
      }

      await handler({ id, name: eventName, payload: validatedPayload, attempt });
      await this.redis.xack(this.streamName, this.groupName, id);
      this.consumeCounter.add(1, { 'event.name': eventName });
      this.processingDuration.record(Date.now() - start, { 'event.name': eventName });
    } catch (error) {
      await this.handleFailure({ id, eventName, attempt, error: error as Error, payload });
    }
  }

  private async handleFailure(params: {
    id: string;
    eventName: EventName;
    attempt: number;
    error: Error;
    payload: any;
  }): Promise<void> {
    const { id, eventName, attempt, error, payload } = params;
    const nextAttempt = attempt + 1;
    this.failureCounter.add(1, { 'event.name': eventName });

    if (nextAttempt >= this.maxDeliveries) {
      await this.redis.multi()
        .xack(this.streamName, this.groupName, id)
        .xadd(this.dlqStream, '*', 'eventName', eventName, 'payload', JSON.stringify(payload), 'failedAt', new Date().toISOString(), 'error', error.message)
        .exec();
      this.log.error('Moved message to DLQ', error, { eventName, id, attempt });
      return;
    }

    await this.redis.multi()
      .xack(this.streamName, this.groupName, id)
      .xadd(
        this.streamName,
        '*',
        'eventName',
        eventName,
        'payload',
        JSON.stringify(payload),
        'idempotencyKey',
        payload.idempotencyKey || payload.id || `${eventName}-${Date.now()}`,
        'attempt',
        String(nextAttempt)
      )
      .exec();

    this.log.warn('Retrying broker message', { eventName, id, nextAttempt });
  }

  private async registerIdempotencyKey(key: string): Promise<boolean> {
    if (!key) return true;
    const inserted = await this.redis.set(
      `${this.streamName}:dedupe:${key}`,
      'processed',
      'PX',
      this.idempotencyTtlMs,
      'NX'
    );

    return Boolean(inserted);
  }
}

export const redisStreamBroker = new RedisStreamBroker();
