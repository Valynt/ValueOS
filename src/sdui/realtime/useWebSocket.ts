/**
 * useWebSocket Hook
 * 
 * React hook for WebSocket connections with automatic reconnection,
 * channel subscriptions, and state management.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { WebSocketManager, ConnectionState, WebSocketMessage } from './WebSocketManager';

/**
 * WebSocket hook options
 */
export interface UseWebSocketOptions {
  url: string;
  protocols?: string[];
  reconnect?: boolean;
  reconnectInterval?: number;
  reconnectMaxAttempts?: number;
  heartbeatInterval?: number;
  onOpen?: () => void;
  onClose?: () => void;
  onError?: (error: Error) => void;
  onMessage?: (data: any) => void;
  debug?: boolean;
}

/**
 * WebSocket hook return value
 */
export interface UseWebSocketReturn {
  state: ConnectionState;
  isConnected: boolean;
  send: (message: WebSocketMessage) => void;
  subscribe: (
    channel: string,
    callback: (data: any) => void,
    filter?: (data: any) => boolean
  ) => () => void;
  connect: () => Promise<void>;
  disconnect: () => void;
  stats: {
    state: ConnectionState;
    reconnectAttempts: number;
    subscriptions: number;
    queuedMessages: number;
  };
}

/**
 * useWebSocket Hook
 */
export function useWebSocket(options: UseWebSocketOptions): UseWebSocketReturn {
  const [state, setState] = useState<ConnectionState>('disconnected');
  const [stats, setStats] = useState({
    state: 'disconnected' as ConnectionState,
    reconnectAttempts: 0,
    subscriptions: 0,
    queuedMessages: 0,
  });

  const wsManagerRef = useRef<WebSocketManager | null>(null);
  const subscriptionsRef = useRef<Set<() => void>>(new Set());

  // Initialize WebSocket manager
  useEffect(() => {
    wsManagerRef.current = WebSocketManager.getInstance({
      url: options.url,
      protocols: options.protocols,
      reconnect: options.reconnect,
      reconnectInterval: options.reconnectInterval,
      reconnectMaxAttempts: options.reconnectMaxAttempts,
      heartbeatInterval: options.heartbeatInterval,
      debug: options.debug,
    });

    // Add event listeners
    const removeOpenListener = wsManagerRef.current.addEventListener('open', () => {
      setState('connected');
      options.onOpen?.();
    });

    const removeCloseListener = wsManagerRef.current.addEventListener('close', () => {
      setState('disconnected');
      options.onClose?.();
    });

    const removeErrorListener = wsManagerRef.current.addEventListener('error', (event) => {
      setState('error');
      options.onError?.(event.error || new Error('WebSocket error'));
    });

    const removeReconnectListener = wsManagerRef.current.addEventListener('reconnect', () => {
      setState('reconnecting');
    });

    // Update stats periodically
    const statsInterval = setInterval(() => {
      if (wsManagerRef.current) {
        setStats(wsManagerRef.current.getStats());
      }
    }, 1000);

    // Cleanup
    return () => {
      removeOpenListener();
      removeCloseListener();
      removeErrorListener();
      removeReconnectListener();
      clearInterval(statsInterval);

      // Unsubscribe all
      subscriptionsRef.current.forEach((unsubscribe) => unsubscribe());
      subscriptionsRef.current.clear();

      // Disconnect
      if (wsManagerRef.current) {
        wsManagerRef.current.disconnect();
      }
    };
  }, [options.url]);

  // Connect
  const connect = useCallback(async () => {
    if (wsManagerRef.current) {
      await wsManagerRef.current.connect();
    }
  }, []);

  // Disconnect
  const disconnect = useCallback(() => {
    if (wsManagerRef.current) {
      wsManagerRef.current.disconnect();
    }
  }, []);

  // Send message
  const send = useCallback((message: WebSocketMessage) => {
    if (wsManagerRef.current) {
      wsManagerRef.current.send(message);
    }
  }, []);

  // Subscribe to channel
  const subscribe = useCallback(
    (
      channel: string,
      callback: (data: any) => void,
      filter?: (data: any) => boolean
    ): (() => void) => {
      if (!wsManagerRef.current) {
        return () => {};
      }

      const unsubscribe = wsManagerRef.current.subscribe(channel, callback, filter);
      subscriptionsRef.current.add(unsubscribe);

      return () => {
        unsubscribe();
        subscriptionsRef.current.delete(unsubscribe);
      };
    },
    []
  );

  // Check if connected
  const isConnected = state === 'connected';

  return {
    state,
    isConnected,
    send,
    subscribe,
    connect,
    disconnect,
    stats,
  };
}

/**
 * useWebSocketChannel Hook
 * 
 * Simplified hook for subscribing to a single channel
 */
export function useWebSocketChannel<T = any>(
  channel: string,
  options: UseWebSocketOptions
): {
  data: T | null;
  loading: boolean;
  error: Error | null;
  isConnected: boolean;
} {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const ws = useWebSocket({
    ...options,
    onError: (err) => {
      setError(err);
      setLoading(false);
      options.onError?.(err);
    },
  });

  useEffect(() => {
    if (!ws.isConnected) {
      ws.connect().catch((err) => {
        setError(err);
        setLoading(false);
      });
    }
  }, [ws.isConnected]);

  useEffect(() => {
    if (!ws.isConnected) return;

    const unsubscribe = ws.subscribe(channel, (newData: T) => {
      setData(newData);
      setLoading(false);
      setError(null);
    });

    return unsubscribe;
  }, [channel, ws.isConnected]);

  return {
    data,
    loading,
    error,
    isConnected: ws.isConnected,
  };
}

export default useWebSocket;
