/**
 * MessageBus Service
 * 
 * Provides Redis/NATS abstraction for inter-agent communication.
 * Supports pub/sub, message compression, and delivery guarantees.
 */

import { logger } from '../lib/logger';
import { v4 as uuidv4 } from 'uuid';
import type {
  CommunicationEvent,
  CreateCommunicationEvent,
  MessageHandler,
  ChannelConfig,
  MessageStats,
} from '../types/CommunicationEvent';
import { compress, decompress } from 'lz-string';

export class MessageBus {
  private subscribers: Map<string, Set<MessageHandler>>;
  private channels: Map<string, ChannelConfig>;
  private stats: Map<string, MessageStats>;
  private messageHistory: Map<string, CommunicationEvent[]>;
  private redis: any; // Redis client (optional)
  private nats: any; // NATS client (optional)

  constructor(config?: { redis?: any; nats?: any }) {
    this.subscribers = new Map();
    this.channels = new Map();
    this.stats = new Map();
    this.messageHistory = new Map();
    this.redis = config?.redis;
    this.nats = config?.nats;

    // Initialize default channels
    this.initializeDefaultChannels();
  }

  /**
   * Publish a message to a channel
   */
  async publishMessage(
    channel: string,
    payload: CreateCommunicationEvent
  ): Promise<string> {
    const messageId = uuidv4();

    const event: CommunicationEvent = {
      id: messageId,
      ...payload,
      timestamp: new Date().toISOString(),
    };

    // Compress if needed
    if (event.compressed || this.shouldCompress(event.payload)) {
      event.payload = this.compressMessage(event.payload);
      event.compressed = true;
    }

    // Store in history if channel is persistent
    const channelConfig = this.channels.get(channel);
    if (channelConfig?.persistent) {
      this.storeMessage(channel, event);
    }

    // Update stats
    this.updateStats(channel, 'publish');

    // Deliver to subscribers
    await this.deliverMessage(channel, event);

    // Publish to Redis/NATS if available
    if (this.redis) {
      await this.publishToRedis(channel, event);
    } else if (this.nats) {
      await this.publishToNATS(channel, event);
    }

    return messageId;
  }

  /**
   * Subscribe to a channel
   */
  subscribe(
    channel: string,
    agentName: string,
    handler: (event: CommunicationEvent) => Promise<void>,
    filter?: (event: CommunicationEvent) => boolean
  ): () => void {
    const messageHandler: MessageHandler = {
      channel,
      agent_name: agentName,
      handler,
      filter,
    };

    if (!this.subscribers.has(channel)) {
      this.subscribers.set(channel, new Set());
    }

    this.subscribers.get(channel)!.add(messageHandler);

    // Update stats
    this.updateStats(channel, 'subscribe');

    // Subscribe to Redis/NATS if available
    if (this.redis) {
      this.subscribeToRedis(channel, handler);
    } else if (this.nats) {
      this.subscribeToNATS(channel, handler);
    }

    // Return unsubscribe function
    return () => {
      this.subscribers.get(channel)?.delete(messageHandler);
      this.updateStats(channel, 'unsubscribe');
    };
  }

  /**
   * Compress message payload
   */
  compressMessage(payload: any): any {
    try {
      const jsonString = JSON.stringify(payload);
      const compressed = compress(jsonString);
      return { __compressed: true, data: compressed };
    } catch (error) {
      logger.error('Failed to compress message', error instanceof Error ? error : undefined);
      return payload;
    }
  }

  /**
   * Expand compressed message
   */
  expandMessage(payload: any): any {
    try {
      if (payload.__compressed) {
        const decompressed = decompress(payload.data);
        return JSON.parse(decompressed);
      }
      return payload;
    } catch (error) {
      logger.error('Failed to expand message', error instanceof Error ? error : undefined);
      return payload;
    }
  }

  /**
   * Create a new channel
   */
  createChannel(config: ChannelConfig): void {
    this.channels.set(config.name, config);
    this.stats.set(config.name, {
      channel: config.name,
      total_messages: 0,
      messages_per_second: 0,
      active_subscribers: 0,
      failed_deliveries: 0,
      average_latency_ms: 0,
    });

    if (config.persistent) {
      this.messageHistory.set(config.name, []);
    }
  }

  /**
   * Get channel statistics
   */
  getChannelStats(channel: string): MessageStats | undefined {
    return this.stats.get(channel);
  }

  /**
   * Get all channel statistics
   */
  getAllStats(): MessageStats[] {
    return Array.from(this.stats.values());
  }

  /**
   * Get message history for a channel
   */
  getMessageHistory(channel: string, limit: number = 100): CommunicationEvent[] {
    const history = this.messageHistory.get(channel) || [];
    return history.slice(-limit);
  }

  /**
   * Clear message history for a channel
   */
  clearHistory(channel: string): void {
    this.messageHistory.set(channel, []);
  }

