/**
 * WebSocket Manager
 * 
 * Manages WebSocket connections with reconnection logic, heartbeat,
 * and channel subscription system for real-time data streams.
 */

import { TenantContext } from '../TenantContext';
import { createLogger } from '../../lib/logger';

/**
 * WebSocket connection state
 */
export type ConnectionState = 
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'error';

/**
 * WebSocket message
 */
export interface WebSocketMessage {
  type: string;
  channel?: string;
  data: any;
  timestamp: string;
  messageId?: string;
}

/**
 * Channel subscription
 */
export interface ChannelSubscription {
  channel: string;
  callback: (data: any) => void;
  filter?: (data: any) => boolean;
}

/**
 * WebSocket configuration
 */
export interface WebSocketConfig {
  url: string;
  protocols?: string[];
  reconnect?: boolean;
  reconnectInterval?: number;
  reconnectMaxAttempts?: number;
  heartbeatInterval?: number;
  heartbeatTimeout?: number;
  debug?: boolean;
}

/**
 * Connection event
 */
export interface ConnectionEvent {
  type: 'open' | 'close' | 'error' | 'reconnect';
  timestamp: string;
  attempt?: number;
  error?: Error;
}

/**
 * WebSocket Manager Service
 */
export class WebSocketManager {
  private static instance: WebSocketManager;
  private ws: WebSocket | null = null;
  private config: Required<WebSocketConfig>;
  private logger = createLogger({ component: 'WebSocketManager' });
  private state: ConnectionState = 'disconnected';
  private subscriptions: Map<string, Set<ChannelSubscription>> = new Map();
  private reconnectAttempts = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private heartbeatTimeoutTimer: NodeJS.Timeout | null = null;
  private messageQueue: WebSocketMessage[] = [];
  private eventListeners: Map<string, Set<(event: ConnectionEvent) => void>> = new Map();
  private tenantContext?: TenantContext;

  private constructor(config: WebSocketConfig) {
    this.config = {
      url: config.url,
      protocols: config.protocols || [],
      reconnect: config.reconnect ?? true,
      reconnectInterval: config.reconnectInterval ?? 1000,
      reconnectMaxAttempts: config.reconnectMaxAttempts ?? 10,
      heartbeatInterval: config.heartbeatInterval ?? 30000,
      heartbeatTimeout: config.heartbeatTimeout ?? 5000,
      debug: config.debug ?? false,
    };
  }

  /**
   * Get singleton instance
   */
  public static getInstance(config?: WebSocketConfig): WebSocketManager {
    if (!WebSocketManager.instance && config) {
      WebSocketManager.instance = new WebSocketManager(config);
    }
    if (!WebSocketManager.instance) {
      throw new Error('WebSocketManager not initialized. Provide config on first call.');
    }
    return WebSocketManager.instance;
  }

  /**
   * Set tenant context for authentication
   */
  public setTenantContext(context: TenantContext): void {
    this.tenantContext = context;
  }

