/**
 * Event Schema Definitions for Event-Driven Architecture
 *
 * Defines the structure of events used in agent communications,
 * workflow orchestration, and audit trails.
 */

export interface BaseEvent {
  eventId: string;
  correlationId: string;
  eventType: string;
  timestamp: Date;
  version: string;
  source: string;
  metadata?: Record<string, any>;
}

/**
 * Agent Request Event
 * Published when an agent invocation is requested
 */
export interface AgentRequestEvent extends BaseEvent {
  eventType: "agent.request";
  payload: {
    agentId: string;
    userId: string;
    sessionId?: string;
    tenantId?: string;
    query: string;
    context?: any;
    parameters?: Record<string, any>;
    priority?: "low" | "normal" | "high" | "critical";
    timeout?: number; // milliseconds
  };
}

/**
 * Agent Response Event
 * Published when an agent completes execution
 */
export interface AgentResponseEvent extends BaseEvent {
  eventType: "agent.response";
  payload: {
    agentId: string;
    userId: string;
    sessionId?: string;
    tenantId?: string;
    response: any;
    error?: string;
    latency: number;
    tokens?: {
      prompt: number;
      completion: number;
      total: number;
    };
    cost?: number;
    cached?: boolean;
    status: "success" | "error" | "timeout" | "cancelled";
  };
}

/**
 * Workflow Step Event
 * Published for each step in a workflow execution
 */
export interface WorkflowStepEvent extends BaseEvent {
  eventType: "workflow.step";
  payload: {
    workflowId: string;
    stepId: string;
    workflowType: string;
    stepType:
      | "agent_call"
      | "data_processing"
      | "decision"
      | "webhook"
      | "notification";
    status: "started" | "completed" | "failed" | "compensating" | "compensated";
    input: any;
    output?: any;
    error?: string;
    duration?: number;
    retryCount?: number;
  };
}

/**
 * Saga Command Event
 * Used for saga orchestration and compensation
 */
export interface SagaCommandEvent extends BaseEvent {
  eventType: "saga.command";
  payload: {
    sagaId: string;
    sagaType: string;
    command:
      | "start_saga"
      | "complete_step"
      | "compensate_step"
      | "complete_saga"
      | "abort_saga";
    stepId?: string;
    payload: any;
    reason?: string;
  };
}

/**
 * Audit Event
 * Published for all significant system actions
 */
export interface AuditEvent extends BaseEvent {
  eventType: "audit.log";
  payload: {
    action: string;
    actor: {
      type: "user" | "agent" | "system" | "service";
      id: string;
      name?: string;
    };
    resource: {
      type: string;
      id: string;
      name?: string;
    };
    operation: string;
    details?: any;
    ipAddress?: string;
    userAgent?: string;
    severity: "low" | "medium" | "high" | "critical";
    tags?: string[];
  };
}

/**
 * Union type for all event types
 */
export type Event =
  | AgentRequestEvent
  | AgentResponseEvent
  | WorkflowStepEvent
  | SagaCommandEvent
  | AuditEvent;

/**
 * Event topics configuration
 */
export const EVENT_TOPICS = {
  AGENT_REQUESTS: "agent-requests",
  AGENT_RESPONSES: "agent-responses",
  WORKFLOW_EVENTS: "workflow-events",
  SAGA_COMMANDS: "saga-commands",
  AUDIT_EVENTS: "audit-events",
  DEAD_LETTER: "dead-letter-queue",
} as const;

/**
 * Event schema versions
 */
export const EVENT_VERSIONS = {
  AGENT_REQUEST: "1.0.0",
  AGENT_RESPONSE: "1.0.0",
  WORKFLOW_STEP: "1.0.0",
  SAGA_COMMAND: "1.0.0",
  AUDIT_LOG: "1.0.0",
} as const;

/**
 * Helper function to create base event structure
 */
export function createBaseEvent(
  eventType: string,
  correlationId: string,
  source: string,
  metadata?: Record<string, any>
): BaseEvent {
  return {
    eventId: crypto.randomUUID(),
    correlationId,
    eventType,
    timestamp: new Date(),
    version: "1.0.0",
    source,
    metadata,
  };
}
