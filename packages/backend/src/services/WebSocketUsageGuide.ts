/**
 * WebSocket Connection Management - Usage Guide
 *
 * This document explains how to use the robust WebSocket connection management
 * system in the ValueCanvas application.
 */

import { logger } from '../lib/logger.js'

import { robustConnectionManager } from './RobustConnectionManager.js'
import { webSocketManager } from './WebSocketManager.js'

// Local helper types for the usage guide
type WSMessage = { type?: string; payload?: any; strategy?: string; [key: string]: any };
type StateChange = { from: string; to: string };
type ConnectionHealth = { isHealthy: boolean; strategy?: string; details?: any; [key: string]: any };

/**
 * Basic WebSocket Manager Usage
 *
 * For simple WebSocket connections with automatic reconnection.
 */
export function setupBasicWebSocket() {
  // Connect to WebSocket
  webSocketManager.connect({
    url: import.meta.env?.VITE_WEBSOCKET_URL || 'ws://localhost:8080/ws',
    workspaceId: 'workspace-123',
    userId: 'user-456',
    reconnect: true,
    maxReconnectAttempts: 10,
    heartbeatInterval: 30000,
    exponentialBackoff: true,
    fallbackUrls: ['ws://localhost:3000/ws', 'ws://localhost:4000/ws'],
  });

  // Listen for messages
  webSocketManager.on('message', (message: WSMessage) => {
    logger.info('Received:', message);
  });

  // Listen for state changes
  webSocketManager.on('state_change', ({ from, to }: StateChange) => {
    logger.info(`Connection state: ${from} -> ${to}`);
  });

  // Send messages
  webSocketManager.send({
    type: 'user_action',
    payload: { action: 'click', element: 'button' },
    timestamp: Date.now(),
    messageId: 'msg-123',
  });

  // Check connection status
  if (webSocketManager.isConnected()) {
    logger.info('Connected');
  }
}

/**
 * Robust Connection Manager Usage
 *
 * For production applications requiring high reliability and multiple fallback strategies.
 */
export function setupRobustConnection() {
  // Connect with multiple strategies
  robustConnectionManager.connect();

  // Listen for messages
  robustConnectionManager.on('message', (message: WSMessage) => {
    logger.info('Received via', message.strategy, ':', message);
  });

  // Monitor connection health
  robustConnectionManager.on('health_check', (health: ConnectionHealth) => {
    if (!health.isHealthy) {
      console.warn('Connection unhealthy:', health);
    }
  });

  // Handle strategy changes
  robustConnectionManager.on('state_change', ({ from, to }: StateChange) => {
    logger.info(`Connection: ${from} -> ${to}`);
  });

  // Send messages (will use best available strategy)
  robustConnectionManager.send({
    type: 'user_action',
    payload: { action: 'navigate', page: 'dashboard' },
  });

  // Get detailed health metrics
  const health = robustConnectionManager.getHealth();
  logger.info('Connection health:', health);

  // Force reconnection with specific strategy
  // robustConnectionManager.forceReconnect('polling');
}

/**
 * React Hook for Connection Management
 *
 * Custom hook to integrate connection management with React components.
 */
import { useEffect, useState } from 'react';

export function useWebSocketConnection() {
  const [isConnected, setIsConnected] = useState(false);
  const [connectionState, setConnectionState] = useState('disconnected');
  const [health, setHealth] = useState<ConnectionHealth | null>(null);

  useEffect(() => {
    // Connect on mount
    robustConnectionManager.connect();

    // Listen for state changes
      const handleStateChange = ({ from: _from, to }: StateChange) => {
        setConnectionState(to);
        setIsConnected(to === 'connected');
      };

      const handleHealthCheck = (healthData: ConnectionHealth) => {
        setHealth(healthData);
      };

    robustConnectionManager.on('state_change', handleStateChange);
    robustConnectionManager.on('health_check', handleHealthCheck);

    // Cleanup on unmount
    return () => {
      robustConnectionManager.off('state_change', handleStateChange);
      robustConnectionManager.off('health_check', handleHealthCheck);
    };
  }, []);

    return {
    isConnected,
    connectionState,
    health,
    sendMessage: (message: WSMessage) => robustConnectionManager.send(message as any),
    forceReconnect: (strategy: string) => robustConnectionManager.forceReconnect(strategy as any),
  };
}

