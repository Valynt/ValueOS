/**
 * Agent Message Broker
 *
 * Handles inter-agent communication through SecureMessageBus, ensuring all
 * agent-to-agent messages are properly logged, signed, and audited.
 * Replaces direct agent API calls with secure message passing.
 */

import { logger } from "@lib/logger";
import { v4 as uuidv4 } from "uuid";
import { BaseAgent } from "@lib/agent-fabric/agents/BaseAgent";
import {
  secureMessageBus,
  SecureMessage,
  MessagePriority,
} from "@lib/agent-fabric/SecureMessageBus";
import { AgentIdentity } from "@lib/auth/AgentIdentity";

// ============================================================================
// Types
// ============================================================================

export interface AgentMessageRequest {
  fromAgentId: string;
  toAgentId: string;
  payload: any;
  priority?: MessagePriority;
  encrypted?: boolean;
  correlationId?: string;
  timeoutMs?: number;
}

export interface AgentMessageResponse {
  success: boolean;
  message?: SecureMessage;
  response?: any;
  error?: string;
  deliveryTime: number;
}

export interface AgentRegistration {
  agentId: string;
  agentType: string;
  agentInstance: BaseAgent;
  identity: AgentIdentity;
}

// ============================================================================
// AgentMessageBroker Implementation
// ============================================================================

export class AgentMessageBroker {
  private agentRegistry = new Map<string, AgentRegistration>();
  private pendingMessages = new Map<
    string,
    {
      resolve: (response: AgentMessageResponse) => void;
      reject: (error: Error) => void;
      timeout: NodeJS.Timeout;
    }
  >();

  // Performance optimizations
  private messageQueue: AgentMessageRequest[] = [];
  private batchProcessing = false;
  private batchSize = 10;
  private batchTimeout = 50; // ms
  private batchTimer: NodeJS.Timeout | null = null;

  // Connection pooling
  private connectionPool = new Map<string, { lastUsed: number; inUse: boolean }>();
  private maxConnections = 50;
  private connectionTimeout = 30000; // 30 seconds

  constructor() {
    // Set up message bus subscription
    this.setupMessageHandling();

    // Start batch processing
    this.startBatchProcessing();
  }

  /**
   * Register an agent for message routing
   */
  registerAgent(registration: AgentRegistration): void {
    this.agentRegistry.set(registration.agentId, registration);

    logger.info("Agent registered with message broker", {
      agentId: registration.agentId,
      agentType: registration.agentType,
    });
  }

  /**
   * Unregister an agent
   */
  unregisterAgent(agentId: string): void {
    const registration = this.agentRegistry.get(agentId);
    if (registration) {
      this.agentRegistry.delete(agentId);
      logger.info("Agent unregistered from message broker", {
        agentId,
        agentType: registration.agentType,
      });
    }
  }

  /**
   * Send a message from one agent to another
   */
  async sendMessage(request: AgentMessageRequest): Promise<AgentMessageResponse> {
    const startTime = Date.now();

    try {
      // Validate recipient
      const recipient = this.agentRegistry.get(request.toAgentId);
      if (!recipient) {
        throw new Error(`Recipient agent not found: ${request.toAgentId}`);
      }

      // Validate sender
      const sender = this.agentRegistry.get(request.fromAgentId);
      if (!sender) {
        throw new Error(`Sender agent not found: ${request.fromAgentId}`);
      }

      // Generate correlation ID if not provided
      const correlationId = request.correlationId || uuidv4();

      // Set up response handling
      const responsePromise = new Promise<AgentMessageResponse>((resolve, reject) => {
        const timeout = setTimeout(() => {
          this.pendingMessages.delete(correlationId);
          reject(new Error(`Message timeout after ${request.timeoutMs || 30000}ms`));
        }, request.timeoutMs || 30000);

        this.pendingMessages.set(correlationId, { resolve, reject, timeout });
      });

      // Send the message via SecureMessageBus
      const message = await secureMessageBus.send(
        sender.identity,
        request.toAgentId,
        request.payload,
        {
          priority: request.priority || "normal",
          encrypted: request.encrypted || false,
          correlationId,
          replyTo: request.fromAgentId,
        }
      );

      logger.info("Message sent via SecureMessageBus", {
        messageId: message.id,
        fromAgentId: request.fromAgentId,
        toAgentId: request.toAgentId,
        correlationId,
      });

      // Wait for response
      const response = await responsePromise;
      response.deliveryTime = Date.now() - startTime;

      return response;
    } catch (error) {
      const deliveryTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      logger.error("Message sending failed", error instanceof Error ? error : undefined, {
        fromAgentId: request.fromAgentId,
        toAgentId: request.toAgentId,
        message: errorMessage,
        deliveryTime,
      });

      return {
        success: false,
        error: errorMessage,
        deliveryTime,
      };
    }
  }

