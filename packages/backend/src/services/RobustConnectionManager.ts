/**
 * Robust Connection Manager
 *
 * Provides multiple connection strategies with automatic failover,
 * health monitoring, and self-healing capabilities for WebSocket connections.
 *
 * Features:
 * - Multiple connection strategies (WebSocket, polling, SSE)
 * - Automatic failover between strategies
 * - Connection health monitoring with metrics
 * - Self-healing with exponential backoff
 * - Environment-aware configuration
 * - Comprehensive error handling and logging
 */

import { logger } from '../lib/logger';
import { getEnvVar } from '../lib/env';

/**
 * Connection strategy types
 */
export type ConnectionStrategy = 'websocket' | 'polling' | 'sse';

/**
 * Connection state
 */
export type RobustConnectionState =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'degraded'
  | 'error';

/**
 * Connection health metrics
 */
export interface ConnectionHealth {
  state: RobustConnectionState;
  strategy: ConnectionStrategy;
  reconnectAttempts: number;
  lastSuccessfulConnection: number;
  totalUptime: number;
  totalDowntime: number;
  averageLatency: number;
  packetLoss: number;
  isHealthy: boolean;
  lastError?: string;
}

/**
 * Connection options
 */
export interface RobustConnectionOptions {
  primaryStrategy: ConnectionStrategy;
  fallbackStrategies: ConnectionStrategy[];
  websocketUrl: string;
  pollingUrl?: string;
  sseUrl?: string;
  reconnect: boolean;
  maxReconnectAttempts: number;
  initialReconnectDelay: number;
  maxReconnectDelay: number;
  backoffMultiplier: number;
  connectionTimeout: number;
  heartbeatInterval: number;
  healthCheckInterval: number;
  workspaceId: string;
  userId: string;
}

/**
 * Message interface
 */
export interface ConnectionMessage {
  type: string;
  payload: any;
  timestamp: number;
  messageId: string;
  strategy: ConnectionStrategy;
}

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
 * Robust Connection Manager
 */
export class RobustConnectionManager extends BrowserEventEmitter {
  private currentStrategy: ConnectionStrategy;
  private state: RobustConnectionState = 'disconnected';
  private options: RobustConnectionOptions;
  private reconnectAttempts = 0;
  private reconnectTimer: number | null = null;
  private heartbeatTimer: number | null = null;
  private healthCheckTimer: number | null = null;
  private connectionTimer: number | null = null;
  private messageQueue: ConnectionMessage[] = [];
  private readonly MAX_QUEUE_SIZE = 100;

  // Health tracking
  private lastSuccessfulConnection = 0;
  private connectionStartTime = 0;
  private totalUptime = 0;
  private totalDowntime = 0;
  private latencySamples: number[] = [];
  private packetCount = 0;
  private lostPackets = 0;
  private lastHeartbeat = 0;
  private lastError = '';

  // Strategy implementations
  private websocket: WebSocket | null = null;
  private pollingTimer: number | null = null;
  private eventSource: EventSource | null = null;

  constructor(options: Partial<RobustConnectionOptions> = {}) {
    super();

    // Environment-aware defaults
    const devFlag = getEnvVar("DEV");
    const isDevelopment =
      devFlag !== undefined ? devFlag !== "false" : getEnvVar("NODE_ENV") === "development";
    const isCodespaces = typeof window !== 'undefined' &&
                        window.location.hostname.includes('github.dev');

    this.options = {
      primaryStrategy: 'websocket',
      fallbackStrategies: ['polling'],
      websocketUrl: isDevelopment
        ? `ws://localhost:${getEnvVar("VITE_HMR_PORT") || '24678'}`
        : `wss://${window.location.host}`,
      pollingUrl: `${window.location.origin}/api/poll`,
      sseUrl: `${window.location.origin}/api/events`,
      reconnect: true,
      maxReconnectAttempts: isDevelopment ? 5 : 10,
      initialReconnectDelay: 1000,
      maxReconnectDelay: 30000,
      backoffMultiplier: 1.5,
      connectionTimeout: 10000,
      heartbeatInterval: 30000,
      healthCheckInterval: 10000,
      workspaceId: '',
      userId: '',
      ...options,
    };

    this.currentStrategy = this.options.primaryStrategy;
  }

