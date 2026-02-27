"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebSocketServer = void 0;
const socket_io_1 = require("socket.io");
const logger_1 = require("../../lib/logger");
const Cache_1 = require("../core/Cache");
class WebSocketServer {
    io;
    clients = new Map();
    channels = new Map(); // channel -> client IDs
    cache = (0, Cache_1.getCache)();
    constructor(httpServer) {
        this.io = new socket_io_1.Server(httpServer, {
            cors: {
                origin: process.env.CORS_ORIGIN || "*",
                methods: ["GET", "POST"],
                credentials: true,
            },
            transports: ["websocket", "polling"],
        });
        this.setupMiddleware();
        this.setupEventHandlers();
        this.startHealthMonitoring();
    }
    /**
     * Set up authentication and authorization middleware
     */
    setupMiddleware() {
        this.io.use(async (socket, next) => {
            try {
                // Extract authentication token
                const token = socket.handshake.auth.token || socket.handshake.query.token;
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
                logger_1.logger.info("WebSocket client authenticated", {
                    socketId: socket.id,
                    userId: userData.userId,
                });
                next();
            }
            catch (error) {
                logger_1.logger.error("WebSocket authentication error", error instanceof Error ? error : undefined);
                next(new Error("Authentication error"));
            }
        });
    }
    /**
     * Set up socket event handlers
     */
    setupEventHandlers() {
        this.io.on("connection", (socket) => {
            const client = {
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
            logger_1.logger.info("WebSocket client connected", {
                socketId: socket.id,
                authenticated: client.authenticated,
                permissions: client.permissions,
                totalClients: this.clients.size,
            });
            // Handle subscription requests
            socket.on("subscribe", (message) => {
                this.handleSubscription(socket, message);
            });
            socket.on("unsubscribe", (message) => {
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
    handleSubscription(socket, message) {
        const client = this.clients.get(socket.id);
        if (!client)
            return;
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
                this.channels.get(channel).add(socket.id);
                logger_1.logger.debug("Client subscribed to channel", {
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
        }
        catch (error) {
            logger_1.logger.error("Subscription handling error", error instanceof Error ? error : undefined, {
                socketId: socket.id,
                channels: message.channels,
            });
        }
    }
    /**
     * Handle client unsubscription requests
     */
    handleUnsubscription(socket, message) {
        const client = this.clients.get(socket.id);
        if (!client)
            return;
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
    handleDisconnection(socketId, reason) {
        const client = this.clients.get(socketId);
        if (!client)
            return;
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
        logger_1.logger.info("WebSocket client disconnected", {
            socketId,
            reason,
            subscriptionsCount: client.subscriptions.size,
            totalClients: this.clients.size,
        });
    }
    /**
     * Broadcast data to subscribed clients
     */
    broadcastToChannel(channel, data) {
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
        logger_1.logger.debug("Broadcasted data to channel", {
            channel,
            recipients: sentCount,
            totalSubscribers: channelClients.size,
        });
    }
    /**
     * Send data to specific client
     */
    sendToClient(clientId, data) {
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
    broadcastWebhook(notification) {
        const message = {
            type: "webhook",
            ...notification,
            serverTimestamp: Date.now(),
        };
        this.io.emit("webhook", message);
        logger_1.logger.info("Broadcasted webhook notification", {
            notificationId: notification.id,
            type: notification.type,
            priority: notification.priority,
            recipients: this.clients.size,
        });
    }
    /**
     * Send targeted webhook notification
     */
    sendWebhookToRecipients(notification) {
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
        logger_1.logger.info("Sent targeted webhook notification", {
            notificationId: notification.id,
            type: notification.type,
            recipients: notification.recipients.length,
            delivered: sentCount,
        });
    }
    /**
     * Check if client has permission to access a channel
     */
    checkChannelPermission(client, channel) {
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
            return (client.permissions.includes("premium") ||
                client.permissions.includes("admin"));
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
    async validateAuthToken(token) {
        try {
            // This would integrate with your authentication system
            // For now, return mock data
            return {
                userId: "user_" + token.substring(0, 8),
                permissions: ["basic", "premium"],
            };
        }
        catch (error) {
            return null;
        }
    }
    /**
     * Start health monitoring for connections
     */
    startHealthMonitoring() {
        // Clean up stale connections every 30 seconds
        setInterval(() => {
            const now = Date.now();
            const staleThreshold = 5 * 60 * 1000; // 5 minutes
            for (const [socketId, client] of this.clients.entries()) {
                if (now - client.lastActivity.getTime() > staleThreshold) {
                    logger_1.logger.warn("Removing stale WebSocket connection", {
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
    getStats() {
        const authenticatedClients = Array.from(this.clients.values()).filter((client) => client.authenticated).length;
        const channelSubscriptions = {};
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
    async shutdown() {
        logger_1.logger.info("Shutting down WebSocket server");
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
exports.WebSocketServer = WebSocketServer;
//# sourceMappingURL=WebSocketServer.js.map