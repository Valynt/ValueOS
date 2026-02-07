import Redis from "ioredis";
import { Logger, logger } from "../logger";
import { redisStreamBroker } from "../../services/messaging/RedisStreamBroker";

export interface DLQAlert {
  streamName: string;
  messageCount: number;
  lastFailedMessage?: {
    id: string;
    eventName: string;
    failedAt: string;
    error: string;
  };
}

export class FabricMonitor {
  private redis: Redis;
  private log: Logger;
  private alertCallbacks: ((alert: DLQAlert) => void)[] = [];
  private monitoringInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.redis = new Redis();
    this.log = logger.withContext({ component: "fabric-monitor" });
  }

  // Start monitoring DLQ streams
  startMonitoring(intervalMs: number = 30000): void {
    this.monitoringInterval = setInterval(() => {
      this.checkDLQs();
    }, intervalMs);
    this.log.info("Started DLQ monitoring", { intervalMs });
  }

  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    this.log.info("Stopped DLQ monitoring");
  }

  // Register callback for DLQ alerts
  onDLQAlert(callback: (alert: DLQAlert) => void): void {
    this.alertCallbacks.push(callback);
  }

  private async checkDLQs(): Promise<void> {
    try {
      // Get all streams that have DLQ counterparts
      const streams = await this.redis.keys("*:dlq");
      const alerts: DLQAlert[] = [];

      for (const dlqStream of streams) {
        const streamName = dlqStream.replace(":dlq", "");
        const messageCount = await this.redis.xlen(dlqStream);

        if (messageCount > 0) {
          const lastMessage = await this.redis.xrevrange(dlqStream, "+", "-", "COUNT", 1);
          let lastFailedMessage;

          if (lastMessage.length > 0) {
            const [, fields] = lastMessage[0];
            const fieldMap: Record<string, string> = {};
            for (let i = 0; i < fields.length; i += 2) {
              fieldMap[fields[i]] = fields[i + 1];
            }

            lastFailedMessage = {
              id: lastMessage[0][0],
              eventName: fieldMap["eventName"],
              failedAt: fieldMap["failedAt"],
              error: fieldMap["error"],
            };
          }

          const alert: DLQAlert = {
            streamName,
            messageCount,
            lastFailedMessage,
          };

          alerts.push(alert);
          this.log.warn("DLQ populated", { streamName, messageCount, lastFailedMessage });
        }
      }

      // Trigger alerts
      for (const alert of alerts) {
        this.alertCallbacks.forEach((callback) => callback(alert));
      }
    } catch (error) {
      this.log.error("Failed to check DLQs", error);
    }
  }

  // Get current DLQ status
  async getDLQStatus(): Promise<DLQAlert[]> {
    const streams = await this.redis.keys("*:dlq");
    const alerts: DLQAlert[] = [];

    for (const dlqStream of streams) {
      const streamName = dlqStream.replace(":dlq", "");
      const messageCount = await this.redis.xlen(dlqStream);

      if (messageCount > 0) {
        const lastMessage = await this.redis.xrevrange(dlqStream, "+", "-", "COUNT", 1);
        let lastFailedMessage;

        if (lastMessage.length > 0) {
          const [, fields] = lastMessage[0];
          const fieldMap: Record<string, string> = {};
          for (let i = 0; i < fields.length; i += 2) {
            fieldMap[fields[i]] = fields[i + 1];
          }

          lastFailedMessage = {
            id: lastMessage[0][0],
            eventName: fieldMap["eventName"],
            failedAt: fieldMap["failedAt"],
            error: fieldMap["error"],
          };
        }

        alerts.push({
          streamName,
          messageCount,
          lastFailedMessage,
        });
      }
    }

    return alerts;
  }

  // Alert the Orchestrator (placeholder - integrate with actual orchestrator)
  private alertOrchestrator(alert: DLQAlert): void {
    // TODO: Integrate with WorkflowOrchestrator to handle DLQ alerts
    // For now, just log
    this.log.error("DLQ Alert for Orchestrator", alert);
  }
}

export const fabricMonitor = new FabricMonitor();

// Auto-start monitoring
fabricMonitor.startMonitoring();

// Register orchestrator alert callback
fabricMonitor.onDLQAlert((alert) => {
  fabricMonitor.alertOrchestrator(alert);
});
