/**
 * Agent Executor Service
 *
 * Consumes agent request events from Kafka, executes agents,
 * and publishes agent response events.
 */

import { randomUUID } from "node:crypto";

import {
  AgentRequestEvent,
  BaseEvent,
  createBaseEvent,
  Event,
  EVENT_TOPICS,
} from "@shared/types/events";

import { createEventConsumer, EventConsumer } from "./EventConsumer.js"
import { EventProducer, getEventProducer } from "./EventProducer.js"
import { EventSourcingService, getEventSourcingService } from "./EventSourcingService.js"
import { isKafkaEnabled } from "./kafkaConfig.js"
import { getUnifiedAgentAPI } from "./UnifiedAgentAPI.js"

// AgentResponseEvent is not in shared types; define locally
interface AgentResponseEvent extends BaseEvent {
  type: "agent.response";
  payload: {
    agentId: string;
    userId: string;
    sessionId: string;
    tenantId: string;
    response: unknown;
    success: boolean;
    error?: string;
    duration_ms: number;
  };
}
import { AgentType } from "./agent-types.js"

import { logger } from "../../lib/logger.js"
import { registerShutdownHandler } from "../lib/shutdown/gracefulShutdown.js"

export class AgentExecutorService {
  private _consumer: EventConsumer | null = null;
  private _eventProducer: EventProducer | null = null;
  private _eventSourcing: EventSourcingService | null = null;

  private get consumer(): EventConsumer {
    if (!this._consumer) {
      this._consumer = createEventConsumer(
        "agent-executor",
        [EVENT_TOPICS.AGENT_REQUESTS],
        [
          {
            eventType: "agent.request",
            handler: async (event: BaseEvent) => {
              await this.handleAgentRequest(event as unknown as AgentRequestEvent);
            },
          },
        ]
      );
    }
    return this._consumer;
  }

  private get eventProducer(): EventProducer {
    if (!this._eventProducer) {
      this._eventProducer = getEventProducer();
    }
    return this._eventProducer;
  }

  private get eventSourcing(): EventSourcingService {
    if (!this._eventSourcing) {
      this._eventSourcing = getEventSourcingService();
    }
    return this._eventSourcing;
  }
  private unifiedAgentAPI = getUnifiedAgentAPI();

  /**
   * Start the agent executor service.
   *
   * When KAFKA_ENABLED is false (the default for dev/staging), the Kafka consumer
   * is not started. Agent requests are handled via direct execution on the invoke
   * endpoint instead. Set KAFKA_ENABLED=true only when a Kafka broker is available.
   */
  async start(): Promise<void> {
    if (!isKafkaEnabled()) {
      logger.info("Kafka disabled — agent requests handled via direct execution on the invoke endpoint");
      return;
    }
    await this.consumer.connect();
    await this.consumer.subscribe();
    logger.info("Agent executor service started (Kafka mode)");
  }

  /**
   * Stop the agent executor service
   */
  async stop(): Promise<void> {
    if (!isKafkaEnabled()) {
      return;
    }
    await this.consumer.disconnect();
    logger.info("Agent executor service stopped");
  }

