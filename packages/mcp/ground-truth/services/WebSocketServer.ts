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
import { createSecretKey } from "crypto";

import { parseCorsAllowlist } from "../../../shared/src/config/cors";
import { createAdapter } from "@socket.io/redis-adapter";
import { Redis } from "ioredis";
import { createRemoteJWKSet, JWTPayload, jwtVerify } from "jose";
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

interface AuthenticatedUser {
  userId: string;
  organizationId: string;
  permissions: string[];
}

interface AuthFailure {
  code: number;
  reason: string;
  logKey: string;
}

class WebSocketAuthError extends Error {
  readonly closeCode: number;
  readonly closeReason: string;

  constructor(message: string, closeCode: number, closeReason: string) {
    super(message);
    this.name = "WebSocketAuthError";
    this.closeCode = closeCode;
    this.closeReason = closeReason;
  }
}

const WS_CLOSE_CODES = {
  invalidPayload: 1002,
  policyViolation: 1008,
} as const;

const AUTH_FAILURE_LOG_WINDOW_MS = 60_000;
const AUTH_FAILURE_LOG_LIMIT = 5;

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
  private authFailureLogWindow: Map<string, { windowStart: number; count: number }> =
    new Map();

  constructor(httpServer: HTTPServer | HTTPSServer) {
    const corsOrigins = parseCorsAllowlist(
      process.env.CORS_ORIGIN || process.env.CORS_ORIGINS,
      {
        source: "CORS_ORIGIN/CORS_ORIGINS",
        credentials: true,
        requireNonEmpty: true,
      }
    );

    this.io = new Server(httpServer, {
      cors: {
        origin: corsOrigins,
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

        const userData = await this.validateAuthToken(token);

        socket.data.authenticated = true;
        socket.data.userId = userData.userId;
        socket.data.organizationId = userData.organizationId;
        socket.data.permissions = userData.permissions;

        logger.info("WebSocket client authenticated", {
          socketId: socket.id,
          userId: userData.userId,
        });

        next();
      } catch (error) {
        if (error instanceof WebSocketAuthError) {
          const authError = new Error(error.message) as Error & {
            data?: { closeCode: number; reason: string };
          };
          authError.data = {
            closeCode: error.closeCode,
            reason: error.closeReason,
          };
          return next(authError);
        }

        logger.error("WebSocket authentication error", {
          socketId: socket.id,
          error: error instanceof Error ? error.message : "unknown",
        });

        const authError = new Error("Authentication error") as Error & {
          data?: { closeCode: number; reason: string };
        };
        authError.data = {
          closeCode: WS_CLOSE_CODES.policyViolation,
          reason: "Authentication error",
        };
        next(authError);
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
          ...notification,
          type: "webhook" as const,
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
  private async validateAuthToken(token: string): Promise<AuthenticatedUser> {
    if (typeof token !== "string" || token.trim().length === 0) {
      throw this.createAuthError({
        code: WS_CLOSE_CODES.invalidPayload,
        reason: "Malformed authentication token",
        logKey: "token.malformed",
      });
    }

    const claims = await this.verifyTokenClaims(token);

    const organizationId = this.extractTenantId(claims);
    if (!organizationId) {
      throw this.createAuthError({
        code: WS_CLOSE_CODES.policyViolation,
        reason: "Token missing tenant/org claim",
        logKey: "token.missing_tenant",
      });
    }

    const authProfile = await this.fetchAuthoritativeAuthProfile(token);
    if (!authProfile.active || authProfile.revoked) {
      throw this.createAuthError({
        code: WS_CLOSE_CODES.policyViolation,
        reason: "Token revoked",
        logKey: "token.revoked",
      });
    }

    const userId =
      this.getStringValue(authProfile.user?.id) ??
      this.getStringValue(claims.sub) ??
      "";

    if (!userId) {
      throw this.createAuthError({
        code: WS_CLOSE_CODES.policyViolation,
        reason: "Token missing subject",
        logKey: "token.missing_subject",
      });
    }

    const permissions = this.derivePermissions(
      authProfile.user?.app_metadata,
      authProfile.user?.user_metadata
    );

    return {
      userId,
      organizationId,
      permissions,
    };
  }

  private async verifyTokenClaims(token: string): Promise<JWTPayload> {
    const expectedIssuer = process.env.WS_AUTH_ISSUER ?? process.env.SUPABASE_URL;
    const expectedAudience = process.env.WS_AUTH_AUDIENCE ?? "authenticated";

    if (!expectedIssuer) {
      throw this.createAuthError({
        code: WS_CLOSE_CODES.policyViolation,
        reason: "Auth issuer is not configured",
        logKey: "auth.issuer_missing",
      });
    }

    const jwtSecret = process.env.WS_AUTH_JWT_SECRET;
    const jwksUrl = process.env.WS_AUTH_JWKS_URL;

    try {
      if (jwtSecret) {
        const { payload } = await jwtVerify(token, createSecretKey(Buffer.from(jwtSecret)), {
          issuer: expectedIssuer,
          audience: expectedAudience,
        });
        return payload;
      }

      if (jwksUrl) {
        const jwks = createRemoteJWKSet(new URL(jwksUrl));
        const { payload } = await jwtVerify(token, jwks, {
          issuer: expectedIssuer,
          audience: expectedAudience,
        });
        return payload;
      }

      throw this.createAuthError({
        code: WS_CLOSE_CODES.policyViolation,
        reason: "Auth key material is not configured",
        logKey: "auth.key_missing",
      });
    } catch (error) {
      if (error instanceof WebSocketAuthError) {
        throw error;
      }

      const message = error instanceof Error ? error.message : "Unknown token validation error";

      const authFailure: AuthFailure =
        /\baud\b/i.test(message)
          ? {
              code: WS_CLOSE_CODES.policyViolation,
              reason: "Token audience mismatch",
              logKey: "token.bad_audience",
            }
          : /\bexp\b/i.test(message) || /expired/i.test(message)
            ? {
                code: WS_CLOSE_CODES.policyViolation,
                reason: "Token expired",
                logKey: "token.expired",
              }
            : {
                code: WS_CLOSE_CODES.policyViolation,
                reason: "Token signature/issuer validation failed",
                logKey: "token.invalid_signature_or_issuer",
              };

      throw this.createAuthError(authFailure, {
        detail: message,
      });
    }
  }

  private async fetchAuthoritativeAuthProfile(token: string): Promise<{
    active: boolean;
    revoked: boolean;
    user?: {
      id?: unknown;
      app_metadata?: Record<string, unknown>;
      user_metadata?: Record<string, unknown>;
    };
  }> {
    const providerUrl = process.env.WS_AUTH_PROVIDER_URL ?? process.env.SUPABASE_URL;
    if (!providerUrl) {
      throw this.createAuthError({
        code: WS_CLOSE_CODES.policyViolation,
        reason: "Auth provider URL is not configured",
        logKey: "auth.provider_missing",
      });
    }

    const endpoint = new URL("/auth/v1/user", providerUrl).toString();
    const response = await fetch(endpoint, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        apikey:
          process.env.WS_AUTH_PROVIDER_API_KEY ??
          process.env.SUPABASE_ANON_KEY ??
          process.env.SUPABASE_SERVICE_ROLE_KEY ??
          "",
      },
    });

    if (response.status === 401 || response.status === 403) {
      throw this.createAuthError({
        code: WS_CLOSE_CODES.policyViolation,
        reason: "Token revoked",
        logKey: "token.revoked",
      });
    }

    if (!response.ok) {
      throw this.createAuthError(
        {
          code: WS_CLOSE_CODES.policyViolation,
          reason: "Auth provider verification failed",
          logKey: "auth.provider_error",
        },
        { status: response.status }
      );
    }

    const user = (await response.json()) as {
      id?: unknown;
      app_metadata?: Record<string, unknown>;
      user_metadata?: Record<string, unknown>;
      revoked?: unknown;
    };

    return {
      active: true,
      revoked: user.revoked === true,
      user,
    };
  }

  private derivePermissions(
    appMetadata?: Record<string, unknown>,
    userMetadata?: Record<string, unknown>
  ): string[] {
    const roles = this.readStringArray(appMetadata?.roles);
    const entitlements = this.readStringArray(
      appMetadata?.entitlements ?? userMetadata?.entitlements
    );

    const permissions = new Set<string>(["basic"]);

    for (const role of roles) {
      permissions.add(`role:${role}`);
      if (role === "admin") {
        permissions.add("admin");
      }
      if (role === "premium" || role === "pro") {
        permissions.add("premium");
      }
    }

    for (const entitlement of entitlements) {
      permissions.add(entitlement);
      if (entitlement === "stream:premium") {
        permissions.add("premium");
      }
      if (entitlement === "stream:admin") {
        permissions.add("admin");
      }
    }

    return Array.from(permissions);
  }

  private extractTenantId(claims: JWTPayload): string | null {
    const directTenantId = this.getStringValue(claims.tenant_id ?? claims.organization_id);
    if (directTenantId) {
      return directTenantId;
    }

    const metadata = claims.user_metadata as Record<string, unknown> | undefined;
    const metadataTenantId = this.getStringValue(metadata?.tenant_id ?? metadata?.organization_id);
    return metadataTenantId ?? null;
  }

  private readStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return value.filter((entry): entry is string => typeof entry === "string" && entry.length > 0);
  }

  private getStringValue(value: unknown): string | null {
    return typeof value === "string" && value.length > 0 ? value : null;
  }

  private createAuthError(failure: AuthFailure, context?: Record<string, unknown>): WebSocketAuthError {
    this.logAuthFailure(failure.logKey, {
      reason: failure.reason,
      ...context,
    });
    return new WebSocketAuthError(failure.reason, failure.code, failure.reason);
  }

  private logAuthFailure(key: string, context: Record<string, unknown>): void {
    const now = Date.now();
    const currentWindow = this.authFailureLogWindow.get(key);

    if (!currentWindow || now - currentWindow.windowStart > AUTH_FAILURE_LOG_WINDOW_MS) {
      this.authFailureLogWindow.set(key, { windowStart: now, count: 1 });
      logger.warn("WebSocket authentication failure", { key, ...context });
      return;
    }

    if (currentWindow.count < AUTH_FAILURE_LOG_LIMIT) {
      currentWindow.count += 1;
      logger.warn("WebSocket authentication failure", {
        key,
        rateLimited: false,
        ...context,
      });
      return;
    }

    if (currentWindow.count === AUTH_FAILURE_LOG_LIMIT) {
      currentWindow.count += 1;
      logger.warn("WebSocket authentication failure logs suppressed", {
        key,
        rateLimited: true,
      });
      return;
    }

    currentWindow.count += 1;
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
