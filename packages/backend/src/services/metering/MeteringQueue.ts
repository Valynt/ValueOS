import { AckPolicy, connect, type ConsumerConfig, DeliverPolicy, type JetStreamClient, type JetStreamManager, type JsMsg, JSONCodec, type NatsConnection, type StreamConfig } from 'nats';

import { createLogger } from '../../lib/logger.js';

const logger = createLogger({ component: 'MeteringQueue' });

const usageEventCodec = JSONCodec<UsageQueueEvent>();

export interface UsageQueueEvent {
  tenant_id: string;
  metric: string;
  amount: number;
  request_id: string;
  idempotency_key: string;
  metadata: Record<string, unknown>;
  timestamp: string;
  event_id: string;
}

interface MeteringQueueConfig {
  natsServers: string[];
  streamName: string;
  consumerName: string;
  queueSubject: string;
  dlqSubject: string;
  dlqStreamName: string;
  maxDeliver: number;
  ackWaitMs: number;
  backoffMs: number[];
}

const DEFAULT_BACKOFF_MS = [2_000, 10_000, 30_000, 120_000];

const parseBackoffMs = (raw: string | undefined): number[] => {
  if (!raw) return DEFAULT_BACKOFF_MS;

  const parsed = raw
    .split(',')
    .map(value => Number.parseInt(value.trim(), 10))
    .filter(value => Number.isFinite(value) && value > 0);

  return parsed.length > 0 ? parsed : DEFAULT_BACKOFF_MS;
};

const getMeteringQueueConfig = (): MeteringQueueConfig => ({
  natsServers: (process.env.METERING_NATS_SERVERS || process.env.NATS_SERVERS || 'nats://localhost:4222')
    .split(',')
    .map(server => server.trim())
    .filter(Boolean),
  streamName: process.env.METERING_USAGE_STREAM || 'METERING_USAGE_EVENTS',
  consumerName: process.env.METERING_USAGE_CONSUMER || 'billing-aggregator',
  queueSubject: process.env.METERING_USAGE_SUBJECT || 'metering.usage.events',
  dlqSubject: process.env.METERING_USAGE_DLQ_SUBJECT || 'metering.usage.events.dlq',
  dlqStreamName: process.env.METERING_USAGE_DLQ_STREAM || 'METERING_USAGE_EVENTS_DLQ',
  maxDeliver: Number.parseInt(process.env.METERING_USAGE_MAX_DELIVER || '5', 10),
  ackWaitMs: Number.parseInt(process.env.METERING_USAGE_ACK_WAIT_MS || '30000', 10),
  backoffMs: parseBackoffMs(process.env.METERING_USAGE_BACKOFF_MS),
});

const toNanos = (ms: number): number => ms * 1_000_000;

export class MeteringQueue {
  private readonly config: MeteringQueueConfig;

  private connection: NatsConnection | null = null;

  private jetstream: JetStreamClient | null = null;

  private manager: JetStreamManager | null = null;

  constructor(config: MeteringQueueConfig = getMeteringQueueConfig()) {
    this.config = config;
  }

  async connect(): Promise<void> {
    if (this.connection && !this.connection.isClosed()) {
      return;
    }

    this.connection = await connect({
      servers: this.config.natsServers,
      name: 'valueos-metering',
    });
    this.jetstream = this.connection.jetstream();
    this.manager = await this.connection.jetstreamManager();

    await this.ensureInfrastructure();

    logger.info('Connected to metering queue', {
      servers: this.config.natsServers,
      streamName: this.config.streamName,
      consumer: this.config.consumerName,
    });
  }

  async close(): Promise<void> {
    if (!this.connection) return;
    await this.connection.close();
    this.connection = null;
    this.jetstream = null;
    this.manager = null;
  }

  async publish(event: UsageQueueEvent): Promise<void> {
    await this.connect();

    if (!this.jetstream) {
      throw new Error('JetStream is not initialized');
    }

    await this.jetstream.publish(this.config.queueSubject, usageEventCodec.encode(event));
  }

  async publishToDlq(message: JsMsg, errorMessage: string): Promise<void> {
    await this.connect();

    if (!this.jetstream) {
      throw new Error('JetStream is not initialized');
    }

    const payload = usageEventCodec.decode(message.data);
    await this.jetstream.publish(
      this.config.dlqSubject,
      usageEventCodec.encode({
        ...payload,
        metadata: {
          ...payload.metadata,
          failure_reason: errorMessage,
          delivery_count: message.info.deliveryCount,
          stream_sequence: message.seq,
          moved_to_dlq_at: new Date().toISOString(),
        },
      })
    );
  }

  async subscribe(): Promise<AsyncIterable<JsMsg>> {
    await this.connect();

    if (!this.jetstream) {
      throw new Error('JetStream is not initialized');
    }

    const subscription = await this.jetstream.consumers.get(this.config.streamName, this.config.consumerName);
    return subscription.consume();
  }

  decode(message: JsMsg): UsageQueueEvent {
    return usageEventCodec.decode(message.data);
  }

  getRetryDelay(deliveryCount: number): number {
    const index = Math.max(0, Math.min(deliveryCount - 1, this.config.backoffMs.length - 1));
    return this.config.backoffMs[index] || this.config.backoffMs[this.config.backoffMs.length - 1] || DEFAULT_BACKOFF_MS[0];
  }

  getMaxDeliveries(): number {
    return this.config.maxDeliver;
  }

  async getQueueLag(): Promise<number> {
    await this.connect();

    if (!this.manager) {
      throw new Error('JetStream manager is not initialized');
    }

    const info = await this.manager.consumers.info(this.config.streamName, this.config.consumerName);
    return info.num_pending;
  }

  private async ensureInfrastructure(): Promise<void> {
    if (!this.manager) {
      throw new Error('JetStream manager is not initialized');
    }

    await this.ensureStream({
      name: this.config.streamName,
      subjects: [this.config.queueSubject],
      retention: 'limits',
      max_msgs_per_subject: -1,
      discard: 'old',
      duplicate_window: toNanos(120_000),
      max_age: toNanos(7 * 24 * 60 * 60 * 1_000),
    });

    await this.ensureStream({
      name: this.config.dlqStreamName,
      subjects: [this.config.dlqSubject],
      retention: 'limits',
      discard: 'old',
      max_age: toNanos(30 * 24 * 60 * 60 * 1_000),
    });

    const consumerConfig: Partial<ConsumerConfig> = {
      durable_name: this.config.consumerName,
      ack_policy: AckPolicy.Explicit,
      ack_wait: toNanos(this.config.ackWaitMs),
      max_deliver: this.config.maxDeliver,
      backoff: this.config.backoffMs.map(toNanos),
      deliver_policy: DeliverPolicy.All,
    };

    try {
      await this.manager.consumers.info(this.config.streamName, this.config.consumerName);
    } catch {
      await this.manager.consumers.add(this.config.streamName, consumerConfig);
    }
  }

  private async ensureStream(config: Partial<StreamConfig> & { name: string; subjects: string[] }): Promise<void> {
    if (!this.manager) {
      throw new Error('JetStream manager is not initialized');
    }

    try {
      await this.manager.streams.info(config.name);
    } catch {
      await this.manager.streams.add(config);
    }
  }
}