  /**
   * Handle agent request events
   */
  private async handleAgentRequest(event: AgentRequestEvent): Promise<void> {
    const { payload } = event;
    const startTime = Date.now();

    logger.info("Processing agent request", {
      agentId: payload.agentId,
      correlationId: event.correlationId,
      userId: payload.userId,
      sessionId: payload.sessionId,
    });

    try {
      // Execute the agent
      const response = await this.unifiedAgentAPI.invoke({
        agent: payload.agentId as AgentType,
        query: payload.query,
        context: payload.context,
        parameters: payload.parameters,
        sessionId: payload.sessionId,
        userId: payload.userId,
      });

      const latency = Date.now() - startTime;

      // Create agent response event
      const responsePayload = {
        agentId: payload.agentId,
        userId: payload.userId,
        sessionId: payload.sessionId,
        tenantId: payload.tenantId,
        response: response.data || response,
        success: response.success !== false,
        error: response.success === false ? response.error : undefined,
        duration_ms: latency,
      };

      const agentResponseEvent: AgentResponseEvent = {
        type: "agent.response",
        payload: responsePayload,
        correlationId: event.correlationId,
        meta: { eventId: randomUUID(), timestamp: new Date().toISOString(), source: "agent-executor" },
      };

      // Publish response event
      await this.eventProducer.publish(EVENT_TOPICS.AGENT_RESPONSES, agentResponseEvent as unknown as BaseEvent);

      // Broadcast to realtime clients in the tenant
      try {
        const broadcastService = (await import("./RealtimeBroadcastService.js")).getRealtimeBroadcastService();
        broadcastService.broadcastToTenant(
          responsePayload.tenantId,
          "agent.reasoning.update",
          {
            agentId: responsePayload.agentId,
            sessionId: responsePayload.sessionId,
            response: responsePayload.response,
            success: responsePayload.success,
            correlationId: agentResponseEvent.correlationId,
            timestamp: agentResponseEvent.meta?.timestamp || new Date().toISOString(),
          }
        );

        // If IntegrityAgent reported a resolved issue, emit a dedicated event
        const responseData = responsePayload.response as Record<string, unknown> | null;
        if (responsePayload.agentId === "IntegrityAgent" && responseData && (responseData.resolvedIssueId || responseData.issueId)) {
          const issueId = responseData.resolvedIssueId || responseData.issueId;
          broadcastService.broadcastToTenant(responsePayload.tenantId, "integrity.issue.resolved", {
            issueId,
            agentId: responsePayload.agentId,
            result: responseData,
          });
        }
      } catch (bErr) {
        logger.warn("Realtime broadcast failed", { error: bErr instanceof Error ? bErr.message : String(bErr) });
      }

      // Store events for audit trail
      await this.eventSourcing.storeEvent(event as unknown as BaseEvent);
      await this.eventSourcing.storeEvent(agentResponseEvent as unknown as BaseEvent);

      // Update audit projection
      await this.eventSourcing.updateProjection(
        "agent-performance",
        payload.agentId,
        event as unknown as BaseEvent,
        this.createAgentPerformanceUpdater()
      );

      logger.info("Agent request completed successfully", {
        agentId: payload.agentId,
        correlationId: event.correlationId,
        latency,
        tokens: response.metadata?.tokens?.total,
      });
    } catch (error) {
      const latency = Date.now() - startTime;

      logger.error("Agent request failed", error as Error, {
        agentId: payload.agentId,
        correlationId: event.correlationId,
        latency,
      });

      // Create error response event
      const errorResponseEvent: AgentResponseEvent = {
        type: "agent.response",
        payload: {
          agentId: payload.agentId,
          userId: payload.userId,
          sessionId: payload.sessionId,
          tenantId: payload.tenantId,
          response: null,
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
          duration_ms: latency,
        },
        correlationId: event.correlationId,
        meta: { eventId: randomUUID(), timestamp: new Date().toISOString(), source: "agent-executor" },
      };

      // Publish error response event
      await this.eventProducer.publish(EVENT_TOPICS.AGENT_RESPONSES, errorResponseEvent as unknown as BaseEvent);
      // Broadcast response to websocket subscribers (tenant-scoped)
      try {
        const { getRealtimeBroadcastService } = await import("./RealtimeBroadcastService.js");
        getRealtimeBroadcastService().broadcastToTenant(
          payload.tenantId,
          "agent.reasoning.update",
          {
            agentId: payload.agentId,
            sessionId: payload.sessionId,
            response: null,
            success: false,
            error: errorResponseEvent.payload.error,
          }
        );
      } catch (err) {
        logger.warn("Realtime broadcast failed, continuing", { error: err instanceof Error ? err.message : String(err) });
      }
      // Store events for audit trail
      await this.eventSourcing.storeEvent(event as unknown as BaseEvent);
      await this.eventSourcing.storeEvent(errorResponseEvent as unknown as BaseEvent);

      // Update error metrics
      await this.eventSourcing.updateProjection(
        "agent-errors",
        payload.agentId,
        event as unknown as BaseEvent,
        this.createAgentErrorUpdater(error as Error)
      );

      // Publish to Dead Letter Queue for failed requests
      await this.publishToDeadLetterQueue(event, error as Error);
    }
  }

