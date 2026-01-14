/**
 * Service Message Bus Adapter
 *
 * Bridges non-agent services to SecureMessageBus for consistent security coverage.
 * Provides EventEmitter-compatible interface while routing through SecureMessageBus.
 *
 * Usage:
 * - Replace EventEmitter with ServiceMessageBusAdapter
 * - Maintains EventEmitter API while adding security
 * - Routes all messages through SecureMessageBus
 */

import { EventEmitter } from "events";
import { secureMessageBus, SecureMessage, MessagePriority } from "./SecureMessageBus";
import { AgentIdentity, createAgentIdentity } from "../auth/AgentIdentity";
import { logger } from "../../lib/logger";

export interface ServiceMessageOptions {
  priority?: MessagePriority;
  encrypted?: boolean;
  correlationId?: string;
}

/**
 * Adapter that provides EventEmitter interface while using SecureMessageBus
 */
export class ServiceMessageBusAdapter extends EventEmitter {
  private serviceIdentity: AgentIdentity;
  private serviceName: string;
  private organizationId: string;

  constructor(serviceName: string, organizationId: string = "default") {
    super();
    this.serviceName = serviceName;
    this.organizationId = organizationId;

    // Create service identity for SecureMessageBus
    this.serviceIdentity = createAgentIdentity({
      role: "system" as any, // Services use system role
      organizationId,
      parentSessionId: "service-session",
      initiatingUserId: "system",
      expirationSeconds: 7200,
    });

    // Register with SecureMessageBus
    this.registerWithMessageBus();
  }

  /**
   * Register service with SecureMessageBus
   */
  private registerWithMessageBus(): void {
    try {
      secureMessageBus.registerAgent(this.serviceIdentity);

      // Subscribe to service-specific messages
      secureMessageBus.subscribe(this.serviceIdentity.id, this.handleIncomingMessage.bind(this), [
        `${this.serviceName}:*`,
      ]);

      logger.debug("Service registered with SecureMessageBus", {
        service: this.serviceName,
        agentId: this.serviceIdentity.id,
      });
    } catch (error) {
      logger.warn("Failed to register service with SecureMessageBus", {
        service: this.serviceName,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Handle incoming messages from SecureMessageBus
   */
  private async handleIncomingMessage(
    message: SecureMessage,
    sender: AgentIdentity
  ): Promise<void> {
    try {
      // Extract event type from message payload
      const payload = message.payload as any;
      const eventType = payload.eventType;
      const eventData = payload.eventData;

      if (eventType) {
        // Emit using standard EventEmitter interface
        this.emit(eventType, eventData, message);
      }
    } catch (error) {
      logger.error("Error handling service message", error instanceof Error ? error : undefined, {
        service: this.serviceName,
        messageId: message.id,
      });
    }
  }

  /**
   * Emit an event through SecureMessageBus
   * Overrides EventEmitter.emit to use SecureMessageBus
   */
  async emitSecure(
    eventType: string,
    eventData: any,
    options: ServiceMessageOptions = {}
  ): Promise<SecureMessage> {
    const targetService = this.determineTargetService(eventType);

    const payload = {
      eventType,
      eventData,
      timestamp: new Date().toISOString(),
      source: this.serviceName,
    };

    try {
      const message = await secureMessageBus.send(this.serviceIdentity, targetService, payload, {
        priority: options.priority || "normal",
        encrypted: options.encrypted || false,
        correlationId: options.correlationId,
      });

      logger.debug("Service event sent via SecureMessageBus", {
        service: this.serviceName,
        eventType,
        targetService,
        messageId: message.id,
      });

      return message;
    } catch (error) {
      logger.error(
        "Failed to send service event via SecureMessageBus",
        error instanceof Error ? error : undefined,
        {
          service: this.serviceName,
          eventType,
          targetService,
        }
      );
      throw error;
    }
  }

  /**
   * Broadcast to all services
   */
  async broadcast(
    eventType: string,
    eventData: any,
    options: Omit<ServiceMessageOptions, "correlationId"> = {}
  ): Promise<SecureMessage> {
    const payload = {
      eventType,
      eventData,
      timestamp: new Date().toISOString(),
      source: this.serviceName,
    };

    try {
      const message = await secureMessageBus.broadcast(this.serviceIdentity, payload, {
        priority: options.priority || "normal",
      });

      logger.debug("Service broadcast sent via SecureMessageBus", {
        service: this.serviceName,
        eventType,
        messageId: message.id,
      });

      return message;
    } catch (error) {
      logger.error(
        "Failed to broadcast service event via SecureMessageBus",
        error instanceof Error ? error : undefined,
        {
          service: this.serviceName,
          eventType,
        }
      );
      throw error;
    }
  }

  /**
   * Determine target service based on event type
   */
  private determineTargetService(eventType: string): string {
    // Extract target service from event type pattern
    // Example: "workflow:stage_completed" -> "workflow-service"
    const parts = eventType.split(":");
    if (parts.length > 1) {
      return `${parts[0]}-service`;
    }

    // Default to broadcast if no specific target
    return "broadcast";
  }

  /**
   * Create a service-specific adapter
   */
  static create(serviceName: string, organizationId?: string): ServiceMessageBusAdapter {
    return new ServiceMessageBusAdapter(serviceName, organizationId);
  }
}

/**
 * External API Adapter for routing external calls through SecureMessageBus
 */
export class ExternalAPIAdapter {
  private serviceIdentity: AgentIdentity;
  private serviceName: string;
  private organizationId: string;

  constructor(serviceName: string, organizationId: string = "default") {
    this.serviceName = serviceName;
    this.organizationId = organizationId;

    this.serviceIdentity = createAgentIdentity({
      role: "system" as any,
      organizationId,
      parentSessionId: "external-api-session",
      initiatingUserId: "system",
      expirationSeconds: 7200,
    });

    secureMessageBus.registerAgent(this.serviceIdentity);
  }

  /**
   * Make external API call with security controls
   */
  async callExternalAPI(
    apiName: string,
    endpoint: string,
    options: {
      method?: "GET" | "POST" | "PUT" | "DELETE";
      headers?: Record<string, string>;
      body?: any;
      timeout?: number;
    } = {}
  ): Promise<any> {
    const startTime = Date.now();

    try {
      // Log the external API call
      logger.info("External API call initiated", {
        service: this.serviceName,
        apiName,
        endpoint,
        method: options.method || "GET",
      });

      // Make the actual API call
      const response = await fetch(endpoint, {
        method: options.method || "GET",
        headers: {
          "Content-Type": "application/json",
          ...options.headers,
        },
        body: options.body ? JSON.stringify(options.body) : undefined,
      });

      const result = await response.json();

      // Log successful completion
      logger.info("External API call completed", {
        service: this.serviceName,
        apiName,
        endpoint,
        status: response.status,
        duration: Date.now() - startTime,
      });

      return result;
    } catch (error) {
      logger.error("External API call failed", error instanceof Error ? error : undefined, {
        service: this.serviceName,
        apiName,
        endpoint,
        duration: Date.now() - startTime,
      });
      throw error;
    }
  }
}
