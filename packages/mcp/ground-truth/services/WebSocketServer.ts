/**
 * WebSocket Server for Real-Time Financial Data Streaming
 *
 * Provides real-time data streaming capabilities for:
 * - Live market data updates
 * - SEC filing notifications
 * - Real-time sentiment analysis
 * - System events and alerts
 *
 * Uses Socket.io for WebSocket communication with authentication,
 * subscription management, and scalable broadcasting.
 */

import { Server as HTTPServer } from "http";
import { Server as HTTPSServer } from "https";

import { createAdapter } from "@socket.io/redis-adapter";
import { Redis } from "ioredis";
import { Server, Socket } from "socket.io";

import { logger } from "../../lib/logger";
import { getCache } from "../core/Cache";

export interface StreamingClient {
  id: string;
  socket: Socket;
  authenticated: boolean;
  subscriptions: Set<string>;
  userId?: string;
  permissions: string[];
  connectedAt: Date;
  lastActivity: Date;
}

export interface SubscriptionMessage {
  type: "subscribe" | "unsubscribe";
  channels: string[];
  filters?: Record<string, any>;
}

export interface StreamData {
  channel: string;
  data: any;
  timestamp: number;
  metadata?: {
    source?: string;
    quality?: number;
    delay?: number;
  };
}

export interface WebhookNotification {
  id: string;
  type: "sec_filing" | "market_data" | "system_alert";
  title: string;
  message: string;
  data: any;
  timestamp: number;
  priority: "low" | "medium" | "high" | "critical";
  recipients?: string[];
}

export class WebSocketServer {
  private io: Server;
  private clients: Map<string, StreamingClient> = new Map();
  private channels: Map<string, Set<string>> = new Map(); // channel -> client IDs
  private cache = getCache();

  constructor(httpServer: HTTPServer | HTTPSServer) {
    this.io = new Server(httpServer, {
      cors: {
        origin: process.env.CORS_ORIGIN || "*",
        methods: ["GET", "POST"],
        credentials: true,
      },
      transports: ["websocket", "polling"],
    });

    this.attachRedisAdapter();
    this.setupMiddleware();
    this.setupEventHandlers();
    this.startHealthMonitoring();
  }

  /**
   * Attach the Redis adapter so that socket.io broadcasts reach clients
   * connected to other pods. Falls back to in-memory (single-pod) when
   * REDIS_URL is not set.
   */
  private attachRedisAdapter(): void {
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
      logger.warn("MCP WebSocketServer: REDIS_URL not set, running in local-only mode");
      return;
    }

