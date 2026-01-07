/**
 * Connection Manager Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getConnectionManager,
  ConnectionState,
  ConnectionErrorType,
  createConnectionError,
  categorizeError,
} from '../connectionManager';

describe('ConnectionManager', () => {
  let connectionManager: ReturnType<typeof getConnectionManager>;

  beforeEach(() => {
    vi.useFakeTimers();
    connectionManager = getConnectionManager();
  });

  afterEach(() => {
    vi.useRealTimers();
    connectionManager.cleanup();
  });

  describe('State Management', () => {
    it('should start in disconnected state', () => {
      expect(connectionManager.getState()).toBe(ConnectionState.DISCONNECTED);
    });

    it('should update state', () => {
      connectionManager.setState(ConnectionState.CONNECTING);
      expect(connectionManager.getState()).toBe(ConnectionState.CONNECTING);

      connectionManager.setState(ConnectionState.CONNECTED);
      expect(connectionManager.getState()).toBe(ConnectionState.CONNECTED);
    });

    it('should notify state change callbacks', () => {
      const callback = vi.fn();
      connectionManager.onStateChange(callback);

      connectionManager.setState(ConnectionState.CONNECTING);

      expect(callback).toHaveBeenCalledWith(ConnectionState.CONNECTING, undefined);
    });

    it('should handle multiple callbacks', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      connectionManager.onStateChange(callback1);
      connectionManager.onStateChange(callback2);

      connectionManager.setState(ConnectionState.CONNECTED);

      expect(callback1).toHaveBeenCalled();
      expect(callback2).toHaveBeenCalled();
    });

    it('should unsubscribe callbacks', () => {
      const callback = vi.fn();
      const unsubscribe = connectionManager.onStateChange(callback);

      unsubscribe();

      connectionManager.setState(ConnectionState.CONNECTED);

      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should store last error', () => {
      const error = createConnectionError(
        ConnectionErrorType.NETWORK_ERROR,
        'Network failure',
        true
      );

      connectionManager.setState(ConnectionState.ERROR, error);

      expect(connectionManager.getLastError()).toEqual(error);
    });

    it('should categorize network errors', () => {
      const error = new Error('Network request failed');
      const categorized = categorizeError(error);

      expect(categorized.type).toBe(ConnectionErrorType.NETWORK_ERROR);
      expect(categorized.retryable).toBe(true);
    });

    it('should categorize auth errors', () => {
      const error = new Error('Unauthorized access');
      const categorized = categorizeError(error);

      expect(categorized.type).toBe(ConnectionErrorType.AUTH_ERROR);
      expect(categorized.retryable).toBe(false);
    });

    it('should categorize timeout errors', () => {
      const error = new Error('Request timeout');
      const categorized = categorizeError(error);

      expect(categorized.type).toBe(ConnectionErrorType.TIMEOUT_ERROR);
      expect(categorized.retryable).toBe(true);
    });

    it('should categorize subscription errors', () => {
      const error = new Error('Channel subscription failed');
      const categorized = categorizeError(error);

      expect(categorized.type).toBe(ConnectionErrorType.SUBSCRIPTION_ERROR);
      expect(categorized.retryable).toBe(true);
    });

    it('should categorize unknown errors', () => {
      const error = new Error('Something went wrong');
      const categorized = categorizeError(error);

      expect(categorized.type).toBe(ConnectionErrorType.UNKNOWN_ERROR);
      expect(categorized.retryable).toBe(true);
    });
  });

  describe('Reconnection', () => {
    it('should schedule reconnection on retryable error', () => {
      const error = createConnectionError(
        ConnectionErrorType.NETWORK_ERROR,
        'Network failure',
        true
      );

      connectionManager.setState(ConnectionState.ERROR, error);

      expect(connectionManager.getState()).toBe(ConnectionState.RECONNECTING);
    });

    it('should not reconnect on non-retryable error', () => {
      const error = createConnectionError(
        ConnectionErrorType.AUTH_ERROR,
        'Unauthorized',
        false
      );

      connectionManager.setState(ConnectionState.ERROR, error);

      expect(connectionManager.getState()).toBe(ConnectionState.ERROR);
    });

    it('should use exponential backoff', () => {
      const error = createConnectionError(
        ConnectionErrorType.NETWORK_ERROR,
        'Network failure',
        true
      );

      // First attempt: 1 second
      connectionManager.setState(ConnectionState.ERROR, error);
      vi.advanceTimersByTime(1000);
      expect(connectionManager.getState()).toBe(ConnectionState.CONNECTING);

      // Second attempt: 2 seconds
      connectionManager.setState(ConnectionState.ERROR, error);
      vi.advanceTimersByTime(2000);
      expect(connectionManager.getState()).toBe(ConnectionState.CONNECTING);

      // Third attempt: 4 seconds
      connectionManager.setState(ConnectionState.ERROR, error);
      vi.advanceTimersByTime(4000);
      expect(connectionManager.getState()).toBe(ConnectionState.CONNECTING);
    });

    it('should respect max reconnection attempts', () => {
      const error = createConnectionError(
        ConnectionErrorType.NETWORK_ERROR,
        'Network failure',
        true
      );

      // Attempt 5 reconnections
      for (let i = 0; i < 5; i++) {
        connectionManager.setState(ConnectionState.ERROR, error);
        vi.advanceTimersByTime(30000); // Max delay
      }

      // 6th attempt should fail
      connectionManager.setState(ConnectionState.ERROR, error);

      expect(connectionManager.getState()).toBe(ConnectionState.ERROR);
      expect(connectionManager.getLastError()?.retryable).toBe(false);
    });

    it('should reset reconnection on successful connection', () => {
      const error = createConnectionError(
        ConnectionErrorType.NETWORK_ERROR,
        'Network failure',
        true
      );

      // Fail once
      connectionManager.setState(ConnectionState.ERROR, error);
      vi.advanceTimersByTime(1000);

      // Succeed
      connectionManager.handleConnected();

      expect(connectionManager.getState()).toBe(ConnectionState.CONNECTED);

      // Next failure should start from attempt 1 again
      connectionManager.setState(ConnectionState.ERROR, error);
      vi.advanceTimersByTime(1000); // Should be 1 second, not 2
      expect(connectionManager.getState()).toBe(ConnectionState.CONNECTING);
    });

    it('should respect max delay', () => {
      const error = createConnectionError(
        ConnectionErrorType.NETWORK_ERROR,
        'Network failure',
        true
      );

      // Set strategy with low max delay
      connectionManager.setReconnectionStrategy({
        maxDelay: 5000,
      });

      // Attempt many reconnections
      for (let i = 0; i < 10; i++) {
        connectionManager.setState(ConnectionState.ERROR, error);
        vi.advanceTimersByTime(5000); // Should never exceed 5 seconds
      }

      expect(connectionManager.getState()).toBe(ConnectionState.CONNECTING);
    });
  });

  describe('Reconnection Strategy', () => {
    it('should get default strategy', () => {
      const strategy = connectionManager.getReconnectionStrategy();

      expect(strategy).toEqual({
        maxAttempts: 5,
        initialDelay: 1000,
        maxDelay: 30000,
        backoffMultiplier: 2,
      });
    });

    it('should set custom strategy', () => {
      connectionManager.setReconnectionStrategy({
        maxAttempts: 10,
        initialDelay: 500,
      });

      const strategy = connectionManager.getReconnectionStrategy();

      expect(strategy.maxAttempts).toBe(10);
      expect(strategy.initialDelay).toBe(500);
      expect(strategy.maxDelay).toBe(30000); // Unchanged
    });
  });

  describe('Health Checks', () => {
    it('should report healthy when connected', () => {
      connectionManager.setState(ConnectionState.CONNECTED);
      expect(connectionManager.isHealthy()).toBe(true);
    });

    it('should report unhealthy when not connected', () => {
      connectionManager.setState(ConnectionState.DISCONNECTED);
      expect(connectionManager.isHealthy()).toBe(false);

      connectionManager.setState(ConnectionState.ERROR);
      expect(connectionManager.isHealthy()).toBe(false);
    });

    it('should report reconnecting state', () => {
      connectionManager.setState(ConnectionState.RECONNECTING);
      expect(connectionManager.isReconnecting()).toBe(true);

      connectionManager.setState(ConnectionState.CONNECTED);
      expect(connectionManager.isReconnecting()).toBe(false);
    });
  });

  describe('Cleanup', () => {
    it('should cleanup timers and callbacks', () => {
      const callback = vi.fn();
      connectionManager.onStateChange(callback);

      const error = createConnectionError(
        ConnectionErrorType.NETWORK_ERROR,
        'Network failure',
        true
      );
      connectionManager.setState(ConnectionState.ERROR, error);

      connectionManager.cleanup();

      // Should not trigger callback after cleanup
      connectionManager.setState(ConnectionState.CONNECTED);
      expect(callback).toHaveBeenCalledTimes(1); // Only the error state change

      // Should be disconnected
      expect(connectionManager.getState()).toBe(ConnectionState.DISCONNECTED);
    });
  });

  describe('Helper Functions', () => {
    it('should create connection error', () => {
      const error = createConnectionError(
        ConnectionErrorType.NETWORK_ERROR,
        'Test error',
        true
      );

      expect(error.type).toBe(ConnectionErrorType.NETWORK_ERROR);
      expect(error.message).toBe('Test error');
      expect(error.retryable).toBe(true);
      expect(error.timestamp).toBeDefined();
    });
  });
});
