"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.subscribeToEvents = exports.publishEvent = exports.EventBus = void 0;
exports.getEventBus = getEventBus;
exports.setEventBus = setEventBus;
const redis_1 = require("redis");
const logger_js_1 = require("../../lib/logger.js");
const Cache_js_1 = require("../core/Cache.js");
class EventBus {
    redisPublisher;
    redisSubscriber;
    handlers = new Map();
    subscriptions = new Map();
    eventHistory = [];
    maxHistorySize = 1000;
    cache = (0, Cache_js_1.getCache)();
    isConnected = false;
    constructor(redisUrl) {
        const url = redisUrl || process.env.REDIS_URL || "redis://localhost:6379";
        this.redisPublisher = (0, redis_1.createClient)({ url });
        this.redisSubscriber = (0, redis_1.createClient)({ url });
        this.setupEventHandlers();
    }
    /**
     * Connect to Redis and initialize the event bus
     */
    async connect() {
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
            logger_js_1.logger.info("EventBus connected to Redis");
        }
        catch (error) {
            logger_js_1.logger.error("Failed to connect EventBus to Redis", error instanceof Error ? error : undefined);
            throw error;
        }
    }
    /**
     * Disconnect from Redis
     */
    async disconnect() {
        try {
            await Promise.all([
                this.redisPublisher.disconnect(),
                this.redisSubscriber.disconnect(),
            ]);
            this.isConnected = false;
            logger_js_1.logger.info("EventBus disconnected from Redis");
        }
        catch (error) {
            logger_js_1.logger.error("Error disconnecting EventBus", error instanceof Error ? error : undefined);
        }
    }
    /**
     * Publish an event to the event bus
     */
    async publish(event) {
        if (!this.isConnected) {
            throw new Error("EventBus is not connected");
        }
        const eventId = `evt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        const fullEvent = {
            ...event,
            id: eventId,
            timestamp: Date.now(),
        };
        try {
            // Store in history
            this.addToHistory(fullEvent);
            // Publish to Redis
            await this.redisPublisher.publish("mcp-events", JSON.stringify(fullEvent));
            // Cache recent events
            await this.cache.set(`event:${eventId}`, fullEvent, "tier2");
            logger_js_1.logger.debug("Event published", {
                eventId,
                eventType: event.type,
                source: event.source,
            });
            return eventId;
        }
        catch (error) {
            logger_js_1.logger.error("Failed to publish event", error instanceof Error ? error : undefined, {
                eventType: event.type,
                source: event.source,
            });
            throw error;
        }
    }
    /**
     * Subscribe to specific event types
     */
    subscribe(eventTypes, handler, options) {
        const subscriptionId = `sub_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        const subscription = {
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
            this.handlers.get(eventType).push({
                eventType,
                handler: subscription.handler,
                priority: 0,
            });
        }
        logger_js_1.logger.info("Event subscription created", {
            subscriptionId,
            eventTypes: subscription.eventTypes,
            durable: options?.durable,
        });
        return subscriptionId;
    }
    /**
     * Unsubscribe from events
     */
    unsubscribe(subscriptionId) {
        const subscription = this.subscriptions.get(subscriptionId);
        if (!subscription)
            return false;
        // Remove handlers
        for (const eventType of subscription.eventTypes) {
            const eventHandlers = this.handlers.get(eventType);
            if (eventHandlers) {
                const filtered = eventHandlers.filter((h) => h.handler !== subscription.handler);
                if (filtered.length === 0) {
                    this.handlers.delete(eventType);
                }
                else {
                    this.handlers.set(eventType, filtered);
                }
            }
        }
        this.subscriptions.delete(subscriptionId);
        logger_js_1.logger.info("Event subscription removed", { subscriptionId });
        return true;
    }
    /**
     * Register an event handler with priority
     */
    registerHandler(eventType, handler, priority = 0) {
        if (!this.handlers.has(eventType)) {
            this.handlers.set(eventType, []);
        }
        this.handlers.get(eventType).push({
            eventType,
            handler,
            priority,
        });
        // Sort by priority (highest first)
        this.handlers
            .get(eventType)
            .sort((a, b) => (b.priority || 0) - (a.priority || 0));
        logger_js_1.logger.debug("Event handler registered", { eventType, priority });
    }
    /**
     * Replay events from history
     */
    async replayEvents(eventTypes, fromTimestamp, toTimestamp) {
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
        logger_js_1.logger.info("Replaying events", {
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
    getEventHistory(limit = 100, eventTypes) {
        let events = [...this.eventHistory];
        if (eventTypes && eventTypes.length > 0) {
            events = events.filter((e) => eventTypes.includes(e.type));
        }
        return events.slice(-limit);
    }
    /**
     * Handle incoming events from Redis
     */
    async handleIncomingEvent(message) {
        try {
            const event = JSON.parse(message);
            await this.processEvent(event);
        }
        catch (error) {
            logger_js_1.logger.error("Error processing incoming event", error instanceof Error ? error : undefined, {
                message: message.substring(0, 200),
            });
        }
    }
    /**
     * Process an event through registered handlers
     */
    async processEvent(event) {
        const handlers = this.handlers.get(event.type) || [];
        const wildcardHandlers = this.handlers.get("*") || [];
        const allHandlers = [...handlers, ...wildcardHandlers];
        if (allHandlers.length === 0) {
            logger_js_1.logger.debug("No handlers found for event", { eventType: event.type });
            return;
        }
        logger_js_1.logger.debug("Processing event", {
            eventId: event.id,
            eventType: event.type,
            handlersCount: allHandlers.length,
        });
        // Process handlers concurrently
        const promises = allHandlers.map((handler) => this.executeHandler(handler, event).catch((error) => {
            logger_js_1.logger.error("Event handler failed", error instanceof Error ? error : undefined, {
                eventId: event.id,
                eventType: event.type,
                handler: handler.eventType,
            });
        }));
        await Promise.allSettled(promises);
    }
    /**
     * Execute a single event handler
     */
    async executeHandler(handler, event) {
        try {
            await handler.handler(event);
        }
        catch (error) {
            logger_js_1.logger.error("Event handler execution failed", error instanceof Error ? error : undefined, {
                eventType: event.type,
                handlerPriority: handler.priority,
            });
            throw error;
        }
    }
    /**
     * Add event to history
     */
    addToHistory(event) {
        this.eventHistory.push(event);
        // Maintain max history size
        if (this.eventHistory.length > this.maxHistorySize) {
            this.eventHistory.shift();
        }
    }
    /**
     * Set up default event handlers
     */
    setupEventHandlers() {
        // Log all events
        this.registerHandler("*", async (event) => {
            logger_js_1.logger.debug("Event processed", {
                eventId: event.id,
                eventType: event.type,
                source: event.source,
                correlationId: event.metadata?.correlationId,
            });
        }, -100); // Low priority logging
        // Handle system events
        this.registerHandler("system.health", async (event) => {
            logger_js_1.logger.info("System health event", {
                component: event.data.component,
                status: event.data.status,
                metrics: event.data.metrics,
            });
        }, 10);
        // Handle error events
        this.registerHandler("system.error", async (event) => {
            logger_js_1.logger.error("System error event", {
                component: event.data.component,
                error: event.data.error,
                context: event.data.context,
            });
        }, 50);
    }
    /**
     * Get event bus statistics
     */
    getStats() {
        const handlerCounts = {};
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
exports.EventBus = EventBus;
// Singleton instance
let defaultEventBus = null;
/**
 * Get default event bus instance
 */
function getEventBus() {
    if (!defaultEventBus) {
        defaultEventBus = new EventBus();
    }
    return defaultEventBus;
}
/**
 * Set custom event bus instance
 */
function setEventBus(eventBus) {
    if (defaultEventBus) {
        // Disconnect existing instance
        defaultEventBus.disconnect().catch((error) => {
            logger_js_1.logger.error("Error disconnecting previous event bus", error instanceof Error ? error : undefined);
        });
    }
    defaultEventBus = eventBus;
}
// Export convenience functions
const publishEvent = (event) => getEventBus().publish(event);
exports.publishEvent = publishEvent;
const subscribeToEvents = (eventTypes, handler, options) => getEventBus().subscribe(eventTypes, handler, options);
exports.subscribeToEvents = subscribeToEvents;
//# sourceMappingURL=EventBus.js.map