/**
 * Event-Driven Architecture for MCP Financial Ground Truth
 *
 * Provides asynchronous message queuing and event sourcing for:
 * - Financial data updates and processing
 * - AI analysis triggers and results
 * - Real-time streaming events
 * - System notifications and alerts
 *
 * Uses Redis pub/sub for message queuing with event replay capabilities.
 */

import { createClient, RedisClientType } from "redis";
import { logger } from "../../lib/logger";
import { getCache } from "../core/Cache";

export interface Event {
  id: string;
  type: string;
  source: string;
  timestamp: number;
  data: any;
  metadata?: {
    correlationId?: string;
    causationId?: string;
    userId?: string;
    priority?: "low" | "medium" | "high" | "critical";
    ttl?: number; // Time to live in seconds
  };
}

export interface EventHandler {
  eventType: string;
  handler: (event: Event) => Promise<void>;
  priority?: number; // Higher numbers = higher priority
}

export interface EventSubscription {
  id: string;
  eventTypes: string[];
  handler: EventHandlerFunction;
  options?: {
    durable?: boolean; // Persist subscription across restarts
    retryPolicy?: {
      maxRetries: number;
      backoffMs: number;
    };
  };
}

type EventHandlerFunction = (event: Event) => Promise<void>;

export class EventBus {
  private redisPublisher: RedisClientType;
  private redisSubscriber: RedisClientType;
  private handlers: Map<string, EventHandler[]> = new Map();
  private subscriptions: Map<string, EventSubscription> = new Map();
  private eventHistory: Event[] = [];
  private maxHistorySize = 1000;
  private cache = getCache();
  private isConnected = false;

  constructor(redisUrl?: string) {
    const url = redisUrl || process.env.REDIS_URL || "redis://localhost:6379";

    this.redisPublisher = createClient({ url });
    this.redisSubscriber = createClient({ url });

    this.setupEventHandlers();
  }

  /**
   * Connect to Redis and initialize the event bus
   */
  async connect(): Promise<void> {
    try {
      await Promise.all([
        this.redisPublisher.connect(),
        this.redisSubscriber.connect(),
      ]);

      this.isConnected = true;

      // Subscribe to all events
      await this.redisSubscriber.subscribe("mcp-events", (message) => {
        this.handleIncomingEvent(message);
      });

      logger.info("EventBus connected to Redis");
    } catch (error) {
      logger.error(
        "Failed to connect EventBus to Redis",
        error instanceof Error ? error : undefined
      );
      throw error;
    }
  }

  /**
   * Disconnect from Redis
   */
  async disconnect(): Promise<void> {
    try {
      await Promise.all([
        this.redisPublisher.disconnect(),
        this.redisSubscriber.disconnect(),
      ]);

      this.isConnected = false;
      logger.info("EventBus disconnected from Redis");
    } catch (error) {
      logger.error(
        "Error disconnecting EventBus",
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Publish an event to the event bus
   */
  async publish(event: Omit<Event, "id" | "timestamp">): Promise<string> {
    if (!this.isConnected) {
      throw new Error("EventBus is not connected");
    }

    const eventId = `evt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const fullEvent: Event = {
      ...event,
      id: eventId,
      timestamp: Date.now(),
    };

    try {
      // Store in history
      this.addToHistory(fullEvent);

      // Publish to Redis
      await this.redisPublisher.publish(
        "mcp-events",
        JSON.stringify(fullEvent)
      );

      // Cache recent events
      await this.cache.set(`event:${eventId}`, fullEvent, "tier2");

      logger.debug("Event published", {
        eventId,
        eventType: event.type,
        source: event.source,
      });

      return eventId;
    } catch (error) {
      logger.error(
        "Failed to publish event",
        error instanceof Error ? error : undefined,
        {
          eventType: event.type,
          source: event.source,
        }
      );
      throw error;
    }
  }

  /**
   * Subscribe to specific event types
   */
  subscribe(
    eventTypes: string[],
    handler: EventHandlerFunction,
    options?: EventSubscription["options"]
  ): string {
    const subscriptionId = `sub_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    const subscription: EventSubscription = {
      id: subscriptionId,
      eventTypes: Array.isArray(eventTypes) ? eventTypes : [eventTypes],
      handler,
      options: options || {},
    };

    this.subscriptions.set(subscriptionId, subscription);

    // Register handlers
    for (const eventType of subscription.eventTypes) {
      if (!this.handlers.has(eventType)) {
        this.handlers.set(eventType, []);
      }
      this.handlers.get(eventType)!.push({
        eventType,
        handler: subscription.handler,
        priority: 0,
      });
    }

    logger.info("Event subscription created", {
      subscriptionId,
      eventTypes: subscription.eventTypes,
      durable: options?.durable,
    });

    return subscriptionId;
  }

  /**
   * Unsubscribe from events
   */
  unsubscribe(subscriptionId: string): boolean {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) return false;

    // Remove handlers
    for (const eventType of subscription.eventTypes) {
      const eventHandlers = this.handlers.get(eventType);
      if (eventHandlers) {
        const filtered = eventHandlers.filter(
          (h) => h.handler !== subscription.handler
        );
        if (filtered.length === 0) {
          this.handlers.delete(eventType);
        } else {
          this.handlers.set(eventType, filtered);
        }
      }
    }

    this.subscriptions.delete(subscriptionId);

    logger.info("Event subscription removed", { subscriptionId });
    return true;
  }

  /**
   * Register an event handler with priority
   */
  registerHandler(
    eventType: string,
    handler: EventHandlerFunction,
    priority: number = 0
  ): void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, []);
    }

    this.handlers.get(eventType)!.push({
      eventType,
      handler,
      priority,
    });

