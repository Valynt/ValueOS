/**
 * useRealtimeUpdates Hook
 * 
 * React hook for subscribing to real-time SDUI updates.
 * Handles connection management, update handling, and reconnection.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { SDUIUpdate } from '../types/sdui-integration';
import { realtimeUpdateService } from '../services/RealtimeUpdateService';
import { logger } from '../lib/logger';

/**
 * Hook options
 */
export interface UseRealtimeUpdatesOptions {
  workspaceId: string;
  userId: string;
  autoConnect?: boolean;
  onUpdate?: (update: SDUIUpdate) => void;
  onError?: (error: Error) => void;
}

/**
 * Hook return value
 */
export interface UseRealtimeUpdatesReturn {
  updates: SDUIUpdate[];
  connected: boolean;
  connecting: boolean;
  error: Error | null;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  reconnect: () => Promise<void>;
  clearUpdates: () => void;
}

/**
 * useRealtimeUpdates Hook
 */
export function useRealtimeUpdates(
  options: UseRealtimeUpdatesOptions
): UseRealtimeUpdatesReturn {
  const { workspaceId, userId, autoConnect = true, onUpdate, onError } = options;

  const [updates, setUpdates] = useState<SDUIUpdate[]>([]);
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const unsubscribeRef = useRef<(() => void) | null>(null);
  const mountedRef = useRef(true);

  /**
   * Connect to realtime updates
   */
  const connect = useCallback(async () => {
    if (connecting || connected) {
      logger.debug('Already connected or connecting');
      return;
    }

    setConnecting(true);
    setError(null);

    try {
      await realtimeUpdateService.connect(workspaceId, userId);

      if (!mountedRef.current) return;

      // Subscribe to updates
      unsubscribeRef.current = realtimeUpdateService.onUpdate((update) => {
        if (!mountedRef.current) return;

        logger.debug('Received realtime update', {
          workspaceId,
          updateType: update.type,
        });

        setUpdates((prev) => [...prev, update]);

        if (onUpdate) {
          onUpdate(update);
        }
      });

      setConnected(true);
      setConnecting(false);

      logger.info('Connected to realtime updates', { workspaceId });
    } catch (err) {
      if (!mountedRef.current) return;

      const error = err instanceof Error ? err : new Error('Connection failed');
      setError(error);
      setConnecting(false);
      setConnected(false);

      logger.error('Failed to connect to realtime updates', {
        workspaceId,
        error: error.message,
      });

      if (onError) {
        onError(error);
      }
    }
  }, [workspaceId, userId, connecting, connected, onUpdate, onError]);

  /**
   * Disconnect from realtime updates
   */
  const disconnect = useCallback(async () => {
    logger.info('Disconnecting from realtime updates', { workspaceId });

    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }

    await realtimeUpdateService.disconnect();

    if (mountedRef.current) {
      setConnected(false);
      setConnecting(false);
    }
  }, [workspaceId]);

  /**
   * Reconnect to realtime updates
   */
  const reconnect = useCallback(async () => {
    logger.info('Reconnecting to realtime updates', { workspaceId });

    await disconnect();
    await connect();
  }, [workspaceId, disconnect, connect]);

  /**
   * Clear updates
   */
  const clearUpdates = useCallback(() => {
    setUpdates([]);
  }, []);

  /**
   * Auto-connect on mount
   */
  useEffect(() => {
    if (autoConnect) {
      connect();
    }

    return () => {
      mountedRef.current = false;
      disconnect();
    };
  }, [autoConnect, connect, disconnect]);

  /**
   * Handle connection state changes
   */
  useEffect(() => {
    const handleStateChange = (event: any) => {
      if (!mountedRef.current) return;

      logger.debug('Connection state changed', event);

      if (event.to === 'connected') {
        setConnected(true);
        setConnecting(false);
        setError(null);
      } else if (event.to === 'disconnected') {
        setConnected(false);
        setConnecting(false);
      } else if (event.to === 'connecting' || event.to === 'reconnecting') {
        setConnecting(true);
      } else if (event.to === 'error') {
        setConnected(false);
        setConnecting(false);
        setError(new Error('Connection error'));
      }
    };

    realtimeUpdateService.on('connection_state_change', handleStateChange);

    return () => {
      realtimeUpdateService.off('connection_state_change', handleStateChange);
    };
  }, []);

  /**
   * Handle connection failures
   */
  useEffect(() => {
    const handleConnectionFailed = () => {
      if (!mountedRef.current) return;

      logger.error('Connection failed after max attempts', { workspaceId });

      setConnected(false);
      setConnecting(false);
      setError(new Error('Connection failed after max attempts'));

      if (onError) {
        onError(new Error('Connection failed after max attempts'));
      }
    };

    realtimeUpdateService.on('connection_failed', handleConnectionFailed);

    return () => {
      realtimeUpdateService.off('connection_failed', handleConnectionFailed);
    };
  }, [workspaceId, onError]);

  return {
    updates,
    connected,
    connecting,
    error,
    connect,
    disconnect,
    reconnect,
    clearUpdates,
  };
}

/**
 * useRealtimeUpdate Hook (single update)
 * 
 * Simplified hook that returns only the latest update.
 */
export function useRealtimeUpdate(
  options: UseRealtimeUpdatesOptions
): SDUIUpdate | null {
  const { updates } = useRealtimeUpdates(options);
  return updates.length > 0 ? updates[updates.length - 1] : null;
}
