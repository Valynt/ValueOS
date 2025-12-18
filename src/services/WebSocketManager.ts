/**
 * WebSocket Manager
 * 
 * Manages WebSocket connections for real-time SDUI updates.
 * Handles connection lifecycle, reconnection, and message routing.
 * 
 * Features:
 * - Exponential backoff reconnection
 * - Multiple fallback URLs
 * - Connection health monitoring
 * - Automatic heartbeat with response tracking
 * - Connection timeout handling
 * - Comprehensive error handling and logging
 */

import { logger } from '../lib/logger';

/**
 * Browser-compatible EventEmitter
 */
class BrowserEventEmitter {
  private listeners: Map<string, Function[]> = new Map();

  on(event: string, listener: Function): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(listener);
  }

  off(event: string, listener: Function): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      const index = eventListeners.indexOf(listener);
      if (index > -1) {
        eventListeners.splice(index, 1);
      }
    }
  }

  // Alias for EventEmitter compatibility
  removeListener(event: string, listener: Function): void {
    this.off(event, listener);
  }

  emit(event: string, ...args: any[]): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.forEach(listener => listener(...args));
    }
  }

  removeAllListeners(event?: string): void {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
  }
}

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
  payload: any;
  timestamp: number;
  messageId: string;
}

/**
 * Connection options
 */
export interface ConnectionOptions {
  url: string;
  workspaceId: string;
  userId: string;
  reconnect?: boolean;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  heartbeatInterval?: number;
  exponentialBackoff?: boolean;
  backoffMultiplier?: number;
  maxBackoffInterval?: number;
  connectionTimeout?: number;
  fallbackUrls?: string[];
}

/**
 * WebSocket Manager
 */
export class WebSocketManager extends BrowserEventEmitter {
  private ws: WebSocket | null = null;
  private state: ConnectionState = 'disconnected';
  private options: ConnectionOptions | null = null;
  private reconnectAttempts = 0;
  private reconnectTimer: number | null = null; // Browser-compatible timer type
  private heartbeatTimer: number | null = null; // Browser-compatible timer type
  private connectionTimer: number | null = null; // Connection timeout timer
  private messageQueue: WebSocketMessage[] = [];
  private readonly MAX_QUEUE_SIZE = 100;
  private lastHeartbeat: number = 0;
  private connectionStartTime: number = 0;
  private healthCheckTimer: number | null = null;

  /**
   * Connect to WebSocket server
   */
  async connect(options: ConnectionOptions): Promise<void> {
    if (this.state === 'connected' || this.state === 'connecting') {
      logger.warn('Already connected or connecting');
      return;
    }

    this.options = {
      reconnect: true,
      reconnectInterval: 5000,
      maxReconnectAttempts: 10,
      heartbeatInterval: 30000,
      exponentialBackoff: true,
      backoffMultiplier: 1.5,
      maxBackoffInterval: 30000,
      connectionTimeout: 10000,
      fallbackUrls: [],
      ...options,
    };

    this.setState('connecting');

    try {
      await this.createConnection();
    } catch (error) {
      logger.error('Failed to connect', {
        error: error instanceof Error ? error.message : String(error),
      });
      this.setState('error');
      
      if (this.options.reconnect) {
        this.scheduleReconnect();
      }
    }
  }

  /**
   * Disconnect from WebSocket server
   */
  async disconnect(): Promise<void> {
    logger.info('Disconnecting WebSocket');

    this.clearTimers();

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.setState('disconnected');
    this.options = null;
    this.reconnectAttempts = 0;
  }

  /**
   * Send message
   */
  async send(message: WebSocketMessage): Promise<void> {
    if (this.state !== 'connected' || !this.ws) {
      logger.warn('Not connected, queueing message');
      this.queueMessage(message);
      return;
    }

    try {
      this.ws.send(JSON.stringify(message));
      logger.debug('Message sent', { type: message.type, messageId: message.messageId });
    } catch (error) {
      logger.error('Failed to send message', {
        error: error instanceof Error ? error.message : String(error),
      });
      this.queueMessage(message);
    }
  }

