/**
 * Typed Domain Events
 *
 * Type-safe event contracts for cross-package communication.
 * Uses discriminated unions for exhaustive pattern matching.
 *
 * @example
 * function handleEvent(event: DomainEvent) {
 *   switch (event.type) {
 *     case 'user.created':
 *       logger.info(event.payload.userId);
 *       break;
 *     case 'agent.task.completed':
 *       logger.info(event.payload.result);
 *       break;
 *   }
 * }
 */
/**
 * Base event metadata included with all events
 */
export interface EventMeta {
    eventId: string;
    timestamp: string;
    source: string;
    correlationId?: string;
    causationId?: string;
}
/**
 * User domain events
 */
export type UserEvent = {
    type: "user.created";
    payload: {
        userId: string;
        tenantId: string;
        email: string;
    };
} | {
    type: "user.updated";
    payload: {
        userId: string;
        changes: Record<string, unknown>;
    };
} | {
    type: "user.deleted";
    payload: {
        userId: string;
        tenantId: string;
    };
} | {
    type: "user.role.changed";
    payload: {
        userId: string;
        oldRole: string;
        newRole: string;
    };
};
/**
 * Tenant domain events
 */
export type TenantEvent = {
    type: "tenant.created";
    payload: {
        tenantId: string;
        name: string;
        plan: string;
    };
} | {
    type: "tenant.plan.changed";
    payload: {
        tenantId: string;
        oldPlan: string;
        newPlan: string;
    };
} | {
    type: "tenant.suspended";
    payload: {
        tenantId: string;
        reason: string;
    };
};
/**
 * Agent domain events
 */
export type AgentEvent = {
    type: "agent.task.started";
    payload: {
        agentId: string;
        taskId: string;
        taskType: string;
    };
} | {
    type: "agent.task.completed";
    payload: {
        agentId: string;
        taskId: string;
        result: unknown;
        durationMs: number;
    };
} | {
    type: "agent.task.failed";
    payload: {
        agentId: string;
        taskId: string;
        error: string;
    };
} | {
    type: "agent.tool.invoked";
    payload: {
        agentId: string;
        toolName: string;
        input: unknown;
    };
};
/**
 * Memory domain events
 */
export type MemoryEvent = {
    type: "memory.stored";
    payload: {
        memoryId: string;
        type: string;
        vectorId?: string;
    };
} | {
    type: "memory.retrieved";
    payload: {
        memoryId: string;
        relevanceScore?: number;
    };
} | {
    type: "memory.deleted";
    payload: {
        memoryId: string;
    };
};
/**
 * System events
 */
export type SystemEvent = {
    type: "system.health.degraded";
    payload: {
        service: string;
        reason: string;
    };
} | {
    type: "system.health.recovered";
    payload: {
        service: string;
    };
} | {
    type: "system.rate.limited";
    payload: {
        tenantId: string;
        resource: string;
        limit: number;
    };
};
/**
 * All domain events union
 */
export type DomainEvent = UserEvent | TenantEvent | AgentEvent | MemoryEvent | SystemEvent;
/**
 * Event with metadata wrapper
 */
export type EnvelopedEvent<T extends DomainEvent = DomainEvent> = T & {
    meta: EventMeta;
};
/**
 * Extract event type string
 */
export type EventType = DomainEvent["type"];
/**
 * Extract payload type for a specific event type
 */
export type EventPayload<T extends EventType> = Extract<DomainEvent, {
    type: T;
}>["payload"];
/**
 * Event handler type
 */
export type EventHandler<T extends EventType> = (payload: EventPayload<T>, meta: EventMeta) => void | Promise<void>;
/**
 * Event registry for type-safe subscriptions
 */
export type EventHandlers = {
    [K in EventType]?: EventHandler<K>[];
};
/**
 * Helper to create typed events
 */
export declare function createEvent<T extends EventType>(type: T, payload: EventPayload<T>, meta?: Partial<EventMeta>): EnvelopedEvent<Extract<DomainEvent, {
    type: T;
}>>;
/**
 * Event topics for message bus routing
 */
export declare const EVENT_TOPICS: {
    readonly SAGA_COMMANDS: "saga.commands";
    readonly WORKFLOW_EVENTS: "workflow.events";
    readonly AGENT_REQUESTS: "agent.requests";
    readonly AGENT_RESPONSES: "agent.responses";
    readonly DEAD_LETTER: "dead.letter";
};
/**
 * Agent request event type
 */
export interface AgentRequestEvent {
    type: "agent.request";
    payload: {
        agentId: string;
        userId: string;
        sessionId?: string;
        tenantId: string;
        query: string;
        context?: Record<string, unknown>;
        parameters?: Record<string, unknown>;
        priority: string;
        timeout: number;
    };
    meta: EventMeta;
    [key: string]: any;
}
/**
 * Helper to create base events
 */
export declare function createBaseEvent<T extends EventType>(type: T, payload: EventPayload<T>, meta?: Partial<EventMeta>): EnvelopedEvent<Extract<DomainEvent, {
    type: T;
}>>;
//# sourceMappingURL=events.d.ts.map
