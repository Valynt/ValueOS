"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EVENT_TOPICS = void 0;
exports.createEvent = createEvent;
exports.createBaseEvent = createBaseEvent;
/**
 * Helper to create typed events
 */
function createEvent(type, payload, meta = {}) {
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
exports.EVENT_TOPICS = {
    SAGA_COMMANDS: "saga.commands",
    SAGA_EVENTS: "saga.events",
    WORKFLOW_EVENTS: "workflow.events",
    AGENT_REQUESTS: "agent.requests",
    AGENT_RESPONSES: "agent.responses",
    DEAD_LETTER: "dead.letter",
};
/**
 * Helper to create base events
 */
function createBaseEvent(type, payload, meta = {}) {
    return createEvent(type, payload, meta);
}
//# sourceMappingURL=events.js.map