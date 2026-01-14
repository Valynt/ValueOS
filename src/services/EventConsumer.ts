/**
 * Kafka Event Consumer Service
 *
 * Handles consuming events from Kafka topics with proper error handling,
 * retries, and monitoring.
 */

import { Kafka, Consumer, EachMessagePayload, logLevel } from "kafkajs";
import { logger } from "../lib/logger";
import { BaseEvent } from "../types/events";

export interface ConsumerConfig {
  clientId: string;
  groupId: string;
  brokers: string[];
  topics: string[];
  maxRetries?: number;
  retryDelay?: number;
  maxBatchSize?: number;
  sessionTimeout?: number;
  heartbeatInterval?: number;
}

export interface EventHandler {
  eventType: string;
  handler: (event: BaseEvent, payload: EachMessagePayload) => Promise<void>;
  concurrency?: number;
}

export class EventConsumer {
  private consumer: Consumer;
  private kafka: Kafka;
  private isConnected: boolean = false;
  private isSubscribed: boolean = false;
  private config: ConsumerConfig;
  private handlers: Map<string, EventHandler> = new Map();
  private processingMessages: Set<string> = new Set();

  constructor(config: ConsumerConfig) {
    this.config = {
      maxRetries: 3,
      retryDelay: 1000,
      maxBatchSize: 10,
      sessionTimeout: 30000,
      heartbeatInterval: 3000,
      ...config,
    };

    this.kafka = new Kafka({
      clientId: this.config.clientId,
      brokers: this.config.brokers,
      logLevel: logLevel.WARN,
      retry: {
        retries: this.config.maxRetries,
        initialRetryTime: this.config.retryDelay,
      },
    });

    this.consumer = this.kafka.consumer({
      groupId: this.config.groupId,
      sessionTimeout: this.config.sessionTimeout,
      heartbeatInterval: this.config.heartbeatInterval,
      maxBytesPerPartition: 1048576, // 1MB
      maxBytes: 5242880, // 5MB
    });

    this.setupEventHandlers();
  }

  /**
   * Connect to Kafka
   */
  async connect(): Promise<void> {
    if (this.isConnected) return;

    try {
      await this.consumer.connect();
      this.isConnected = true;
      logger.info("Event consumer connected to Kafka", {
        clientId: this.config.clientId,
        groupId: this.config.groupId,
        topics: this.config.topics,
      });
    } catch (error) {
      logger.error(
        "Failed to connect event consumer to Kafka",
        error as Error,
        {
          clientId: this.config.clientId,
          groupId: this.config.groupId,
        }
      );
      throw error;
    }
  }

  /**
   * Disconnect from Kafka
   */
  async disconnect(): Promise<void> {
    if (!this.isConnected) return;

    try {
      await this.consumer.disconnect();
      this.isConnected = false;
      this.isSubscribed = false;
      logger.info("Event consumer disconnected from Kafka", {
        clientId: this.config.clientId,
        groupId: this.config.groupId,
      });
    } catch (error) {
      logger.error("Failed to disconnect event consumer", error as Error, {
        clientId: this.config.clientId,
        groupId: this.config.groupId,
      });
      throw error;
    }
  }

  /**
   * Subscribe to topics and start consuming
   */
  async subscribe(): Promise<void> {
    if (!this.isConnected) {
      await this.connect();
    }

    if (this.isSubscribed) return;

    try {
      await this.consumer.subscribe({
        topics: this.config.topics,
        fromBeginning: false, // Only consume new messages
      });

      await this.consumer.run({
        eachMessage: this.handleMessage.bind(this),
        autoCommit: true,
        autoCommitInterval: 5000,
        autoCommitThreshold: 100,
      });

      this.isSubscribed = true;
      logger.info("Event consumer subscribed to topics", {
        clientId: this.config.clientId,
        groupId: this.config.groupId,
        topics: this.config.topics,
      });
    } catch (error) {
      logger.error("Failed to subscribe event consumer", error as Error, {
        clientId: this.config.clientId,
        groupId: this.config.groupId,
        topics: this.config.topics,
      });
      throw error;
    }
  }

  /**
   * Register an event handler
   */
  registerHandler(handler: EventHandler): void {
    this.handlers.set(handler.eventType, handler);
    logger.info("Event handler registered", {
      eventType: handler.eventType,
      groupId: this.config.groupId,
    });
  }

