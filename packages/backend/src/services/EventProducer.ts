/**
 * Kafka Event Producer Service
 *
 * Handles publishing events to Kafka topics with proper error handling,
 * retries, and monitoring.
 */

import { Kafka, Producer, Message, CompressionTypes, logLevel } from "kafkajs";
import { logger } from "../lib/logger";
import { BaseEvent } from "@shared/types/events";
import {
  kafkaProducerEventsTotal,
  kafkaProducerLatency,
  kafkaProducerErrors,
} from "../lib/monitoring/metrics";
import { registerShutdownHandler } from "../lib/shutdown/gracefulShutdown";

export interface ProducerConfig {
  clientId: string;
  brokers: string[];
  compression?: CompressionTypes;
  retries?: number;
  retryDelay?: number;
  maxBatchSize?: number;
  batchTimeout?: number;
}

export class EventProducer {
  private producer: Producer;
  private kafka: Kafka;
  private isConnected: boolean = false;
  private config: ProducerConfig;

  constructor(config: ProducerConfig) {
    this.config = {
      compression: CompressionTypes.GZIP,
      retries: 3,
      retryDelay: 1000,
      maxBatchSize: 100,
      batchTimeout: 1000,
      ...config,
    };

    this.kafka = new Kafka({
      clientId: this.config.clientId,
      brokers: this.config.brokers,
      logLevel: logLevel.WARN,
      retry: {
        retries: this.config.retries,
        initialRetryTime: this.config.retryDelay,
      },
    });

    this.producer = this.kafka.producer({
      allowAutoTopicCreation: false,
      compression: this.config.compression,
      batch: {
        size: this.config.maxBatchSize,
        timeout: this.config.batchTimeout,
      },
    });

    this.setupEventHandlers();
  }

  /**
   * Connect to Kafka
   */
  async connect(): Promise<void> {
    if (this.isConnected) return;

    try {
      await this.producer.connect();
      this.isConnected = true;
      logger.info("Event producer connected to Kafka", {
        clientId: this.config.clientId,
        brokers: this.config.brokers.length,
      });
    } catch (error) {
      logger.error("Failed to connect event producer to Kafka", error as Error, {
        clientId: this.config.clientId,
      });
      throw error;
    }
  }

  /**
   * Disconnect from Kafka
   */
  async disconnect(): Promise<void> {
    if (!this.isConnected) return;

    try {
      await this.producer.disconnect();
      this.isConnected = false;
      logger.info("Event producer disconnected from Kafka", {
        clientId: this.config.clientId,
      });
    } catch (error) {
      logger.error("Failed to disconnect event producer", error as Error, {
        clientId: this.config.clientId,
      });
      throw error;
    }
  }

  /**
   * Publish a single event to a topic
   */
  async publish(topic: string, event: BaseEvent): Promise<void> {
    if (!this.isConnected) {
      await this.connect();
    }

    const message: Message = {
      key: event.correlationId,
      value: JSON.stringify(event),
      timestamp: event.timestamp.toISOString(),
      headers: {
        "event-type": event.eventType,
        "event-version": event.version,
        "correlation-id": event.correlationId,
        source: event.source,
        "x-tenant-context": (event as any).tct || "",
      },
    };

    const startTime = Date.now();
    try {
      await this.producer.send({
        topic,
        messages: [message],
      });

      const latencyMs = Date.now() - startTime;

      // Record metrics
      kafkaProducerEventsTotal.inc({ topic, status: "success" });
      kafkaProducerLatency.observe({ topic }, latencyMs / 1000);

      logger.debug("Event published successfully", {
        topic,
        eventId: event.eventId,
        eventType: event.eventType,
        correlationId: event.correlationId,
        latencyMs,
      });
    } catch (error) {
      const latencyMs = Date.now() - startTime;

      // Record error metrics
      kafkaProducerEventsTotal.inc({ topic, status: "error" });
      kafkaProducerErrors.inc({
        topic,
        error_type: error instanceof Error ? error.name : "unknown",
      });
      kafkaProducerLatency.observe({ topic }, latencyMs / 1000);

      logger.error("Failed to publish event", error as Error, {
        topic,
        eventId: event.eventId,
        eventType: event.eventType,
        correlationId: event.correlationId,
        latencyMs,
      });
      throw error;
    }
  }

