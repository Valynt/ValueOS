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
 *       console.log(event.payload.userId);
 *       break;
 *     case 'agent.task.completed':
 *       console.log(event.payload.result);
 *       break;
 *   }
 * }
 */
/**
 * Helper to create typed events
 */
export function createEvent(type, payload, meta = {}) {
    return {
        type,
        payload,
        meta: {
            eventId: crypto.randomUUID(),
            timestamp: new Date().toISOString(),
            source: "unknown",
            ...meta,
        },
    };
}
/**
 * Event topics for message bus routing
 */
export const EVENT_TOPICS = {
    SAGA_COMMANDS: "saga.commands",
    WORKFLOW_EVENTS: "workflow.events",
    AGENT_REQUESTS: "agent.requests",
    AGENT_RESPONSES: "agent.responses",
    DEAD_LETTER: "dead.letter",
};
/**
 * Helper to create base events
 */
export function createBaseEvent(type, payload, meta = {}) {
    return createEvent(type, payload, meta);
}
//# sourceMappingURL=events.js.map