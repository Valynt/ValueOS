/**
 * SecureMessageBus with Consumer Group Support
 */

import { EventEmitter } from "node:events";

import { redisStreamBroker } from "../../services/messaging/RedisStreamBroker";
import { AgentIdentity } from "../auth/AgentIdentity";
import { createLogger } from "../logger";

export type MessagePriority = "low" | "normal" | "high" | "urgent";

export interface SecureMessage {
  id: string;
  fromAgentId: string;
  toAgentId: string;
  tenantContext: {
    tenantId: string;
    organizationId: string;
  };
  payload: unknown;
  priority: MessagePriority;
  encrypted: boolean;
  correlationId?: string;
  replyTo?: string;
  timestamp: Date;
}

export interface SendOptions {
  tenantContext: {
    tenantId: string;
    organizationId: string;
  };
  priority?: MessagePriority;
  encrypted?: boolean;
  correlationId?: string;
  replyTo?: string;
  senderIdentity?: AgentIdentity;
  metadata?: {
    tenant_id?: string;
    organization_id?: string;
  };
}

export interface ConsumerGroupConfig {
  agentType: string;
  groupSize: number;
  ackOnStateUpdate: boolean;
  stateMachine?: any; // Reference to agent's state machine
}

export class SecureMessageBus extends EventEmitter {
  private subscribers: Map<string, { handler: Function; patterns?: string[] }[]> = new Map();
  private consumerGroups: Map<string, ConsumerGroupConfig> = new Map();
  private activeBrokers: Map<string, any> = new Map(); // Store broker instances for ack
  private log: ReturnType<typeof createLogger>;

  constructor() {
    super();
    this.log = createLogger({ component: "secure-message-bus" });
  }

  // Configure consumer group for an agent type
  configureConsumerGroup(agentType: string, config: ConsumerGroupConfig): void {
    this.consumerGroups.set(agentType, config);
    this.log.info("Configured consumer group", { agentType, config });
  }

  async send(
    from: string | AgentIdentity,
    to: string,
    payload: unknown,
    options: SendOptions
  ): Promise<SecureMessage> {
    const fromAgentId = typeof from === "string" ? from : from.agent_id;
    const authenticatedOrgId = typeof from === "string" ? undefined : from.organization_id;
    const senderOrgId = options.senderIdentity?.organization_id;
    const metadataOrgId = options.metadata?.organization_id ?? options.metadata?.tenant_id;
    const organizationId = authenticatedOrgId || senderOrgId || metadataOrgId || options.tenantContext.organizationId;
    const tenantId = options.metadata?.tenant_id || options.tenantContext.tenantId;

    if (!organizationId || !tenantId) {
      throw new Error("Tenant context is required for SecureMessageBus.publish");
    }

    if (authenticatedOrgId && authenticatedOrgId !== organizationId) {
      throw new Error("Tenant context mismatch with authenticated sender identity");
    }

    if (options.tenantContext.organizationId && options.tenantContext.organizationId !== organizationId) {
      throw new Error("Tenant context organization does not match resolved sender organization");
    }

    if (options.tenantContext.tenantId && options.tenantContext.tenantId !== tenantId) {
      throw new Error("Tenant context tenant does not match resolved sender tenant");
    }

    const message: SecureMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      fromAgentId,
      toAgentId: to,
      tenantContext: {
        tenantId,
        organizationId,
      },
      payload,
      priority: options.priority ?? "normal",
      encrypted: options.encrypted ?? false,
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
      if (!patterns || patterns.includes("*") || patterns.includes(fromAgentId)) {
        if (!message.tenantContext.organizationId || !message.tenantContext.tenantId) {
          throw new Error("Tenant context is required for SecureMessageBus.consume");
        }

        handler(message, {
          agent_id: fromAgentId,
          agent_type: "unknown",
          organization_id: message.tenantContext.organizationId,
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

    // Store broker reference for later ack
    this.activeBrokers.set(agentType, broker);

    await broker.startConsumer(async (event) => {
      if (event.name === "agent_message") {
        const { message } = event.payload;
        if (!message.tenantContext?.tenantId || !message.tenantContext?.organizationId) {
          throw new Error("Tenant context is required for SecureMessageBus.consume");
        }

        const senderIdentity = {
          agent_id: message.fromAgentId,
          agent_type: agentType,
          organization_id: message.tenantContext.organizationId,
          permissions: [],
          issued_at: "",
          expires_at: "",
        } as AgentIdentity;

        try {
          await handler(message, senderIdentity);

          // If configured to ack only on state update, wait for state machine confirmation
          if (config.ackOnStateUpdate && config.stateMachine) {
            // The handler should have triggered a state update
            // We'll assume the state machine will call acknowledgeMessage when ready
            this.log.info("Message processed, waiting for state update ack", { messageId: message.id });
          } else {
            // Auto-ack for non-state-update scenarios
            await this.acknowledgeMessage(agentType, message.id);
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
    // For now, we rely on the broker's automatic acking
    // In a full implementation, this would need broker support for manual acking
    this.log.info("Acknowledged message", { agentType, messageId });

    // TODO(ticket:VOS-DEBT-1427 owner:team-valueos date:2026-02-13): Implement manual acking in RedisStreamBroker if needed
    // const broker = this.activeBrokers.get(agentType);
    // if (broker) {
    //   await broker.acknowledge(messageId);
    // }
  }
}

export const secureMessageBus = new SecureMessageBus();