  /**
   * Get connection state
   */
  getState(): ConnectionState {
    return this.state;
  }

  /**
   * Is connected
   */
  isConnected(): boolean {
    return this.state === 'connected';
  }

  /**
   * Get connection health status
   */
  getConnectionHealth(): {
    state: ConnectionState;
    reconnectAttempts: number;
    lastHeartbeat: number;
    timeSinceLastHeartbeat: number;
    isHealthy: boolean;
  } {
    const now = Date.now();
    const timeSinceLastHeartbeat = now - this.lastHeartbeat;
    const isHealthy = this.state === 'connected' && 
                     timeSinceLastHeartbeat < (this.options?.heartbeatInterval || 30000) * 2;

    return {
      state: this.state,
      reconnectAttempts: this.reconnectAttempts,
      lastHeartbeat: this.lastHeartbeat,
      timeSinceLastHeartbeat,
      isHealthy,
    };
  }

  /**
   * Create WebSocket connection
   */
  private async createConnection(urlIndex: number = 0): Promise<void> {
    if (!this.options) {
      throw new Error('Connection options not set');
    }

    return new Promise((resolve, reject) => {
      try {
        const urls = [this.options!.url, ...this.options!.fallbackUrls!];
        const url = urls[urlIndex] || urls[0];
        
        this.connectionStartTime = Date.now();
        logger.info('Attempting WebSocket connection', { 
          url, 
          attempt: this.reconnectAttempts + 1,
          urlIndex 
        });

        this.ws = new WebSocket(url);

        // Set connection timeout
        this.connectionTimer = window.setTimeout(() => {
          logger.warn('WebSocket connection timeout', { url, timeout: this.options!.connectionTimeout });
          if (this.ws) {
            this.ws.close();
          }
          reject(new Error('Connection timeout'));
        }, this.options.connectionTimeout);

        this.ws.onopen = () => {
          logger.info('WebSocket connected', { 
            url, 
            connectionTime: Date.now() - this.connectionStartTime 
          });
          this.clearConnectionTimer();
          this.setState('connected');
          this.reconnectAttempts = 0;
          this.startHeartbeat();
          this.startHealthCheck();
          this.flushMessageQueue();
          resolve();
        };

        this.ws.onmessage = (event) => {
          this.handleMessage(event);
        };

        this.ws.onerror = (event) => {
          logger.error('WebSocket error event occurred', { event, url });
          this.clearConnectionTimer();
          this.setState('error');
          reject(new Error('WebSocket connection failed'));
        };

        this.ws.onclose = (event) => {
          logger.info('WebSocket closed', { 
            code: event.code, 
            reason: event.reason,
            url 
          });
          this.clearConnectionTimer();
          this.setState('disconnected');
          this.clearTimers();

          // Try next fallback URL if available
          if (event.code !== 1000 && urlIndex < urls.length - 1) {
            logger.info('Trying fallback URL', { nextUrlIndex: urlIndex + 1 });
            this.createConnection(urlIndex + 1).then(resolve).catch(reject);
            return;
          }

          if (this.options?.reconnect) {
            this.scheduleReconnect();
          }
        };
      } catch (error) {
        this.clearConnectionTimer();
        reject(error);
      }
    });
  }