/**
 * Environment-Specific Configuration
 *
 * Different configurations for development, staging, and production.
 */
export const connectionConfigs = {
  development: {
    websocketUrl: 'ws://localhost:24678',
    reconnect: true,
    maxReconnectAttempts: 5,
    heartbeatInterval: 30000,
  },

  staging: {
    websocketUrl: 'wss://staging-api.valuecanvas.com',
    reconnect: true,
    maxReconnectAttempts: 10,
    heartbeatInterval: 20000,
    fallbackStrategies: ['polling', 'sse'],
  },

  production: {
    websocketUrl: 'wss://api.valuecanvas.com',
    reconnect: true,
    maxReconnectAttempts: 15,
    heartbeatInterval: 15000,
    fallbackStrategies: ['polling', 'sse'],
    connectionTimeout: 15000,
  },
};

/**
 * Error Handling and Monitoring
 *
 * Comprehensive error handling with logging and monitoring.
 */
export function setupConnectionMonitoring() {
  // Log all connection events
  robustConnectionManager.on('state_change', ({ from, to }: StateChange) => {
    logger.info('Connection state changed', { from, to, strategy: robustConnectionManager.getHealth().strategy });
  });

  robustConnectionManager.on('health_check', (health: ConnectionHealth) => {
    if (!health.isHealthy) {
      logger.warn('Connection health degraded', health);

      // Send to monitoring service
      // monitoring.track('connection.unhealthy', health);
    }
  });

  robustConnectionManager.on('connection_failed', () => {
    logger.error('All connection strategies failed');

    // Alert user or take corrective action
    // notification.show('Connection lost. Retrying...');
  });

  robustConnectionManager.on('max_reconnect_attempts', () => {
    logger.error('Max reconnection attempts reached');

    // Show user-friendly error
    // notification.show('Unable to connect. Please check your internet connection.');
  });
}

/**
 * Vite Configuration for WebSocket Support
 *
 * Ensure Vite is configured properly for WebSocket connections.
 */
export const viteWebSocketConfig = {
  server: {
    hmr: {
      port: 24678,
      host: 'localhost',
      protocol: 'ws',
      timeout: 30000,
      overlay: true,
    },
  },
};

/**
 * Troubleshooting Guide
 *
 * Common issues and solutions for WebSocket connections.
 */

/*
1. "WebSocket closed without opened" error:
   - Check if Vite dev server is running on the correct port
   - Verify HMR configuration in vite.config.ts
   - Check firewall/network restrictions

2. Connection timeouts:
   - Increase connectionTimeout in options
   - Check network latency
   - Verify server is responding

3. Frequent disconnections:
   - Enable exponential backoff
   - Check heartbeat interval settings
   - Monitor server stability

4. Fallback strategies not working:
   - Ensure polling/SSE endpoints are implemented on server
   - Check CORS configuration for HTTP requests
   - Verify endpoint URLs are correct

5. High latency or packet loss:
   - Monitor connection health metrics
   - Consider switching to polling for unreliable networks
   - Check server performance
*/

/**
 * Server-Side Implementation Notes
 *
 * For the server to support all connection strategies:
 */

/*
// WebSocket server (primary)
import { WebSocketServer } from 'ws';
const wss = new WebSocketServer({ port: 24678 });

// Polling endpoint (fallback)
app.get('/api/poll', (req, res) => {
  // Return queued messages
});

// SSE endpoint (fallback)
app.get('/api/events', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });
});
*/