import { wss } from "../server";
import { logger } from "../lib/logger.js";
import { getBroadcastAdapter } from "./WebSocketBroadcastAdapter.js";
import { WebSocket } from "ws";

interface AuthenticatedWebSocket extends WebSocket {
  tenantId: string;
}

export class RealtimeBroadcastService {
  broadcastToTenant(tenantId: string, messageType: string, payload: unknown): void {
    try {
      const message = JSON.stringify({ type: messageType, payload, timestamp: new Date().toISOString() });

      try {
        getBroadcastAdapter().broadcast(tenantId, message);
      } catch {
        // Adapter not initialised — fall back to local-only delivery.
        (wss as unknown as { clients: Set<WebSocket> }).clients.forEach((client) => {
          const authed = client as AuthenticatedWebSocket;
          if (client.readyState === WebSocket.OPEN && authed.tenantId === tenantId) {
            client.send(message);
          }
        });
      }

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