  /**
   * Unregister an event handler
   */
  unregisterHandler(eventType: string): void {
    this.handlers.delete(eventType);
    logger.info("Event handler unregistered", {
      eventType,
      groupId: this.config.groupId,
    });
  }

  /**
   * Handle incoming messages
   */
  private async handleMessage(payload: EachMessagePayload): Promise<void> {
    const { topic, partition, message } = payload;
    const messageKey = `${topic}-${partition}-${message.offset}`;

    // Prevent duplicate processing
    if (this.processingMessages.has(messageKey)) {
      logger.warn("Duplicate message detected, skipping", {
        topic,
        partition,
        offset: message.offset,
        key: message.key?.toString(),
      });
      return;
    }

    this.processingMessages.add(messageKey);

    try {
      const eventData = JSON.parse(message.value?.toString() || "{}");
      const event: BaseEvent = {
        ...eventData,
        timestamp: new Date(eventData.timestamp),
      };

      const handler = this.handlers.get(event.eventType);

      if (!handler) {
        logger.warn("No handler registered for event type", {
          eventType: event.eventType,
          eventId: event.eventId,
          topic,
          partition,
          offset: message.offset,
        });
        return;
      }

      logger.debug("Processing event", {
        eventType: event.eventType,
        eventId: event.eventId,
        correlationId: event.correlationId,
        topic,
        partition,
        offset: message.offset,
      });

      await handler.handler(event, payload);

      logger.debug("Event processed successfully", {
        eventType: event.eventType,
        eventId: event.eventId,
        correlationId: event.correlationId,
      });
    } catch (error) {
      logger.error("Failed to process event", error as Error, {
        topic,
        partition,
        offset: message.offset,
        key: message.key?.toString(),
        headers: message.headers,
      });

      // TODO: Implement dead letter queue logic here
      // await this.sendToDeadLetterQueue(payload, error);
    } finally {
      this.processingMessages.delete(messageKey);
    }
  }

  /**
   * Get consumer metrics
   */
  async getMetrics(): Promise<{
    connected: boolean;
    subscribed: boolean;
    topics: string[];
    groupId: string;
    processingCount: number;
  }> {
    return {
      connected: this.isConnected,
      subscribed: this.isSubscribed,
      topics: this.config.topics,
      groupId: this.config.groupId,
      processingCount: this.processingMessages.size,
    };
  }

  /**
   * Setup consumer event handlers
   */
  private setupEventHandlers(): void {
    this.consumer.on("consumer.disconnect", () => {
      this.isConnected = false;
      this.isSubscribed = false;
      logger.warn("Event consumer disconnected from Kafka", {
        clientId: this.config.clientId,
        groupId: this.config.groupId,
      });
    });

    this.consumer.on("consumer.connect", () => {
      this.isConnected = true;
      logger.info("Event consumer reconnected to Kafka", {
        clientId: this.config.clientId,
        groupId: this.config.groupId,
      });
    });

    this.consumer.on("consumer.group_join", (event) => {
      logger.info("Consumer joined group", {
        groupId: event.payload.groupId,
        memberId: event.payload.memberId,
        leaderId: event.payload.leaderId,
      });
    });
  }

  /**
   * Send failed messages to dead letter queue
   */
  private async sendToDeadLetterQueue(
    payload: EachMessagePayload,
    error: Error
  ): Promise<void> {
    // TODO: Implement dead letter queue functionality
    logger.error("Dead letter queue not implemented yet", error, {
      topic: payload.topic,
      partition: payload.partition,
      offset: payload.message.offset,
    });
  }
}

/**
 * Create a consumer instance for a specific service
 */
export function createEventConsumer(
  serviceName: string,
  topics: string[],
  handlers: EventHandler[] = []
): EventConsumer {
  const brokers = process.env.KAFKA_BROKERS?.split(",") || ["localhost:9092"];
  const clientId = `${serviceName}-consumer`;
  const groupId = `${serviceName}-group`;

  const consumer = new EventConsumer({
    clientId,
    groupId,
    brokers,
    topics,
  });

  // Register handlers
  handlers.forEach((handler) => consumer.registerHandler(handler));

  return consumer;
}