  /**
   * Connect using the best available strategy
   */
  async connect(): Promise<void> {
    if (this.state === 'connected' || this.state === 'connecting') {
      logger.warn('Already connected or connecting');
      return;
    }

    this.setState('connecting');
    this.connectionStartTime = Date.now();

    try {
      await this.attemptConnection(this.currentStrategy);
    } catch (error) {
      logger.error('Failed to connect with primary strategy', {
        strategy: this.currentStrategy,
        error: error instanceof Error ? error.message : String(error),
      });

      // Try fallback strategies
      await this.tryFallbackStrategies();
    }
  }

  /**
   * Disconnect from all strategies
   */
  async disconnect(): Promise<void> {
    logger.info('Disconnecting from all strategies');

    this.clearAllTimers();
    this.closeAllConnections();
    this.setState('disconnected');
    this.reconnectAttempts = 0;
  }

  /**
   * Send message using current strategy
   */
  async send(message: Omit<ConnectionMessage, 'timestamp' | 'messageId' | 'strategy'>): Promise<void> {
    const fullMessage: ConnectionMessage = {
      ...message,
      timestamp: Date.now(),
      messageId: this.generateMessageId(),
      strategy: this.currentStrategy,
    };

    if (this.state !== 'connected') {
      logger.warn('Not connected, queueing message');
      this.queueMessage(fullMessage);
      return;
    }

    try {
      await this.sendWithStrategy(fullMessage);
      logger.debug('Message sent', { type: message.type, messageId: fullMessage.messageId });
    } catch (error) {
      logger.error('Failed to send message', {
        error: error instanceof Error ? error.message : String(error),
      });
      this.queueMessage(fullMessage);
    }
  }

  /**
   * Get current connection health
   */
  getHealth(): ConnectionHealth {
    const now = Date.now();
    const timeSinceLastHeartbeat = now - this.lastHeartbeat;
    const averageLatency = this.latencySamples.length > 0
      ? this.latencySamples.reduce((a, b) => a + b, 0) / this.latencySamples.length
      : 0;
    const packetLoss = this.packetCount > 0 ? (this.lostPackets / this.packetCount) * 100 : 0;

    // Consider healthy if connected and recent heartbeat
    const isHealthy = this.state === 'connected' &&
                     timeSinceLastHeartbeat < this.options.heartbeatInterval * 2;

    return {
      state: this.state,
      strategy: this.currentStrategy,
      reconnectAttempts: this.reconnectAttempts,
      lastSuccessfulConnection: this.lastSuccessfulConnection,
      totalUptime: this.totalUptime,
      totalDowntime: this.totalDowntime,
      averageLatency,
      packetLoss,
      isHealthy,
      lastError: this.lastError || undefined,
    };
  }

  /**
   * Force reconnection with different strategy
   */
  async forceReconnect(strategy?: ConnectionStrategy): Promise<void> {
    logger.info('Forcing reconnection', { strategy });

    await this.disconnect();

    if (strategy) {
      this.currentStrategy = strategy;
    }

    await this.connect();
  }