  /**
   * Publish failed events to Dead Letter Queue for later analysis/retry
   */
  private async publishToDeadLetterQueue(
    originalEvent: AgentRequestEvent,
    error: Error
  ): Promise<void> {
    try {
      const dlqEvent: BaseEvent = {
        type: "agent.dlq",
        correlationId: originalEvent.correlationId,
        payload: {
          originalEventType: originalEvent.type,
          errorMessage: error.message,
          errorName: error.name,
          failedAt: new Date().toISOString(),
          agentId: originalEvent.payload.agentId,
          userId: originalEvent.payload.userId,
          tenantId: originalEvent.payload.tenantId,
        },
        meta: { eventId: randomUUID(), timestamp: new Date().toISOString(), source: "agent-executor" },
      };

      await this.eventProducer.publish(EVENT_TOPICS.DEAD_LETTER, dlqEvent);

      logger.info("Failed event published to DLQ", {
        correlationId: originalEvent.correlationId,
        agentId: originalEvent.payload.agentId,
        errorMessage: error.message,
      });
    } catch (dlqError) {
      logger.error("Failed to publish to DLQ", dlqError as Error, {
        correlationId: originalEvent.correlationId,
      });
    }
  }

  /**
   * Create agent performance projection updater
   */
  private createAgentPerformanceUpdater() {
    return (currentData: any, event: Event) => {
      const agentEvent = event as unknown as AgentRequestEvent;
      if (!currentData) {
        currentData = {
          agentId: agentEvent.payload.agentId,
          totalRequests: 0,
          successfulRequests: 0,
          failedRequests: 0,
          averageLatency: 0,
          totalTokens: 0,
          totalCost: 0,
          cacheHitRate: 0,
          recentRequests: [],
        };
      }

      currentData.totalRequests += 1;

      // This would be updated when response event is processed
      // For now, just track request counts

      return currentData;
    };
  }

  /**
   * Create agent error projection updater
   */
  private createAgentErrorUpdater(error: Error) {
    return (currentData: any, event: Event) => {
      const agentEvent = event as unknown as AgentRequestEvent;
      if (!currentData) {
        currentData = {
          agentId: agentEvent.payload.agentId,
          errorCount: 0,
          recentErrors: [],
          errorTypes: {},
        };
      }

      currentData.errorCount += 1;
      const errorType = error.name || "Unknown";
      currentData.errorTypes[errorType] = (currentData.errorTypes[errorType] || 0) + 1;

      currentData.recentErrors.push({
        timestamp: new Date().toISOString(),
        error: error.message,
        correlationId: event.correlationId,
      });

      // Keep only last 50 errors
      if (currentData.recentErrors.length > 50) {
        currentData.recentErrors = currentData.recentErrors.slice(-50);
      }

      return currentData;
    };
  }

  /**
   * Get service metrics
   */
  async getMetrics(): Promise<{
    consumerConnected: boolean;
    consumerSubscribed: boolean;
    processingCount: number;
  }> {
    const consumerMetrics = await this.consumer.getMetrics();
    return {
      consumerConnected: consumerMetrics.connected,
      consumerSubscribed: consumerMetrics.subscribed,
      processingCount: consumerMetrics.processingCount,
    };
  }
}

/**
 * Singleton agent executor service instance
 */
let agentExecutorService: AgentExecutorService | null = null;

export function getAgentExecutorService(): AgentExecutorService {
  if (!agentExecutorService) {
    agentExecutorService = new AgentExecutorService();
    // Register with graceful shutdown manager
    registerShutdownHandler(
      "AgentExecutorService",
      async () => {
        if (agentExecutorService) {
          await agentExecutorService.stop();
        }
      },
      5 // High priority - stop consuming before other services
    );
  }
  return agentExecutorService;
}

/**
 * Initialize the agent executor service
 */
export async function initializeAgentExecutor(): Promise<AgentExecutorService> {
  const service = getAgentExecutorService();
  await service.start();
  return service;
}

/**
 * Shutdown the agent executor service
 */
export async function shutdownAgentExecutor(): Promise<void> {
  if (agentExecutorService) {
    await agentExecutorService.stop();
  }
}