  /**
   * Handle incoming message
   */
  private handleMessage(event: MessageEvent): void {
    try {
      const message: WebSocketMessage = JSON.parse(event.data);
      
      // Handle heartbeat responses
      if (message.type === 'heartbeat_response') {
        this.lastHeartbeat = Date.now();
        logger.debug('Heartbeat response received');
        return;
      }
      
      logger.debug('Message received', {
        type: message.type,
        messageId: message.messageId,
      });

      this.emit('message', message);
      this.emit(message.type, message.payload);
    } catch (error) {
      logger.error('Failed to parse message', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Schedule reconnection
   */
  private scheduleReconnect(): void {
    if (!this.options) return;

    if (this.reconnectAttempts >= this.options.maxReconnectAttempts!) {
      logger.error('Max reconnect attempts reached');
      this.emit('max_reconnect_attempts');
      return;
    }

    this.reconnectAttempts++;
    this.setState('reconnecting');

    let interval = this.options.reconnectInterval!;
    
    if (this.options.exponentialBackoff) {
      interval = Math.min(
        this.options.reconnectInterval! * Math.pow(this.options.backoffMultiplier!, this.reconnectAttempts - 1),
        this.options.maxBackoffInterval!
      );
    }

    logger.info('Scheduling reconnect', {
      attempt: this.reconnectAttempts,
      maxAttempts: this.options.maxReconnectAttempts,
      interval,
      exponentialBackoff: this.options.exponentialBackoff,
    });

    this.reconnectTimer = window.setTimeout(() => {
      this.connect(this.options!);
    }, interval);
  }

  /**
   * Start heartbeat
   */
  private startHeartbeat(): void {
    if (!this.options?.heartbeatInterval) return;

    this.heartbeatTimer = window.setInterval(() => {
      if (this.state === 'connected') {
        this.lastHeartbeat = Date.now();
        this.send({
          type: 'heartbeat',
          payload: { timestamp: this.lastHeartbeat },
          timestamp: this.lastHeartbeat,
          messageId: this.generateMessageId(),
        });
      }
    }, this.options.heartbeatInterval);
  }

  /**
   * Start health check monitoring
   */
  private startHealthCheck(): void {
    this.healthCheckTimer = window.setInterval(() => {
      if (this.state === 'connected') {
        const now = Date.now();
        const timeSinceLastHeartbeat = now - this.lastHeartbeat;
        
        // If we haven't received a heartbeat response in 2x the interval, consider unhealthy
        if (timeSinceLastHeartbeat > this.options!.heartbeatInterval! * 2) {
          logger.warn('WebSocket health check failed - no heartbeat response', {
            timeSinceLastHeartbeat,
            threshold: this.options!.heartbeatInterval! * 2
          });
          this.emit('health_check_failed');
          
          // Force reconnection if unhealthy
          if (this.ws) {
            this.ws.close(1000, 'Health check failed');
          }
        }
      }
    }, this.options!.heartbeatInterval! / 2); // Check twice per heartbeat interval
  }

  /**
   * Clear timers
   */
  private clearTimers(): void {
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.heartbeatTimer !== null) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }

    if (this.connectionTimer !== null) {
      clearTimeout(this.connectionTimer);
      this.connectionTimer = null;
    }

    if (this.healthCheckTimer !== null) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }
  }

  /**
   * Clear connection timer
   */
  private clearConnectionTimer(): void {
    if (this.connectionTimer !== null) {
      clearTimeout(this.connectionTimer);
      this.connectionTimer = null;
    }
  }

  /**
   * Queue message for later sending
   */
  private queueMessage(message: WebSocketMessage): void {
    if (this.messageQueue.length >= this.MAX_QUEUE_SIZE) {
      logger.warn('Message queue full, dropping oldest message');
      this.messageQueue.shift();
    }

    this.messageQueue.push(message);
    logger.debug('Message queued', { queueSize: this.messageQueue.length });
  }

  /**
   * Flush message queue
   */
  private flushMessageQueue(): void {
    if (this.messageQueue.length === 0) return;

    logger.info('Flushing message queue', { count: this.messageQueue.length });

    const messages = [...this.messageQueue];
    this.messageQueue = [];

    for (const message of messages) {
      this.send(message);
    }
  }

  /**
   * Build WebSocket URL
   */
  private buildUrl(options: ConnectionOptions): string {
    const params = new URLSearchParams({
      workspaceId: options.workspaceId,
      userId: options.userId,
    });

    return `${options.url}?${params.toString()}`;
  }

  /**
   * Set connection state
   */
  private setState(state: ConnectionState): void {
    const oldState = this.state;
    this.state = state;

    if (oldState !== state) {
      logger.info('Connection state changed', { from: oldState, to: state });
      this.emit('state_change', { from: oldState, to: state });
    }
  }

  /**
   * Generate message ID
   */
  private generateMessageId(): string {
    return `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Singleton instance
export const webSocketManager = new WebSocketManager();