  /**
   * Publish multiple events to a topic in batch
   */
  async publishBatch(topic: string, events: BaseEvent[]): Promise<void> {
    if (!this.isConnected) {
      await this.connect();
    }

    const messages: Message[] = events.map((event) => ({
      key: event.correlationId,
      value: JSON.stringify(event),
      timestamp: event.timestamp.toISOString(),
      headers: {
        "event-type": event.eventType,
        "event-version": event.version,
        "correlation-id": event.correlationId,
        source: event.source,
        "x-tenant-context": (event as any).tct || "",
      },
    }));

    const startTime = Date.now();
    try {
      await this.producer.send({
        topic,
        messages,
      });

      const latencyMs = Date.now() - startTime;

      // Record batch metrics
      kafkaProducerEventsTotal.inc({ topic, status: "success" }, events.length);
      kafkaProducerLatency.observe({ topic }, latencyMs / 1000);

      logger.debug("Batch of events published successfully", {
        topic,
        eventCount: events.length,
        correlationIds: events.map((e) => e.correlationId),
        latencyMs,
      });
    } catch (error) {
      const latencyMs = Date.now() - startTime;

      // Record batch error metrics
      kafkaProducerEventsTotal.inc({ topic, status: "error" }, events.length);
      kafkaProducerErrors.inc({
        topic,
        error_type: error instanceof Error ? error.name : "unknown",
      });
      kafkaProducerLatency.observe({ topic }, latencyMs / 1000);

      logger.error("Failed to publish event batch", error as Error, {
        topic,
        eventCount: events.length,
        correlationIds: events.map((e) => e.correlationId),
        latencyMs,
      });
      throw error;
    }
  }

  /**
   * Get producer metrics
   */
  async getMetrics(): Promise<{
    connected: boolean;
    topics: string[];
    connectionCount: number;
  }> {
    return {
      connected: this.isConnected,
      topics: [], // Would need to query Kafka for this
      connectionCount: this.isConnected ? 1 : 0,
    };
  }

  /**
   * Setup producer event handlers
   */
  private setupEventHandlers(): void {
    this.producer.on("producer.disconnect", () => {
      this.isConnected = false;
      logger.warn("Event producer disconnected from Kafka", {
        clientId: this.config.clientId,
      });
    });

    this.producer.on("producer.connect", () => {
      this.isConnected = true;
      logger.info("Event producer reconnected to Kafka", {
        clientId: this.config.clientId,
      });
    });
  }
}

/**
 * Singleton event producer instance
 */
let eventProducer: EventProducer | null = null;

export function getEventProducer(): EventProducer {
  if (!eventProducer) {
    const brokers = process.env.KAFKA_BROKERS?.split(",") || ["localhost:9092"];
    const clientId = process.env.KAFKA_CLIENT_ID || "valueos-event-producer";

    eventProducer = new EventProducer({
      clientId,
      brokers,
    });

    // Register with graceful shutdown manager
    registerShutdownHandler(
      "EventProducer",
      async () => {
        if (eventProducer) {
          await eventProducer.disconnect();
        }
      },
      15 // Lower priority - disconnect after queues are drained
    );
  }

  return eventProducer;
}

/**
 * Initialize the global event producer
 */
export async function initializeEventProducer(): Promise<EventProducer> {
  const producer = getEventProducer();
  await producer.connect();
  return producer;
}

/**
 * Shutdown the global event producer
 */
export async function shutdownEventProducer(): Promise<void> {
  if (eventProducer) {
    await eventProducer.disconnect();
    eventProducer = null;
  }
}