    // Sort by priority (highest first)
    this.handlers
      .get(eventType)!
      .sort((a, b) => (b.priority || 0) - (a.priority || 0));

    logger.debug("Event handler registered", { eventType, priority });
  }

  /**
   * Replay events from history
   */
  async replayEvents(
    eventTypes?: string[],
    fromTimestamp?: number,
    toTimestamp?: number
  ): Promise<Event[]> {
    let events = [...this.eventHistory];

    if (eventTypes && eventTypes.length > 0) {
      events = events.filter((e) => eventTypes.includes(e.type));
    }

    if (fromTimestamp) {
      events = events.filter((e) => e.timestamp >= fromTimestamp);
    }

    if (toTimestamp) {
      events = events.filter((e) => e.timestamp <= toTimestamp);
    }

    logger.info("Replaying events", {
      totalEvents: events.length,
      eventTypes,
      fromTimestamp,
      toTimestamp,
    });

    // Process events asynchronously
    for (const event of events) {
      await this.processEvent(event);
    }

    return events;
  }

  /**
   * Get event history
   */
  getEventHistory(limit: number = 100, eventTypes?: string[]): Event[] {
    let events = [...this.eventHistory];

    if (eventTypes && eventTypes.length > 0) {
      events = events.filter((e) => eventTypes.includes(e.type));
    }

    return events.slice(-limit);
  }

  /**
   * Handle incoming events from Redis
   */
  private async handleIncomingEvent(message: string): Promise<void> {
    try {
      const event: Event = JSON.parse(message);
      await this.processEvent(event);
    } catch (error) {
      logger.error(
        "Error processing incoming event",
        error instanceof Error ? error : undefined,
        {
          message: message.substring(0, 200),
        }
      );
    }
  }

  /**
   * Process an event through registered handlers
   */
  private async processEvent(event: Event): Promise<void> {
    const handlers = this.handlers.get(event.type) || [];
    const wildcardHandlers = this.handlers.get("*") || [];

    const allHandlers = [...handlers, ...wildcardHandlers];

    if (allHandlers.length === 0) {
      logger.debug("No handlers found for event", { eventType: event.type });
      return;
    }

    logger.debug("Processing event", {
      eventId: event.id,
      eventType: event.type,
      handlersCount: allHandlers.length,
    });

    // Process handlers concurrently
    const promises = allHandlers.map((handler) =>
      this.executeHandler(handler, event).catch((error) => {
        logger.error(
          "Event handler failed",
          error instanceof Error ? error : undefined,
          {
            eventId: event.id,
            eventType: event.type,
            handler: handler.eventType,
          }
        );
      })
    );

    await Promise.allSettled(promises);
  }

  /**
   * Execute a single event handler
   */
  private async executeHandler(
    handler: EventHandler,
    event: Event
  ): Promise<void> {
    try {
      await handler.handler(event);
    } catch (error) {
      logger.error(
        "Event handler execution failed",
        error instanceof Error ? error : undefined,
        {
          eventType: event.type,
          handlerPriority: handler.priority,
        }
      );
      throw error;
    }
  }

  /**
   * Add event to history
   */
  private addToHistory(event: Event): void {
    this.eventHistory.push(event);

    // Maintain max history size
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory.shift();
    }
  }

  /**
   * Set up default event handlers
   */
  private setupEventHandlers(): void {
    // Log all events
    this.registerHandler(
      "*",
      async (event: Event) => {
        logger.debug("Event processed", {
          eventId: event.id,
          eventType: event.type,
          source: event.source,
          correlationId: event.metadata?.correlationId,
        });
      },
      -100
    ); // Low priority logging

    // Handle system events
    this.registerHandler(
      "system.health",
      async (event: Event) => {
        logger.info("System health event", {
          component: event.data.component,
          status: event.data.status,
          metrics: event.data.metrics,
        });
      },
      10
    );

    // Handle error events
    this.registerHandler(
      "system.error",
      async (event: Event) => {
        logger.error("System error event", {
          component: event.data.component,
          error: event.data.error,
          context: event.data.context,
        });
      },
      50
    );
  }

  /**
   * Get event bus statistics
   */
  getStats(): {
    isConnected: boolean;
    totalSubscriptions: number;
    activeEventTypes: string[];
    eventHistorySize: number;
    handlerCounts: Record<string, number>;
  } {
    const handlerCounts: Record<string, number> = {};
    for (const [eventType, handlers] of this.handlers.entries()) {
      handlerCounts[eventType] = handlers.length;
    }

    return {
      isConnected: this.isConnected,
      totalSubscriptions: this.subscriptions.size,
      activeEventTypes: Array.from(this.handlers.keys()),
      eventHistorySize: this.eventHistory.length,
      handlerCounts,
    };
  }
}

// Singleton instance
let defaultEventBus: EventBus | null = null;

/**
 * Get default event bus instance
 */
export function getEventBus(): EventBus {
  if (!defaultEventBus) {
    defaultEventBus = new EventBus();
  }
  return defaultEventBus;
}

/**
 * Set custom event bus instance
 */
export function setEventBus(eventBus: EventBus): void {
  if (defaultEventBus) {
    // Disconnect existing instance
    defaultEventBus.disconnect().catch((error) => {
      logger.error(
        "Error disconnecting previous event bus",
        error instanceof Error ? error : undefined
      );
    });
  }
  defaultEventBus = eventBus;
}

// Export convenience functions
export const publishEvent = (event: Omit<Event, "id" | "timestamp">) =>
  getEventBus().publish(event);
export const subscribeToEvents = (
  eventTypes: string[],
  handler: EventHandlerFunction,
  options?: EventSubscription["options"]
) => getEventBus().subscribe(eventTypes, handler, options);
