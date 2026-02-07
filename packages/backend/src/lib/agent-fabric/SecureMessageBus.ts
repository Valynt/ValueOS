/**
 * SecureMessageBus with Consumer Group Support
 */

import { EventEmitter } from "events";
import { AgentIdentity } from "../auth/AgentIdentity";
import { redisStreamBroker } from "../../services/messaging/RedisStreamBroker";
import { Logger, logger } from "../logger";

export type MessagePriority = "low" | "normal" | "high" | "urgent";

export interface SecureMessage {
  id: string;
  fromAgentId: string;
  toAgentId: string;
  payload: any;
  priority: MessagePriority;
  encrypted: boolean;
  correlationId?: string;
  replyTo?: string;
  timestamp: Date;
}

export interface SendOptions {
  priority?: MessagePriority;
  encrypted?: boolean;
  correlationId?: string;
  replyTo?: string;
}

export interface ConsumerGroupConfig {
  agentType: string;
  groupSize: number;
  ackOnStateUpdate: boolean;
}

export class SecureMessageBus extends EventEmitter {
  private subscribers: Map<string, { handler: Function; patterns?: string[] }[]> = new Map();
  private consumerGroups: Map<string, ConsumerGroupConfig> = new Map();
  private log: Logger;

  constructor() {
    super();
    this.log = logger.withContext({ component: "secure-message-bus" });
  }

  // Configure consumer group for an agent type
  configureConsumerGroup(agentType: string, config: ConsumerGroupConfig): void {
    this.consumerGroups.set(agentType, config);
    this.log.info("Configured consumer group", { agentType, config });
  }

  async send(
    from: string,
    to: string,
    payload: any,
    options: SendOptions = {}
  ): Promise<SecureMessage> {
    const message: SecureMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      fromAgentId: from,
      toAgentId: to,
      payload,
      priority: options.priority || "normal",
      encrypted: options.encrypted || false,
      correlationId: options.correlationId,
      replyTo: options.replyTo,
      timestamp: new Date(),
    };

    // Publish to Redis stream for persistence and consumer group distribution
    await redisStreamBroker.publish("agent_message", {
      message,
      idempotencyKey: message.id,
    });

    // Also emit locally for immediate subscribers
    const handlers = this.subscribers.get(to) || [];
    for (const { handler, patterns } of handlers) {
      if (!patterns || patterns.includes("*") || patterns.includes(from)) {
        handler(message, {
          agent_id: from,
          agent_type: "unknown",
          organization_id: "",
          permissions: [],
          issued_at: "",
          expires_at: "",
        } as AgentIdentity);
      }
    }

    return message;
  }

  subscribe(
    event: string,
    handler: (message: SecureMessage, sender: AgentIdentity) => void,
    patterns?: string[]
  ): void {
    if (!this.subscribers.has(event)) {
      this.subscribers.set(event, []);
    }
    this.subscribers.get(event)!.push({ handler, patterns });
  }

  unsubscribe(event: string, handler: Function): void {
    const handlers = this.subscribers.get(event) || [];
    const index = handlers.findIndex((h) => h.handler === handler);
    if (index > -1) {
      handlers.splice(index, 1);
    }
  }

  // Start consumer for agent type with consumer group support
  async startConsumerForAgentType(
    agentType: string,
    handler: (message: SecureMessage, sender: AgentIdentity) => Promise<void>
  ): Promise<void> {
    const config = this.consumerGroups.get(agentType);
    if (!config) {
      throw new Error(`No consumer group configured for agent type: ${agentType}`);
    }

    // Create broker instance with consumer group settings
    const broker = new (
      await import("../../services/messaging/RedisStreamBroker")
    ).RedisStreamBroker({
      streamName: `agent_messages_${agentType}`,
      groupName: `${agentType}_consumers`,
      consumerName: `${agentType}_consumer_${process.pid}`,
      consumerGroupSize: config.groupSize,
      enableConsumerGroups: true,
      maxDeliveries: 3, // Move to DLQ after 3 failures
    });

    await broker.startConsumer(async (event) => {
      if (event.name === "agent_message") {
        const { message } = event.payload;
        const senderIdentity = {
          agent_id: message.fromAgentId,
          agent_type: agentType,
          organization_id: "",
          permissions: [],
          issued_at: "",
          expires_at: "",
        } as AgentIdentity;

        try {
          await handler(message, senderIdentity);

          // If configured to ack only on state update, the handler must call ack manually
          if (!config.ackOnStateUpdate) {
            // Auto-ack for non-state-update scenarios
            // In practice, this would need to be handled by the broker
          }
        } catch (error) {
          this.log.error("Message handler failed", error, { messageId: message.id, agentType });
          throw error; // Let broker handle retry/DLQ
        }
      }
    });
  }

  // Manual acknowledgment for state-update based acking
  async acknowledgeMessage(agentType: string, messageId: string): Promise<void> {
    // This would need integration with the broker's ack mechanism
    // For now, assume the broker handles it based on successful processing
    this.log.info("Acknowledged message", { agentType, messageId });
  }
}

export const secureMessageBus = new SecureMessageBus();
