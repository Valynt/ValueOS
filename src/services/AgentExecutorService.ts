/**
 * Agent Executor Service
 *
 * Consumes agent request events from Kafka, executes agents,
 * and publishes agent response events.
 */

import { createEventConsumer, EventConsumer } from "./EventConsumer";
import { getEventProducer } from "./EventProducer";
import { getUnifiedAgentAPI } from "./UnifiedAgentAPI";
import { getEventSourcingService } from "./EventSourcingService";
import {
  AgentRequestEvent,
  AgentResponseEvent,
  EVENT_TOPICS,
  createBaseEvent,
  BaseEvent,
  Event,
} from "../types/events";
import { AgentType } from "./agent-types";
import { logger } from "../lib/logger";
import { registerShutdownHandler } from "../lib/shutdown/gracefulShutdown";

export class AgentExecutorService {
  private consumer: EventConsumer;
  private eventProducer = getEventProducer();
  private eventSourcing = getEventSourcingService();
  private unifiedAgentAPI = getUnifiedAgentAPI();

  constructor() {
    // Create consumer for agent requests
    this.consumer = createEventConsumer(
      "agent-executor",
      [EVENT_TOPICS.AGENT_REQUESTS],
      [
        {
          eventType: "agent.request",
          handler: async (event: BaseEvent) => {
            await this.handleAgentRequest(event as AgentRequestEvent);
          },
        },
      ]
    );
  }

  /**
   * Start the agent executor service
   */
  async start(): Promise<void> {
    await this.consumer.connect();
    await this.consumer.subscribe();

    logger.info("Agent executor service started");
  }

  /**
   * Stop the agent executor service
   */
  async stop(): Promise<void> {
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
      const agentResponseEvent: AgentResponseEvent = {
        ...createBaseEvent(
          "agent.response",
          event.correlationId,
          "agent-executor"
        ),
        eventType: "agent.response" as const,
        payload: {
          agentId: payload.agentId,
          userId: payload.userId,
          sessionId: payload.sessionId,
          tenantId: payload.tenantId,
          response: response.data || response,
          error: response.success === false ? response.error : undefined,
          latency,
          tokens: response.metadata?.tokens,
          cost: response.metadata?.tokens
            ? response.metadata.tokens.total * 0.00001
            : undefined,
          cached: false,
          status: response.success !== false ? "success" : "error",
        },
      };

      // Publish response event
      await this.eventProducer.publish(
        EVENT_TOPICS.AGENT_RESPONSES,
        agentResponseEvent
      );

      // Store events for audit trail
      await this.eventSourcing.storeEvent(event);
      await this.eventSourcing.storeEvent(agentResponseEvent);

      // Update audit projection
      await this.eventSourcing.updateProjection(
        "agent-performance",
        payload.agentId,
        event,
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
        ...createBaseEvent(
          "agent.response",
          event.correlationId,
          "agent-executor"
        ),
        eventType: "agent.response" as const,
        payload: {
          agentId: payload.agentId,
          userId: payload.userId,
          sessionId: payload.sessionId,
          tenantId: payload.tenantId,
          response: null,
          error: error instanceof Error ? error.message : "Unknown error",
          latency,
          status: "error",
        },
      };

      // Publish error response event
      await this.eventProducer.publish(
        EVENT_TOPICS.AGENT_RESPONSES,
        errorResponseEvent
      );

      // Store events for audit trail
      await this.eventSourcing.storeEvent(event);
      await this.eventSourcing.storeEvent(errorResponseEvent);

      // Update error metrics
      await this.eventSourcing.updateProjection(
        "agent-errors",
        payload.agentId,
        event,
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
        ...createBaseEvent(
          "agent.dlq",
          originalEvent.correlationId,
          "agent-executor"
        ),
        metadata: {
          originalEventId: originalEvent.eventId,
          originalEventType: originalEvent.eventType,
          errorMessage: error.message,
          errorName: error.name,
          errorStack: error.stack,
          failedAt: new Date().toISOString(),
          agentId: originalEvent.payload.agentId,
          userId: originalEvent.payload.userId,
          tenantId: originalEvent.payload.tenantId,
        },
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
      const agentEvent = event as AgentRequestEvent;
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
      const agentEvent = event as AgentRequestEvent;
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
      currentData.errorTypes[errorType] =
        (currentData.errorTypes[errorType] || 0) + 1;

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
