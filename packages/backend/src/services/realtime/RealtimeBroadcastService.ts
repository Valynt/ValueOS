import { logger } from "../lib/logger.js";

import { getBroadcastAdapter } from "./WebSocketBroadcastAdapter.js";

export class RealtimeBroadcastService {
  broadcastToTenant(tenantId: string, messageType: string, payload: unknown): void {
    try {
      const message = JSON.stringify({ type: messageType, payload, timestamp: new Date().toISOString() });

      // getBroadcastAdapter() throws if initBroadcastAdapter() was never called.
      // That is a startup sequencing bug — surface it as an error rather than
      // silently falling back to an O(total_connections) client scan.
      getBroadcastAdapter().broadcast(tenantId, message);

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