    try {
      const pubClient = new Redis(redisUrl, { lazyConnect: false, maxRetriesPerRequest: 3 });
      const subClient = pubClient.duplicate();

      pubClient.on("error", (err) => logger.error("MCP WS Redis pub error", err));
      subClient.on("error", (err) => logger.error("MCP WS Redis sub error", err));

      this.io.adapter(createAdapter(pubClient, subClient));
      logger.info("MCP WebSocketServer: Redis adapter attached");
    } catch (err) {
      logger.error(
        "MCP WebSocketServer: failed to attach Redis adapter, using in-memory",
        err instanceof Error ? err : undefined
      );
    }
  }

  /**
   * Set up authentication and authorization middleware
   */
  private setupMiddleware(): void {
    this.io.use(async (socket: Socket, next) => {
      try {
        // Extract authentication token
        const token =
          socket.handshake.auth.token || socket.handshake.query.token;

        if (!token) {
          // Allow anonymous connections for public data
          socket.data.authenticated = false;
          socket.data.permissions = ["public"];
          return next();
        }

        // Validate token (would integrate with your auth system)
        const userData = await this.validateAuthToken(token);

        if (!userData) {
          return next(new Error("Authentication failed"));
        }

        socket.data.authenticated = true;
        socket.data.userId = userData.userId;
        socket.data.permissions = userData.permissions || ["basic"];

        logger.info("WebSocket client authenticated", {
          socketId: socket.id,
          userId: userData.userId,
        });

        next();
      } catch (error) {
        logger.error(
          "WebSocket authentication error",
          error instanceof Error ? error : undefined
        );
        next(new Error("Authentication error"));
      }
    });
  }

  /**
   * Set up socket event handlers
   */
  private setupEventHandlers(): void {
    this.io.on("connection", (socket: Socket) => {
      const client: StreamingClient = {
        id: socket.id,
        socket,
        authenticated: socket.data.authenticated || false,
        subscriptions: new Set(),
        userId: socket.data.userId,
        permissions: socket.data.permissions || ["public"],
        connectedAt: new Date(),
        lastActivity: new Date(),
      };

      this.clients.set(socket.id, client);

      logger.info("WebSocket client connected", {
        socketId: socket.id,
        authenticated: client.authenticated,
        permissions: client.permissions,
        totalClients: this.clients.size,
      });

      // Handle subscription requests
      socket.on("subscribe", (message: SubscriptionMessage) => {
        this.handleSubscription(socket, message);
      });

      socket.on("unsubscribe", (message: SubscriptionMessage) => {
        this.handleUnsubscription(socket, message);
      });

      // Handle ping/pong for connection monitoring
      socket.on("ping", () => {
        socket.emit("pong", { timestamp: Date.now() });
        client.lastActivity = new Date();
      });

      // Handle disconnection
      socket.on("disconnect", (reason) => {
        this.handleDisconnection(socket.id, reason);
      });

      // Send welcome message
      socket.emit("welcome", {
        message: "Connected to MCP Financial Data Stream",
        authenticated: client.authenticated,
        permissions: client.permissions,
        serverTime: new Date().toISOString(),
      });
    });
  }

  /**
   * Handle client subscription requests
   */
  private handleSubscription(
    socket: Socket,
    message: SubscriptionMessage
  ): void {
    const client = this.clients.get(socket.id);
    if (!client) return;

    try {
      const { channels, filters } = message;

      for (const channel of channels) {
        // Check permissions for channel access
        if (!this.checkChannelPermission(client, channel)) {
          socket.emit("subscription_error", {
            channel,
            error: "Insufficient permissions",
            timestamp: Date.now(),
          });
          continue;
        }

        // Add to client's subscriptions
        client.subscriptions.add(channel);

        // Add client to channel
        if (!this.channels.has(channel)) {
          this.channels.set(channel, new Set());
        }
        this.channels.get(channel)!.add(socket.id);

        logger.debug("Client subscribed to channel", {
          socketId: socket.id,
          channel,
          filters,
        });
      }

      socket.emit("subscription_success", {
        channels,
        timestamp: Date.now(),
      });

      client.lastActivity = new Date();
    } catch (error) {
      logger.error(
        "Subscription handling error",
        error instanceof Error ? error : undefined,
        {
          socketId: socket.id,
          channels: message.channels,
        }
      );
    }
  }

  /**
   * Handle client unsubscription requests
   */
  private handleUnsubscription(
    socket: Socket,
    message: SubscriptionMessage
  ): void {
    const client = this.clients.get(socket.id);
    if (!client) return;

    const { channels } = message;

    for (const channel of channels) {
      client.subscriptions.delete(channel);

      const channelClients = this.channels.get(channel);
      if (channelClients) {
        channelClients.delete(socket.id);
        if (channelClients.size === 0) {
          this.channels.delete(channel);
        }
      }
    }

    socket.emit("unsubscription_success", {
      channels,
      timestamp: Date.now(),
    });

    client.lastActivity = new Date();
  }

  /**
   * Handle client disconnection
   */
  private handleDisconnection(socketId: string, reason: string): void {
    const client = this.clients.get(socketId);
    if (!client) return;

    // Remove from all channels
    for (const channel of client.subscriptions) {
      const channelClients = this.channels.get(channel);
      if (channelClients) {
        channelClients.delete(socketId);
        if (channelClients.size === 0) {
          this.channels.delete(channel);
        }
      }
    }

    this.clients.delete(socketId);

    logger.info("WebSocket client disconnected", {
      socketId,
      reason,
      subscriptionsCount: client.subscriptions.size,
      totalClients: this.clients.size,
    });
  }

  /**
   * Broadcast data to subscribed clients
   */
  broadcastToChannel(channel: string, data: StreamData): void {
    const channelClients = this.channels.get(channel);
    if (!channelClients || channelClients.size === 0) {
      return;
    }

    const message = {
      ...data,
      serverTimestamp: Date.now(),
    };

    let sentCount = 0;
    for (const clientId of channelClients) {
      const client = this.clients.get(clientId);
      if (client && client.socket.connected) {
        client.socket.emit("data", message);
        sentCount++;
      }
    }

    logger.debug("Broadcasted data to channel", {
      channel,
      recipients: sentCount,
      totalSubscribers: channelClients.size,
    });
  }

  /**
   * Send data to specific client
   */
  sendToClient(clientId: string, data: StreamData): void {
    const client = this.clients.get(clientId);
    if (!client || !client.socket.connected) {
      return;
    }

    const message = {
      ...data,
      serverTimestamp: Date.now(),
    };

    client.socket.emit("data", message);
    client.lastActivity = new Date();
  }

  /**
   * Send webhook notification to all connected clients
   */
  broadcastWebhook(notification: WebhookNotification): void {
    const message = {
      ...notification,
      type: "webhook" as const,
      serverTimestamp: Date.now(),
    };

    this.io.emit("webhook", message);

    logger.info("Broadcasted webhook notification", {
      notificationId: notification.id,
      type: notification.type,
      priority: notification.priority,
      recipients: this.clients.size,
    });
  }

  /**
   * Send targeted webhook notification
   */
  sendWebhookToRecipients(notification: WebhookNotification): void {
    if (!notification.recipients || notification.recipients.length === 0) {
      // Broadcast to all if no specific recipients
      this.broadcastWebhook(notification);
      return;
    }

    let sentCount = 0;
    for (const recipientId of notification.recipients) {
      const client = this.clients.get(recipientId);
      if (client && client.socket.connected) {
        client.socket.emit("webhook", {
          type: "webhook",
          ...notification,
          serverTimestamp: Date.now(),
        });
        sentCount++;
      }
    }

    logger.info("Sent targeted webhook notification", {
      notificationId: notification.id,
      type: notification.type,
      recipients: notification.recipients.length,
      delivered: sentCount,
    });
  }

  /**
   * Check if client has permission to access a channel
   */
  private checkChannelPermission(
    client: StreamingClient,
    channel: string
  ): boolean {
    // Public channels accessible to all
    const publicChannels = ["market.overview", "system.status"];
    if (publicChannels.includes(channel)) {
      return true;
    }

    // Premium channels require authentication
    if (channel.startsWith("market.") || channel.startsWith("sec.")) {
      return client.authenticated;
    }

    // Private channels require specific permissions
    if (channel.startsWith("private.")) {
      return (
        client.permissions.includes("premium") ||
        client.permissions.includes("admin")
      );
    }

    // Admin channels require admin permission
    if (channel.startsWith("admin.")) {
      return client.permissions.includes("admin");
    }

    return false;
  }

  /**
   * Validate authentication token
   */
  private async validateAuthToken(
    token: string
  ): Promise<{ userId: string; permissions: string[] } | null> {
    try {
      // This would integrate with your authentication system
      // For now, return mock data
      return {
        userId: "user_" + token.substring(0, 8),
        permissions: ["basic", "premium"],
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Start health monitoring for connections
   */
  private startHealthMonitoring(): void {
    // Clean up stale connections every 30 seconds
    setInterval(() => {
      const now = Date.now();
      const staleThreshold = 5 * 60 * 1000; // 5 minutes

      for (const [socketId, client] of this.clients.entries()) {
        if (now - client.lastActivity.getTime() > staleThreshold) {
          logger.warn("Removing stale WebSocket connection", {
            socketId,
            lastActivity: client.lastActivity.toISOString(),
          });
          client.socket.disconnect(true);
          this.handleDisconnection(socketId, "stale_connection");
        }
      }
    }, 30000);
  }

  /**
   * Get server statistics
   */
  getStats(): {
    totalClients: number;
    authenticatedClients: number;
    activeChannels: number;
    channelSubscriptions: Record<string, number>;
  } {
    const authenticatedClients = Array.from(this.clients.values()).filter(
      (client) => client.authenticated
    ).length;

    const channelSubscriptions: Record<string, number> = {};
    for (const [channel, clients] of this.channels.entries()) {
      channelSubscriptions[channel] = clients.size;
    }

    return {
      totalClients: this.clients.size,
      authenticatedClients,
      activeChannels: this.channels.size,
      channelSubscriptions,
    };
  }

  /**
   * Gracefully shutdown the server
   */
  async shutdown(): Promise<void> {
    logger.info("Shutting down WebSocket server");

    // Disconnect all clients
    for (const client of this.clients.values()) {
      client.socket.disconnect(true);
    }

    this.clients.clear();
    this.channels.clear();

    // Close Socket.io server
    this.io.close();
  }
}