  /**
   * Request-response pattern
   */
  async request(
    channel: string,
    payload: CreateCommunicationEvent,
    timeout: number = 5000
  ): Promise<CommunicationEvent> {
    const correlationId = uuidv4();
    const replyChannel = `${channel}.reply.${correlationId}`;

    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        unsubscribe();
        reject(new Error('Request timeout'));
      }, timeout);

      const unsubscribe = this.subscribe(
        replyChannel,
        'requester',
        async (event) => {
          if (event.correlation_id === correlationId) {
            clearTimeout(timeoutId);
            unsubscribe();
            resolve(event);
          }
        }
      );

      this.publishMessage(channel, {
        ...payload,
        correlation_id: correlationId,
        reply_to: replyChannel,
      }).catch((error) => {
        clearTimeout(timeoutId);
        unsubscribe();
        reject(error);
      });
    });
  }

  /**
   * Broadcast to all agents
   */
  async broadcast(payload: CreateCommunicationEvent): Promise<void> {
    await this.publishMessage('broadcast', {
      ...payload,
      message_type: 'broadcast',
    });
  }

  // Private methods

  private initializeDefaultChannels(): void {
    const defaultChannels: ChannelConfig[] = [
      {
        name: 'coordinator',
        description: 'Coordinator agent channel',
        persistent: true,
      },
      {
        name: 'tasks',
        description: 'Task assignment and completion',
        persistent: true,
      },
      {
        name: 'data',
        description: 'Data requests and responses',
        persistent: false,
      },
      {
        name: 'status',
        description: 'Agent status updates',
        persistent: false,
      },
      {
        name: 'broadcast',
        description: 'System-wide broadcasts',
        persistent: false,
      },
    ];

    for (const config of defaultChannels) {
      this.createChannel(config);
    }
  }

  private async deliverMessage(
    channel: string,
    event: CommunicationEvent
  ): Promise<void> {
    const handlers = this.subscribers.get(channel);
    if (!handlers || handlers.size === 0) return;

    const startTime = Date.now();
    const deliveryPromises: Promise<void>[] = [];

    for (const handler of handlers) {
      // Apply filter if present
      if (handler.filter && !handler.filter(event)) {
        continue;
      }

      // Skip if message is addressed to specific agent
      if (event.recipient_agent && event.recipient_agent !== handler.agent_name) {
        continue;
      }

      // Expand compressed payload
      const expandedEvent = event.compressed
        ? { ...event, payload: this.expandMessage(event.payload) }
        : event;

      deliveryPromises.push(
        handler.handler(expandedEvent).catch((error) => {
          logger.error('Handler error for ${handler.agent_name}:', error instanceof Error ? error : undefined);
          this.updateStats(channel, 'failed_delivery');
        })
      );
    }

    await Promise.all(deliveryPromises);

    // Update latency stats
    const latency = Date.now() - startTime;
    this.updateLatencyStats(channel, latency);
  }

  private storeMessage(channel: string, event: CommunicationEvent): void {
    const history = this.messageHistory.get(channel) || [];
    history.push(event);

    // Apply retention policy
    const channelConfig = this.channels.get(channel);
    if (channelConfig?.message_retention) {
      while (history.length > channelConfig.message_retention) {
        history.shift();
      }
    }

    this.messageHistory.set(channel, history);
  }

  private shouldCompress(payload: any): boolean {
    const jsonString = JSON.stringify(payload);
    return jsonString.length > 1024; // Compress if > 1KB
  }

  private updateStats(
    channel: string,
    operation: 'publish' | 'subscribe' | 'unsubscribe' | 'failed_delivery'
  ): void {
    const stats = this.stats.get(channel);
    if (!stats) return;

    switch (operation) {
      case 'publish':
        stats.total_messages++;
        break;
      case 'subscribe':
        stats.active_subscribers++;
        break;
      case 'unsubscribe':
        stats.active_subscribers = Math.max(0, stats.active_subscribers - 1);
        break;
      case 'failed_delivery':
        stats.failed_deliveries++;
        break;
    }

    this.stats.set(channel, stats);
  }

  private updateLatencyStats(channel: string, latency: number): void {
    const stats = this.stats.get(channel);
    if (!stats) return;

    // Simple moving average
    stats.average_latency_ms =
      (stats.average_latency_ms * 0.9) + (latency * 0.1);

    this.stats.set(channel, stats);
  }

  private async publishToRedis(channel: string, event: CommunicationEvent): Promise<void> {
    if (!this.redis) return;
    try {
      await this.redis.publish(channel, JSON.stringify(event));
    } catch (error) {
      logger.error('Redis publish error', error instanceof Error ? error : undefined);
    }
  }

  private subscribeToRedis(
    channel: string,
    handler: (event: CommunicationEvent) => Promise<void>
  ): void {
    if (!this.redis) return;
    try {
      this.redis.subscribe(channel, (message: string) => {
        const event = JSON.parse(message) as CommunicationEvent;
        handler(event);
      });
    } catch (error) {
      logger.error('Redis subscribe error', error instanceof Error ? error : undefined);
    }
  }

  private async publishToNATS(channel: string, event: CommunicationEvent): Promise<void> {
    if (!this.nats) return;
    try {
      await this.nats.publish(channel, JSON.stringify(event));
    } catch (error) {
      logger.error('NATS publish error', error instanceof Error ? error : undefined);
    }
  }

  private subscribeToNATS(
    channel: string,
    handler: (event: CommunicationEvent) => Promise<void>
  ): void {
    if (!this.nats) return;
    try {
      this.nats.subscribe(channel, (message: string) => {
        const event = JSON.parse(message) as CommunicationEvent;
        handler(event);
      });
    } catch (error) {
      logger.error('NATS subscribe error', error instanceof Error ? error : undefined);
    }
  }
}

// Singleton instance
let messageBusInstance: MessageBus | null = null;

export function getMessageBus(config?: { redis?: any; nats?: any }): MessageBus {
  if (!messageBusInstance) {
    messageBusInstance = new MessageBus(config);
  }
  return messageBusInstance;
}

export default MessageBus;