  /**
   * Send a message and get response (simplified interface)
   */
  async sendToAgent<T = any>(
    fromAgentId: string,
    toAgentId: string,
    payload: any,
    options: {
      priority?: MessagePriority;
      encrypted?: boolean;
      timeoutMs?: number;
    } = {}
  ): Promise<{ success: boolean; data?: T; error?: string }> {
    const response = await this.sendMessage({
      fromAgentId,
      toAgentId,
      payload,
      ...options,
    });

    if (response.success && response.response) {
      return {
        success: true,
        data: response.response as T,
      };
    }

    return {
      success: false,
      error: response.error || "Unknown error",
    };
  }

  /**
   * Get registered agents
   */
  getRegisteredAgents(): AgentRegistration[] {
    return Array.from(this.agentRegistry.values());
  }

  /**
   * Get agent by ID
   */
  getAgent(agentId: string): AgentRegistration | undefined {
    return this.agentRegistry.get(agentId);
  }

  /**
   * Check if agent is registered
   */
  isAgentRegistered(agentId: string): boolean {
    return this.agentRegistry.has(agentId);
  }

  /**
   * Get message broker statistics
   */
  getStats(): {
    registeredAgents: number;
    pendingMessages: number;
    queuedMessages: number;
    activeConnections: number;
  } {
    const activeConnections = Array.from(this.connectionPool.values()).filter(
      (conn) => conn.inUse
    ).length;

    return {
      registeredAgents: this.agentRegistry.size,
      pendingMessages: this.pendingMessages.size,
      queuedMessages: this.messageQueue.length,
      activeConnections,
    };
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private startBatchProcessing(): void {
    // Process batched messages periodically
    this.batchTimer = setInterval(() => {
      if (this.messageQueue.length > 0 && !this.batchProcessing) {
        this.processBatch();
      }
    }, this.batchTimeout);
  }

  private async processBatch(): Promise<void> {
    if (this.batchProcessing || this.messageQueue.length === 0) {
      return;
    }

    this.batchProcessing = true;
    const batch = this.messageQueue.splice(0, this.batchSize);

    try {
      // Process messages in parallel
      await Promise.all(batch.map((request) => this.processMessage(request)));
    } catch (error) {
      logger.error("Error processing message batch", error instanceof Error ? error : undefined, {
        batchSize: batch.length,
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      this.batchProcessing = false;
    }
  }

  private async processMessage(request: AgentMessageRequest): Promise<void> {
    // Add to queue for batch processing
    this.messageQueue.push(request);

    // Trigger immediate processing if queue is getting full
    if (this.messageQueue.length >= this.batchSize) {
      setImmediate(() => this.processBatch());
    }
  }

  private setupMessageHandling(): void {
    // Subscribe to all messages for the broker
    secureMessageBus.subscribe(
      "message-broker",
      async (message: SecureMessage, sender: AgentIdentity) => {
        await this.handleIncomingMessage(message, sender);
      },
      ["*"]
    );
  }

  private async handleIncomingMessage(
    message: SecureMessage,
    sender: AgentIdentity
  ): Promise<void> {
    try {
      // Check if this is a response to a pending message
      if (message.correlationId && this.pendingMessages.has(message.correlationId)) {
        const pending = this.pendingMessages.get(message.correlationId)!;
        clearTimeout(pending.timeout);
        this.pendingMessages.delete(message.correlationId);

        const response: AgentMessageResponse = {
          success: true,
          message,
          response: message.payload,
          deliveryTime: 0,
        };

        pending.resolve(response);
        return;
      }

      // Route message to the intended recipient
      const recipient = this.agentRegistry.get(message.to);
      if (!recipient) {
        logger.warn("Message recipient not found", {
          messageId: message.id,
          toAgentId: message.to,
          fromAgentId: message.from,
        });
        return;
      }

      // Forward message to the recipient agent's public message handler
      // Note: We need to use a public method or create a message interface
      await (recipient.agentInstance as any).handleIncomingMessage?.(message, sender);
    } catch (error) {
      logger.error("Error handling incoming message", error instanceof Error ? error : undefined, {
        errorMessage: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let agentMessageBrokerInstance: AgentMessageBroker | null = null;

export function getAgentMessageBroker(): AgentMessageBroker {
  if (!agentMessageBrokerInstance) {
    agentMessageBrokerInstance = new AgentMessageBroker();
  }
  return agentMessageBrokerInstance;
}