  /**
   * Connect to WebSocket server
   */
  public connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.state === 'connected' || this.state === 'connecting') {
        resolve();
        return;
      }

      this.setState('connecting');
      this.log('Connecting to WebSocket server...');

      try {
        this.ws = new WebSocket(this.config.url, this.config.protocols);

        this.ws.onopen = () => {
          this.log('WebSocket connected');
          this.setState('connected');
          this.reconnectAttempts = 0;
          this.startHeartbeat();
          this.authenticate();
          this.flushMessageQueue();
          this.emitEvent({ type: 'open', timestamp: new Date().toISOString() });
          resolve();
        };

        this.ws.onmessage = (event) => {
          this.handleMessage(event.data);
        };

        this.ws.onerror = (error) => {
          this.log('WebSocket error:', error);
          this.setState('error');
          const connectionError = new Error('WebSocket connection error');
          this.emitEvent({
            type: 'error',
            timestamp: new Date().toISOString(),
            error: connectionError,
          });
          reject(connectionError);
        };

        this.ws.onclose = (event) => {
          this.log('WebSocket closed:', event.code, event.reason);
          this.stopHeartbeat();
          this.emitEvent({
            type: 'close',
            timestamp: new Date().toISOString(),
          });

          if (this.config.reconnect && !event.wasClean) {
            this.reconnect();
          } else {
            this.setState('disconnected');
          }
        };
      } catch (error) {
        this.log('Failed to create WebSocket:', error);
        this.setState('error');
        reject(error);
      }
    });
  }

  /**
   * Disconnect from WebSocket server
   */
  public disconnect(): void {
    this.log('Disconnecting from WebSocket server...');
    this.config.reconnect = false;
    this.stopHeartbeat();
    this.clearReconnectTimer();

    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }

    this.setState('disconnected');
  }

  /**
   * Reconnect to WebSocket server
   */
  private reconnect(): void {
    if (this.reconnectAttempts >= this.config.reconnectMaxAttempts) {
      this.log('Max reconnection attempts reached');
      this.setState('error');
      return;
    }

    this.setState('reconnecting');
    this.reconnectAttempts++;

    const delay = this.config.reconnectInterval * Math.pow(2, this.reconnectAttempts - 1);
    this.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.config.reconnectMaxAttempts})`);

    this.emitEvent({
      type: 'reconnect',
      timestamp: new Date().toISOString(),
      attempt: this.reconnectAttempts,
    });

    this.reconnectTimer = setTimeout(() => {
      this.connect().catch((error) => {
        this.log('Reconnection failed:', error);
      });
    }, delay);
  }

  /**
   * Subscribe to a channel
   */
  public subscribe(
    channel: string,
    callback: (data: any) => void,
    filter?: (data: any) => boolean
  ): () => void {
    const subscription: ChannelSubscription = { channel, callback, filter };

    if (!this.subscriptions.has(channel)) {
      this.subscriptions.set(channel, new Set());
    }

    this.subscriptions.get(channel)!.add(subscription);
    this.log(`Subscribed to channel: ${channel}`);

    // Send subscription message to server
    this.send({
      type: 'subscribe',
      channel,
      data: {},
      timestamp: new Date().toISOString(),
    });

    // Return unsubscribe function
    return () => {
      this.unsubscribe(channel, subscription);
    };
  }

  /**
   * Unsubscribe from a channel
   */
  private unsubscribe(channel: string, subscription: ChannelSubscription): void {
    const channelSubs = this.subscriptions.get(channel);
    if (channelSubs) {
      channelSubs.delete(subscription);
      if (channelSubs.size === 0) {
        this.subscriptions.delete(channel);
        this.send({
          type: 'unsubscribe',
          channel,
          data: {},
          timestamp: new Date().toISOString(),
        });
        this.log(`Unsubscribed from channel: ${channel}`);
      }
    }
  }

  /**
   * Send message to WebSocket server
   */
  public send(message: WebSocketMessage): void {
    if (this.state !== 'connected') {
      this.log('WebSocket not connected, queueing message');
      this.messageQueue.push(message);
      return;
    }

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
      this.log('Sent message:', message);
    } else {
      this.messageQueue.push(message);
    }
  }

  /**
   * Handle incoming message
   */
  private handleMessage(data: string): void {
    try {
      const message: WebSocketMessage = JSON.parse(data);
      this.log('Received message:', message);

      // Handle heartbeat response
      if (message.type === 'pong') {
        this.handleHeartbeatResponse();
        return;
      }

      // Route message to channel subscribers
      if (message.channel) {
        const channelSubs = this.subscriptions.get(message.channel);
        if (channelSubs) {
          channelSubs.forEach((sub) => {
            if (!sub.filter || sub.filter(message.data)) {
              sub.callback(message.data);
            }
          });
        }
      }

      // Route message to wildcard subscribers
      const wildcardSubs = this.subscriptions.get('*');
      if (wildcardSubs) {
        wildcardSubs.forEach((sub) => {
          if (!sub.filter || sub.filter(message.data)) {
            sub.callback(message.data);
          }
        });
      }
    } catch (error) {
      this.log('Failed to parse message:', error);
    }
  }

  /**
   * Authenticate with server
   */
  private authenticate(): void {
    if (!this.tenantContext) {
      this.log('No tenant context, skipping authentication');
      return;
    }

    this.send({
      type: 'authenticate',
      data: {
        tenantId: this.tenantContext.tenantId,
        organizationId: this.tenantContext.organizationId,
        userId: this.tenantContext.userId,
        sessionId: this.tenantContext.sessionId,
      },
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Start heartbeat
   */
  private startHeartbeat(): void {
    this.stopHeartbeat();

    this.heartbeatTimer = setInterval(() => {
      this.sendHeartbeat();
    }, this.config.heartbeatInterval);
  }

  /**
   * Stop heartbeat
   */
  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    if (this.heartbeatTimeoutTimer) {
      clearTimeout(this.heartbeatTimeoutTimer);
      this.heartbeatTimeoutTimer = null;
    }
  }

  /**
   * Send heartbeat
   */
  private sendHeartbeat(): void {
    this.send({
      type: 'ping',
      data: {},
      timestamp: new Date().toISOString(),
    });

    // Set timeout for heartbeat response
    this.heartbeatTimeoutTimer = setTimeout(() => {
      this.log('Heartbeat timeout, reconnecting...');
      this.ws?.close();
    }, this.config.heartbeatTimeout);
  }

  /**
   * Handle heartbeat response
   */
  private handleHeartbeatResponse(): void {
    if (this.heartbeatTimeoutTimer) {
      clearTimeout(this.heartbeatTimeoutTimer);
      this.heartbeatTimeoutTimer = null;
    }
  }

  /**
   * Flush message queue
   */
  private flushMessageQueue(): void {
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift();
      if (message) {
        this.send(message);
      }
    }
  }

  /**
   * Clear reconnect timer
   */
  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  /**
   * Set connection state
   */
  private setState(state: ConnectionState): void {
    this.state = state;
    this.log(`Connection state: ${state}`);
  }

  /**
   * Get connection state
   */
  public getState(): ConnectionState {
    return this.state;
  }

  /**
   * Check if connected
   */
  public isConnected(): boolean {
    return this.state === 'connected';
  }

  /**
   * Add event listener
   */
  public addEventListener(
    type: ConnectionEvent['type'],
    callback: (event: ConnectionEvent) => void
  ): () => void {
    if (!this.eventListeners.has(type)) {
      this.eventListeners.set(type, new Set());
    }

    this.eventListeners.get(type)!.add(callback);

    // Return remove listener function
    return () => {
      this.eventListeners.get(type)?.delete(callback);
    };
  }

  /**
   * Emit event
   */
  private emitEvent(event: ConnectionEvent): void {
    const listeners = this.eventListeners.get(event.type);
    if (listeners) {
      listeners.forEach((callback) => callback(event));
    }
  }

  /**
   * Log message
   */
  private log(...args: any[]): void {
    if (this.config.debug) {
      this.logger.debug('WebSocket manager debug', { args });
    }
  }

  /**
   * Get statistics
   */
  public getStats(): {
    state: ConnectionState;
    reconnectAttempts: number;
    subscriptions: number;
    queuedMessages: number;
  } {
    return {
      state: this.state,
      reconnectAttempts: this.reconnectAttempts,
      subscriptions: this.subscriptions.size,
      queuedMessages: this.messageQueue.length,
    };
  }
}

export default WebSocketManager;
