/**
 * WebSocket Manager
 * 
 * Manages WebSocket connections for real-time SDUI updates.
 * Handles connection lifecycle, reconnection, and message routing.
 */

import { logger } from '../lib/logger';
import { EventEmitter } from 'events';

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
}

/**
 * WebSocket Manager
 */
export class WebSocketManager extends EventEmitter {
  private ws: WebSocket | null = null;
  private state: ConnectionState = 'disconnected';
  private options: ConnectionOptions | null = null;
  private reconnectAttempts = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private messageQueue: WebSocketMessage[] = [];
  private readonly MAX_QUEUE_SIZE = 100;

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
   * Create WebSocket connection
   */
  private async createConnection(): Promise<void> {
    if (!this.options) {
      throw new Error('Connection options not set');
    }

    return new Promise((resolve, reject) => {
      try {
        const url = this.buildUrl(this.options!);
        this.ws = new WebSocket(url);

        this.ws.onopen = () => {
          logger.info('WebSocket connected');
          this.setState('connected');
          this.reconnectAttempts = 0;
          this.startHeartbeat();
          this.flushMessageQueue();
          resolve();
        };

        this.ws.onmessage = (event) => {
          this.handleMessage(event);
        };

        this.ws.onerror = (error) => {
          logger.error('WebSocket error', { error });
          this.setState('error');
          reject(error);
        };

        this.ws.onclose = () => {
          logger.info('WebSocket closed');
          this.setState('disconnected');
          this.clearTimers();

          if (this.options?.reconnect) {
            this.scheduleReconnect();
          }
        };
      } catch (error) {
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

    logger.info('Scheduling reconnect', {
      attempt: this.reconnectAttempts,
      maxAttempts: this.options.maxReconnectAttempts,
      interval: this.options.reconnectInterval,
    });

    this.reconnectTimer = setTimeout(() => {
      this.connect(this.options!);
    }, this.options.reconnectInterval);
  }

  /**
   * Start heartbeat
   */
  private startHeartbeat(): void {
    if (!this.options?.heartbeatInterval) return;

    this.heartbeatTimer = setInterval(() => {
      if (this.state === 'connected') {
        this.send({
          type: 'heartbeat',
          payload: { timestamp: Date.now() },
          timestamp: Date.now(),
          messageId: this.generateMessageId(),
        });
      }
    }, this.options.heartbeatInterval);
  }

  /**
   * Clear timers
   */
  private clearTimers(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
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
