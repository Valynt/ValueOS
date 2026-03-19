import { getIoRedisClient } from "../ioredisClient.js";
import { Logger, logger } from "../logger";

import { secureMessageBus } from "./SecureMessageBus";

export class FabricMonitor {
  private redis: ReturnType<typeof getIoRedisClient>;
  private log: Logger;
  private dlqStreamName: string;

  constructor() {
    this.redis = getIoRedisClient();
    this.log = logger.withContext({ component: "fabric-monitor" });
    this.dlqStreamName = "agent_messages_dlq";
  }

  async startMonitoring() {
    this.log.info("Starting DLQ monitoring");

    // Create consumer group for DLQ
    try {
      await this.redis.xgroup("CREATE", this.dlqStreamName, "dlq-monitors", "$", "MKSTREAM");
    } catch (error) {
      if (!error.message.includes("BUSYGROUP")) {
        throw error;
      }
    }

    // Start monitoring loop
    while (true) {
      const messages = await this.redis.xreadgroup(
        "GROUP",
        "dlq-monitors",
        "dlq-monitor-1",
        "COUNT",
        "10",
        "BLOCK",
        5000,
        "STREAMS",
        this.dlqStreamName,
        ">"
      );

      if (messages) {
        for (const [stream, streamMessages] of messages) {
          for (const [id, fields] of streamMessages) {
            await this.handleFailedMessage(id, fields);
            await this.redis.xack(this.dlqStreamName, "dlq-monitors", id);
          }
        }
      }
    }
  }

  private async handleFailedMessage(id: string, fields: string[]) {
    const payload = JSON.parse(fields[1]);
    this.log.error("DLQ message detected", {
      messageId: id,
      originalStream: payload.originalStream,
      failureCount: payload.attempts,
      lastError: payload.error,
    });

    // Alert orchestrator via secure message bus
    await secureMessageBus.send(
      "fabric-monitor",
      "orchestrator",
      {
        type: "dlq_alert",
        messageId: id,
        payload,
      },
      {
        tenantContext: {
          tenantId: payload?.tenantId ?? "system",
          organizationId: payload?.organizationId ?? payload?.tenantId ?? "system",
        },
        priority: "urgent",
        metadata: {
          tenant_id: payload?.tenantId,
          organization_id: payload?.organizationId,
        },
      }
    );
  }
}

export const fabricMonitor = new FabricMonitor();

export interface DLQAlert {
  queueName: string;
  messageId: string;
  errorMessage: string;
  retryCount: number;
  timestamp: string;
  payload?: unknown;
  streamName?: string;
  messageCount?: number;
  lastFailedMessage?: unknown;
  [key: string]: unknown;
}
