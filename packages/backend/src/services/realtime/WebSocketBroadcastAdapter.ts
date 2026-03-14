/**
 * WebSocketBroadcastAdapter
 *
 * Bridges the native `ws` WebSocketServer with Redis pub/sub so that
 * broadcasts reach clients connected to any backend pod, not just the
 * local one. When Redis is unavailable the adapter falls back to
 * local-only delivery (single-pod behaviour).
 */

import Redis from "ioredis";
import { WebSocket, WebSocketServer } from "ws";

import { settings } from "../../config/settings.js";
import { logger } from "../../lib/logger.js";

const WS_BROADCAST_CHANNEL = "ws:broadcast";

interface BroadcastMessage {
  /** Restrict delivery to clients whose `tenantId` matches. */
  tenantId: string;
  /** Serialised JSON payload to send verbatim to matching clients. */
  payload: string;
}

interface AuthenticatedWebSocket extends WebSocket {
  userId: string;
  tenantId: string;
}

export class WebSocketBroadcastAdapter {
  private pub: Redis | null = null;
  private sub: Redis | null = null;
  private wss: WebSocketServer;
  private ready = false;

  constructor(wss: WebSocketServer) {
    this.wss = wss;
  }

  /**
   * Connect to Redis and subscribe to the broadcast channel.
   * Safe to call even when REDIS_URL is not configured — the adapter
   * will simply operate in local-only mode.
   */
  async init(): Promise<void> {
    const redisUrl = settings.REDIS_URL;
    if (!redisUrl) {
      logger.warn(
        "WebSocketBroadcastAdapter: REDIS_URL not set, running in local-only mode"
      );
      return;
    }

    try {
      this.pub = new Redis(redisUrl, { lazyConnect: true, maxRetriesPerRequest: 3 });
      this.sub = new Redis(redisUrl, { lazyConnect: true, maxRetriesPerRequest: 3 });

      this.pub.on("error", (err) =>
        logger.error("WebSocketBroadcastAdapter pub error", err)
      );
      this.sub.on("error", (err) =>
        logger.error("WebSocketBroadcastAdapter sub error", err)
      );

      await Promise.all([this.pub.connect(), this.sub.connect()]);

      await this.sub.subscribe(WS_BROADCAST_CHANNEL);

      this.sub.on("message", (_channel: string, raw: string) => {
        try {
          const msg: BroadcastMessage = JSON.parse(raw);
          this.deliverLocally(msg.tenantId, msg.payload);
        } catch (err) {
          logger.error(
            "WebSocketBroadcastAdapter: failed to process incoming message",
            err instanceof Error ? err : undefined
          );
        }
      });

      this.ready = true;
      logger.info("WebSocketBroadcastAdapter: Redis pub/sub connected");
    } catch (err) {
      logger.error(
        "WebSocketBroadcastAdapter: Redis connection failed, falling back to local-only",
        err instanceof Error ? err : undefined
      );
      await this.teardownRedis();
    }
  }

  /**
   * Broadcast a pre-serialised JSON payload to every client in the
   * given tenant across all pods.
   */
  broadcast(tenantId: string, payload: string): void {
    if (this.ready && this.pub) {
      const msg: BroadcastMessage = { tenantId, payload };
      this.pub
        .publish(WS_BROADCAST_CHANNEL, JSON.stringify(msg))
        .catch((err) =>
          logger.error(
            "WebSocketBroadcastAdapter: publish failed, delivering locally",
            err instanceof Error ? err : undefined
          )
        );
      // Redis subscriber on this pod will call deliverLocally.
      return;
    }

    // Fallback: no Redis, deliver to local clients only.
    this.deliverLocally(tenantId, payload);
  }

  /**
   * Send the payload to every locally-connected client whose tenantId
   * matches.
   */
  private deliverLocally(tenantId: string, payload: string): void {
    this.wss.clients.forEach((client) => {
      const authed = client as AuthenticatedWebSocket;
      if (authed.tenantId === tenantId && client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    });
  }

  /** Gracefully close Redis connections. */
  async shutdown(): Promise<void> {
    this.ready = false;
    await this.teardownRedis();
    logger.info("WebSocketBroadcastAdapter: shut down");
  }

  /** Whether Redis pub/sub is active. */
  isRedisConnected(): boolean {
    return this.ready;
  }

  private async teardownRedis(): Promise<void> {
    try {
      if (this.sub) {
        await this.sub.unsubscribe(WS_BROADCAST_CHANNEL).catch(() => {});
        this.sub.disconnect();
        this.sub = null;
      }
      if (this.pub) {
        this.pub.disconnect();
        this.pub = null;
      }
    } catch {
      // Best-effort cleanup
    }
    this.ready = false;
  }
}

// Singleton — initialised in server.ts after the WebSocketServer is created.
let instance: WebSocketBroadcastAdapter | null = null;

export function initBroadcastAdapter(wss: WebSocketServer): WebSocketBroadcastAdapter {
  instance = new WebSocketBroadcastAdapter(wss);
  return instance;
}

export function getBroadcastAdapter(): WebSocketBroadcastAdapter {
  if (!instance) {
    throw new Error("WebSocketBroadcastAdapter not initialised — call initBroadcastAdapter first");
  }
  return instance;
}
