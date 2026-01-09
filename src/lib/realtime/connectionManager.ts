/**
 * Realtime Connection Manager
 * 
 * Handles connection state, error recovery, and reconnection logic
 * for Supabase Realtime connections.
 */

import { logger } from '../logger';
import { captureError, ErrorCategory, ErrorSeverity } from '../monitoring/errorMonitoring';

// Connection state
export enum ConnectionState {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  RECONNECTING = 'reconnecting',
  ERROR = 'error',
}

// Connection error types
export enum ConnectionErrorType {
  NETWORK_ERROR = 'network_error',
  AUTH_ERROR = 'auth_error',
  TIMEOUT_ERROR = 'timeout_error',
  SUBSCRIPTION_ERROR = 'subscription_error',
  UNKNOWN_ERROR = 'unknown_error',
}

// Connection error interface
export interface ConnectionError {
  type: ConnectionErrorType;
  message: string;
  timestamp: string;
  retryable: boolean;
}

// Connection state change callback
export type ConnectionStateCallback = (state: ConnectionState, error?: ConnectionError) => void;

// Reconnection strategy
export interface ReconnectionStrategy {
  maxAttempts: number;
  initialDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
}

class ConnectionManager {
  private state: ConnectionState = ConnectionState.DISCONNECTED;
  private reconnectAttempts = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private stateCallbacks: Set<ConnectionStateCallback> = new Set();
  private lastError: ConnectionError | null = null;

  private strategy: ReconnectionStrategy = {
    maxAttempts: 5,
    initialDelay: 1000,
    maxDelay: 30000,
    backoffMultiplier: 2,
  };

  /**
   * Set connection state
   */
  public setState(state: ConnectionState, error?: ConnectionError): void {
    const previousState = this.state;
    this.state = state;

    if (error) {
      this.lastError = error;
      logger.error('Connection error', new Error(error.message), {
        type: error.type,
        retryable: error.retryable,
      });

      // Capture error for monitoring
      captureError(new Error(error.message), {
        severity: ErrorSeverity.HIGH,
        category: ErrorCategory.NETWORK,
        context: {
          connectionState: state,
          errorType: error.type,
          retryable: error.retryable,
        },
      });
    }

    logger.info('Connection state changed', {
      from: previousState,
      to: state,
      error: error?.message,
    });

    // Notify callbacks
    this.stateCallbacks.forEach((callback) => {
      try {
        callback(state, error);
      } catch (err) {
        logger.error('State callback error', err as Error);
      }
    });

    // Handle reconnection
    if (state === ConnectionState.ERROR && error?.retryable) {
      this.scheduleReconnect();
    }
  }

  /**
   * Get current state
   */
  public getState(): ConnectionState {
    return this.state;
  }

  /**
   * Get last error
   */
  public getLastError(): ConnectionError | null {
    return this.lastError;
  }

  /**
   * Subscribe to state changes
   */
  public onStateChange(callback: ConnectionStateCallback): () => void {
    this.stateCallbacks.add(callback);

    // Return unsubscribe function
    return () => {
      this.stateCallbacks.delete(callback);
    };
  }

  /**
   * Schedule reconnection attempt
   */
  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.strategy.maxAttempts) {
      logger.error(
        'Max reconnection attempts reached',
        new Error('Connection failed permanently')
      );
      this.setState(ConnectionState.ERROR, {
        type: ConnectionErrorType.UNKNOWN_ERROR,
        message: 'Max reconnection attempts reached',
        timestamp: new Date().toISOString(),
        retryable: false,
      });
      return;
    }

    // Clear existing timer
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    // Calculate delay with exponential backoff
    const delay = Math.min(
      this.strategy.initialDelay * Math.pow(this.strategy.backoffMultiplier, this.reconnectAttempts),
      this.strategy.maxDelay
    );

    this.reconnectAttempts++;

    logger.info('Scheduling reconnection', {
      attempt: this.reconnectAttempts,
      maxAttempts: this.strategy.maxAttempts,
      delay,
    });

    this.setState(ConnectionState.RECONNECTING);

    this.reconnectTimer = setTimeout(() => {
      this.attemptReconnect();
    }, delay);
  }

  /**
   * Attempt to reconnect
   */
  private attemptReconnect(): void {
    logger.info('Attempting reconnection', {
      attempt: this.reconnectAttempts,
    });

    this.setState(ConnectionState.CONNECTING);

    // Reconnection will be handled by the service layer
    // This just manages the state and timing
  }

  /**
   * Reset reconnection state
   */
  public resetReconnection(): void {
    this.reconnectAttempts = 0;
    this.lastError = null;

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  /**
   * Handle successful connection
   */
  public handleConnected(): void {
    this.resetReconnection();
    this.setState(ConnectionState.CONNECTED);
  }

  /**
   * Handle connection error
   */
  public handleError(error: ConnectionError): void {
    this.setState(ConnectionState.ERROR, error);
  }

  /**
   * Handle disconnection
   */
  public handleDisconnected(): void {
    this.setState(ConnectionState.DISCONNECTED);
  }

  /**
   * Set reconnection strategy
   */
  public setReconnectionStrategy(strategy: Partial<ReconnectionStrategy>): void {
    this.strategy = { ...this.strategy, ...strategy };
  }

  /**
   * Get reconnection strategy
   */
  public getReconnectionStrategy(): ReconnectionStrategy {
    return { ...this.strategy };
  }

  /**
   * Check if connection is healthy
   */
  public isHealthy(): boolean {
    return this.state === ConnectionState.CONNECTED;
  }

  /**
   * Check if reconnecting
   */
  public isReconnecting(): boolean {
    return this.state === ConnectionState.RECONNECTING;
  }

  /**
   * Cleanup
   */
  public cleanup(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    this.stateCallbacks.clear();
    this.resetReconnection();
    this.setState(ConnectionState.DISCONNECTED);
  }
}

/**
 * Create connection error
 */
export function createConnectionError(
  type: ConnectionErrorType,
  message: string,
  retryable: boolean = true
): ConnectionError {
  return {
    type,
    message,
    timestamp: new Date().toISOString(),
    retryable,
  };
}

/**
 * Categorize error
 */
export function categorizeError(error: Error): ConnectionError {
  const message = error.message.toLowerCase();

  if (message.includes('network') || message.includes('fetch')) {
    return createConnectionError(
      ConnectionErrorType.NETWORK_ERROR,
      error.message,
      true
    );
  }

  if (message.includes('auth') || message.includes('unauthorized')) {
    return createConnectionError(
      ConnectionErrorType.AUTH_ERROR,
      error.message,
      false
    );
  }

  if (message.includes('timeout')) {
    return createConnectionError(
      ConnectionErrorType.TIMEOUT_ERROR,
      error.message,
      true
    );
  }

  if (message.includes('subscription') || message.includes('channel')) {
    return createConnectionError(
      ConnectionErrorType.SUBSCRIPTION_ERROR,
      error.message,
      true
    );
  }

  return createConnectionError(
    ConnectionErrorType.UNKNOWN_ERROR,
    error.message,
    true
  );
}

// Singleton instance
let connectionManagerInstance: ConnectionManager | null = null;

/**
 * Get connection manager instance
 */
export function getConnectionManager(): ConnectionManager {
  if (!connectionManagerInstance) {
    connectionManagerInstance = new ConnectionManager();
  }
  return connectionManagerInstance;
}

// Export singleton instance getter
export default getConnectionManager;