  /**
   * Attempt connection with specific strategy
   */
  private async attemptConnection(strategy: ConnectionStrategy): Promise<void> {
    logger.info('Attempting connection', { strategy });

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Connection timeout for ${strategy}`));
      }, this.options.connectionTimeout);

      this.connectWithStrategy(strategy)
        .then(() => {
          clearTimeout(timeout);
          resolve();
        })
        .catch((error) => {
          clearTimeout(timeout);
          reject(error);
        });
    });
  }

  /**
   * Connect using specific strategy
   */
  private async connectWithStrategy(strategy: ConnectionStrategy): Promise<void> {
    switch (strategy) {
      case 'websocket':
        await this.connectWebSocket();
        break;
      case 'polling':
        await this.connectPolling();
        break;
      case 'sse':
        await this.connectSSE();
        break;
      default:
        throw new Error(`Unknown strategy: ${strategy}`);
    }
  }

  /**
   * WebSocket connection
   */
  private async connectWebSocket(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const url = `${this.options.websocketUrl}?workspaceId=${this.options.workspaceId}&userId=${this.options.userId}`;
        this.websocket = new WebSocket(url);

        this.websocket.onopen = () => {
          logger.info('WebSocket connected');
          this.onConnectionSuccess();
          resolve();
        };

        this.websocket.onmessage = (event) => {
          this.handleMessage(event, 'websocket');
        };

        this.websocket.onerror = (event) => {
          logger.error('WebSocket error', { event });
          reject(new Error('WebSocket connection failed'));
        };

        this.websocket.onclose = (event) => {
          logger.info('WebSocket closed', { code: event.code, reason: event.reason });
          this.handleDisconnection();
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Polling connection (fallback)
   */
  private async connectPolling(): Promise<void> {
    logger.info('Starting polling connection');
    this.startPolling();
    this.onConnectionSuccess();
  }

  /**
   * SSE connection (fallback)
   */
  private async connectSSE(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const url = `${this.options.sseUrl}?workspaceId=${this.options.workspaceId}&userId=${this.options.userId}`;
        this.eventSource = new EventSource(url);

        this.eventSource.onopen = () => {
          logger.info('SSE connected');
          this.onConnectionSuccess();
          resolve();
        };

        this.eventSource.onmessage = (event) => {
          this.handleMessage(event, 'sse');
        };

        this.eventSource.onerror = (event) => {
          logger.error('SSE error', { event });
          reject(new Error('SSE connection failed'));
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Handle successful connection
   */
  private onConnectionSuccess(): void {
    this.setState('connected');
    this.lastSuccessfulConnection = Date.now();
    this.reconnectAttempts = 0;
    this.startHeartbeat();
    this.startHealthCheck();
    this.flushMessageQueue();

    const connectionTime = Date.now() - this.connectionStartTime;
    logger.info('Connection established', {
      strategy: this.currentStrategy,
      connectionTime,
    });
  }

  /**
   * Handle disconnection
   */
  private handleDisconnection(): void {
    this.setState('disconnected');
    this.clearAllTimers();

    if (this.options.reconnect) {
      this.scheduleReconnect();
    }
  }

  /**
   * Try fallback strategies
   */
  private async tryFallbackStrategies(): Promise<void> {
    for (const strategy of this.options.fallbackStrategies) {
      if (strategy === this.currentStrategy) continue;

      try {
        logger.info('Trying fallback strategy', { strategy });
        this.currentStrategy = strategy;
        await this.attemptConnection(strategy);
        return;
      } catch (error) {
        logger.warn('Fallback strategy failed', { strategy, error: error instanceof Error ? error.message : String(error) });
      }
    }

    // All strategies failed
    this.setState('error');
    this.lastError = 'All connection strategies failed';
    this.emit('connection_failed');
  }

  /**
   * Schedule reconnection with exponential backoff
   */
  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.options.maxReconnectAttempts) {
      logger.error('Max reconnect attempts reached');
      this.emit('max_reconnect_attempts');
      return;
    }

    this.reconnectAttempts++;
    this.setState('reconnecting');

    const delay = Math.min(
      this.options.initialReconnectDelay * Math.pow(this.options.backoffMultiplier, this.reconnectAttempts - 1),
      this.options.maxReconnectDelay
    );

    logger.info('Scheduling reconnect', {
      attempt: this.reconnectAttempts,
      delay,
      strategy: this.currentStrategy,
    });

    this.reconnectTimer = window.setTimeout(() => {
      this.connect();
    }, delay);
  }

  /**
   * Start heartbeat
   */
  private startHeartbeat(): void {
    this.heartbeatTimer = window.setInterval(() => {
      if (this.state === 'connected') {
        this.lastHeartbeat = Date.now();
        this.send({
          type: 'heartbeat',
          payload: { timestamp: this.lastHeartbeat },
        });
      }
    }, this.options.heartbeatInterval);
  }

  /**
   * Start health check
   */
  private startHealthCheck(): void {
    this.healthCheckTimer = window.setInterval(() => {
      const health = this.getHealth();

      if (!health.isHealthy && this.state === 'connected') {
        logger.warn('Connection health degraded', health);
        this.setState('degraded');
        this.emit('health_degraded', health);
      }

      this.emit('health_check', health);
    }, this.options.healthCheckInterval);
  }

  /**
   * Start polling
   */
  private startPolling(): void {
    this.pollingTimer = window.setInterval(async () => {
      try {
        const response = await fetch(this.options.pollingUrl!, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          const messages = await response.json();
          messages.forEach((message: any) => {
            this.handleMessage({ data: JSON.stringify(message) }, 'polling');
          });
        }
      } catch (error) {
        logger.error('Polling request failed', { error });
      }
    }, 5000); // Poll every 5 seconds
  }

  /**
   * Send message with current strategy
   */
  private async sendWithStrategy(message: ConnectionMessage): Promise<void> {
    switch (this.currentStrategy) {
      case 'websocket':
        if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
          this.websocket.send(JSON.stringify(message));
        } else {
          throw new Error('WebSocket not connected');
        }
        break;
      case 'polling':
        // Send via HTTP POST
        const response = await fetch(this.options.pollingUrl!, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(message),
        });
        if (!response.ok) {
          throw new Error('Polling send failed');
        }
        break;
      case 'sse':
        // SSE is receive-only, can't send
        throw new Error('SSE does not support sending messages');
      default:
        throw new Error(`Unknown strategy: ${this.currentStrategy}`);
    }
  }

  /**
   * Handle incoming message
   */
  private handleMessage(event: any, strategy: ConnectionStrategy): void {
    try {
      const message: ConnectionMessage = typeof event.data === 'string'
        ? JSON.parse(event.data)
        : event.data;

      // Track latency for heartbeat responses
      if (message.type === 'heartbeat_response' && message.payload.originalTimestamp) {
        const latency = Date.now() - message.payload.originalTimestamp;
        this.trackLatency(latency);
      }

      this.packetCount++;

      logger.debug('Message received', {
        type: message.type,
        messageId: message.messageId,
        strategy,
      });

      this.emit('message', message);
      this.emit(message.type, message.payload);
    } catch (error) {
      logger.error('Failed to parse message', {
        error: error instanceof Error ? error.message : String(error),
      });
      this.lostPackets++;
    }
  }

  /**
   * Track latency sample
   */
  private trackLatency(latency: number): void {
    this.latencySamples.push(latency);
    if (this.latencySamples.length > 10) {
      this.latencySamples.shift(); // Keep only last 10 samples
    }
  }

  /**
   * Queue message for later sending
   */
  private queueMessage(message: ConnectionMessage): void {
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
   * Close all connections
   */
  private closeAllConnections(): void {
    if (this.websocket) {
      this.websocket.close();
      this.websocket = null;
    }

    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
    }

    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
  }

  /**
   * Clear all timers
   */
  private clearAllTimers(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }

    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }

    if (this.connectionTimer) {
      clearTimeout(this.connectionTimer);
      this.connectionTimer = null;
    }
  }

  /**
   * Set connection state and track uptime/downtime
   */
  private setState(state: RobustConnectionState): void {
    const oldState = this.state;
    const now = Date.now();

    if (oldState === 'connected' && state !== 'connected') {
      // Transitioning from connected to not connected
      this.totalUptime += now - this.connectionStartTime;
    } else if (oldState !== 'connected' && state === 'connected') {
      // Transitioning to connected
      this.connectionStartTime = now;
    } else if (oldState !== 'connected' && state !== 'connected') {
      // Staying disconnected
      this.totalDowntime += now - this.connectionStartTime;
    }

    this.state = state;

    if (oldState !== state) {
      logger.info('Connection state changed', { from: oldState, to: state, strategy: this.currentStrategy });
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
export const robustConnectionManager = new RobustConnectionManager();
