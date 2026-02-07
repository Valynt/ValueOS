import { wss } from "../server";
import { logger } from "../lib/logger.js";

export class RealtimeBroadcastService {
  broadcastToTenant(tenantId: string, messageType: string, payload: any): void {
    try {
      const message = JSON.stringify({ type: messageType, payload, timestamp: new Date().toISOString() });

      (wss as any).clients.forEach((client: any) => {
        try {
          // Only send to authenticated sockets with matching tenant
          if (client.readyState === 1 && client.tenantId === tenantId) {
            client.send(message);
          }
        } catch (err) {
          logger.warn("Failed to send realtime message to a client", err instanceof Error ? err.message : String(err));
        }
      });

      logger.debug("Broadcasted realtime message", { tenantId, messageType });
    } catch (error) {
      logger.error("Realtime broadcast failed", error instanceof Error ? error : undefined, { tenantId, messageType });
    }
  }
}

let instance: RealtimeBroadcastService | null = null;
export function getRealtimeBroadcastService(): RealtimeBroadcastService {
  if (!instance) instance = new RealtimeBroadcastService();
  return instance;
}
