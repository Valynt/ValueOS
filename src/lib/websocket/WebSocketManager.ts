/**
 * WebSocket Integration for Real-time Updates
 *
 * Provides real-time collaboration and live updates for canvas operations.
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { logger } from '../lib/logger';

export interface WebSocketMessage {
  type: string;
  payload: any;
  timestamp: number;
  userId?: string;
  sessionId?: string;
}

export interface WebSocketOptions {
  url: string;
  protocols?: string[];
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  heartbeatInterval?: number;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onMessage?: (message: WebSocketMessage) => void;
  onError?: (error: Error) => void;
}

export interface WebSocketState {
  connected: boolean;
  connecting: boolean;
  error: Error | null;
  reconnectAttempts: number;
  lastMessage?: WebSocketMessage;
}

/**
 * WebSocket Manager for real-time communication
 */
export class WebSocketManager {
  private ws: WebSocket | null = null;
  private options: Required<WebSocketOptions>;
  private state: WebSocketState;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private messageQueue: WebSocketMessage[] = [];
  private eventListeners = new Map<string, Set<(message: WebSocketMessage) => void>>();

  constructor(options: WebSocketOptions) {
    this.options = {
      protocols: options.protocols || [],
      reconnectInterval: options.reconnectInterval || 3000,
      maxReconnectAttempts: options.maxReconnectAttempts || 5,
      heartbeatInterval: options.heartbeatInterval || 30000,
      onConnect: options.onConnect || (() => {}),
      onDisconnect: options.onDisconnect || (() => {}),
      onMessage: options.onMessage || (() => {}),
      onError: options.onError || (() => {}),
      ...options,
    };

    this.state = {
      connected: false,
      connecting: false,
      error: null,
      reconnectAttempts: 0,
    };
  }

  /**
   * Connect to WebSocket server
   */
  connect(): void {
    if (this.state.connected || this.state.connecting) {
      return;
    }

    this.state.connecting = true;
    this.state.error = null;

    try {
      this.ws = new WebSocket(this.options.url, this.options.protocols);
      this.setupEventHandlers();
    } catch (error) {
      this.handleError(error as Error);
    }
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect(): void {
    this.clearTimers();

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.state.connected = false;
    this.state.connecting = false;
    this.state.reconnectAttempts = 0;
  }

  /**
   * Send message to WebSocket server
   */
  send(message: WebSocketMessage): void {
    if (!this.state.connected || !this.ws) {
      // Queue message for later delivery
      this.messageQueue.push(message);
      return;
    }

    try {
      this.ws.send(JSON.stringify(message));
    } catch (error) {
      logger.error('Failed to send WebSocket message:', error);
      this.handleError(error as Error);
    }
  }

  /**
   * Subscribe to message types
   */
  subscribe(type: string, callback: (message: WebSocketMessage) => void): () => void {
    if (!this.eventListeners.has(type)) {
      this.eventListeners.set(type, new Set());
    }

    this.eventListeners.get(type)!.add(callback);

    // Return unsubscribe function
    return () => {
      const listeners = this.eventListeners.get(type);
      if (listeners) {
        listeners.delete(callback);
        if (listeners.size === 0) {
          this.eventListeners.delete(type);
        }
      }
    };
  }

  /**
   * Get current connection state
   */
  getState(): WebSocketState {
    return { ...this.state };
  }

  private setupEventHandlers(): void {
    if (!this.ws) return;

    this.ws.onopen = () => {
      this.handleOpen();
    };

    this.ws.onclose = (event) => {
      this.handleClose(event);
    };

    this.ws.onerror = (event) => {
      this.handleError(new Error('WebSocket error'));
    };

    this.ws.onmessage = (event) => {
      this.handleMessage(event);
    };
  }

  private handleOpen(): void {
    this.state.connected = true;
    this.state.connecting = false;
    this.state.error = null;
    this.state.reconnectAttempts = 0;

    // Send queued messages
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift()!;
      this.send(message);
    }

    // Start heartbeat
    this.startHeartbeat();

    this.options.onConnect();
    logger.info('WebSocket connected');
  }

  private handleClose(event: CloseEvent): void {
    this.state.connected = false;
    this.state.connecting = false;
    this.clearTimers();

    this.options.onDisconnect();

    // Attempt reconnection if not a clean close
    if (event.code !== 1000 && this.state.reconnectAttempts < this.options.maxReconnectAttempts) {
      this.scheduleReconnect();
    }

    logger.info('WebSocket disconnected', { code: event.code, reason: event.reason });
  }

  private handleError(error: Error): void {
    this.state.error = error;
    this.state.connecting = false;

    this.options.onError(error);
    logger.error('WebSocket error:', error);
  }

  private handleMessage(event: MessageEvent): void {
    try {
      const message: WebSocketMessage = JSON.parse(event.data);
      this.state.lastMessage = message;

      // Notify global message handler
      this.options.onMessage(message);

      // Notify type-specific listeners
      const listeners = this.eventListeners.get(message.type);
      if (listeners) {
        listeners.forEach(callback => callback(message));
      }
    } catch (error) {
      logger.error('Failed to parse WebSocket message:', error);
    }
  }

  private scheduleReconnect(): void {
    this.state.reconnectAttempts++;

    this.reconnectTimer = setTimeout(() => {
      logger.info(`Attempting WebSocket reconnection (${this.state.reconnectAttempts}/${this.options.maxReconnectAttempts})`);
      this.connect();
    }, this.options.reconnectInterval);
  }

  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      if (this.state.connected && this.ws) {
        this.send({
          type: 'heartbeat',
          payload: { timestamp: Date.now() },
          timestamp: Date.now(),
        });
      }
    }, this.options.heartbeatInterval);
  }

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
}

/**
 * React hook for WebSocket integration
 */
export function useWebSocket(options: WebSocketOptions) {
  const wsRef = useRef<WebSocketManager | null>(null);
  const [state, setState] = useState<WebSocketState>({
    connected: false,
    connecting: false,
    error: null,
    reconnectAttempts: 0,
  });

  // Initialize WebSocket manager
  useEffect(() => {
    wsRef.current = new WebSocketManager({
      ...options,
      onConnect: () => {
        setState(prev => ({ ...prev, connected: true, connecting: false, error: null }));
        options.onConnect?.();
      },
      onDisconnect: () => {
        setState(prev => ({ ...prev, connected: false, connecting: false }));
        options.onDisconnect?.();
      },
      onError: (error) => {
        setState(prev => ({ ...prev, error }));
        options.onError?.(error);
      },
      onMessage: (message) => {
        setState(prev => ({ ...prev, lastMessage: message }));
        options.onMessage?.(message);
      },
    });

    return () => {
      wsRef.current?.disconnect();
    };
  }, [options.url]);

  const connect = useCallback(() => {
    wsRef.current?.connect();
  }, []);

  const disconnect = useCallback(() => {
    wsRef.current?.disconnect();
  }, []);

  const send = useCallback((message: WebSocketMessage) => {
    wsRef.current?.send(message);
  }, []);

  const subscribe = useCallback((type: string, callback: (message: WebSocketMessage) => void) => {
    return wsRef.current?.subscribe(type, callback) || (() => {});
  }, []);

  return {
    ...state,
    connect,
    disconnect,
    send,
    subscribe,
  };
}

/**
 * Real-time collaboration message types
 */
export const COLLABORATION_MESSAGE_TYPES = {
  // Canvas operations
  CANVAS_UPDATE: 'canvas_update',
  CANVAS_CURSOR_MOVE: 'canvas_cursor_move',
  CANVAS_SELECTION_CHANGE: 'canvas_selection_change',

  // Workflow operations
  WORKFLOW_STATE_CHANGE: 'workflow_state_change',
  COMMAND_EXECUTED: 'command_executed',
  COMMAND_UNDONE: 'command_undone',

  // User presence
  USER_JOINED: 'user_joined',
  USER_LEFT: 'user_left',
  USER_PRESENCE: 'user_presence',

  // System events
  SESSION_CREATED: 'session_created',
  SESSION_DELETED: 'session_deleted',
  ERROR_OCCURRED: 'error_occurred',
} as const;

/**
 * Real-time canvas collaboration hook
 */
export function useRealtimeCanvas(sessionId: string, userId: string) {
  const wsUrl = `${process.env.VITE_WS_URL || 'ws://localhost:8080'}/canvas/${sessionId}`;

  const {
    connected,
    send,
    subscribe,
    error,
  } = useWebSocket({
    url: wsUrl,
    onConnect: () => {
      // Announce user presence
      send({
        type: COLLABORATION_MESSAGE_TYPES.USER_JOINED,
        payload: { userId, timestamp: Date.now() },
        timestamp: Date.now(),
        userId,
        sessionId,
      });
    },
  });

  // Send canvas updates
  const sendCanvasUpdate = useCallback((update: any) => {
    send({
      type: COLLABORATION_MESSAGE_TYPES.CANVAS_UPDATE,
      payload: update,
      timestamp: Date.now(),
      userId,
      sessionId,
    });
  }, [send, userId, sessionId]);

  // Send cursor position
  const sendCursorPosition = useCallback((x: number, y: number) => {
    send({
      type: COLLABORATION_MESSAGE_TYPES.CANVAS_CURSOR_MOVE,
      payload: { x, y },
      timestamp: Date.now(),
      userId,
      sessionId,
    });
  }, [send, userId, sessionId]);

  // Subscribe to canvas updates from other users
  const onCanvasUpdate = useCallback((callback: (update: any, userId: string) => void) => {
    return subscribe(COLLABORATION_MESSAGE_TYPES.CANVAS_UPDATE, (message) => {
      if (message.userId !== userId) {
        callback(message.payload, message.userId!);
      }
    });
  }, [subscribe, userId]);

  // Subscribe to cursor movements
  const onCursorMove = useCallback((callback: (x: number, y: number, userId: string) => void) => {
    return subscribe(COLLABORATION_MESSAGE_TYPES.CANVAS_CURSOR_MOVE, (message) => {
      if (message.userId !== userId) {
        const { x, y } = message.payload;
        callback(x, y, message.userId!);
      }
    });
  }, [subscribe, userId]);

  // Subscribe to user presence
  const onUserPresence = useCallback((callback: (users: string[]) => void) => {
    const users = new Set<string>();

    // Initial subscription
    const unsubscribeJoined = subscribe(COLLABORATION_MESSAGE_TYPES.USER_JOINED, (message) => {
      users.add(message.userId!);
      callback(Array.from(users));
    });

    const unsubscribeLeft = subscribe(COLLABORATION_MESSAGE_TYPES.USER_LEFT, (message) => {
      users.delete(message.userId!);
      callback(Array.from(users));
    });

    return () => {
      unsubscribeJoined();
      unsubscribeLeft();
    };
  }, [subscribe]);

  return {
    connected,
    error,
    sendCanvasUpdate,
    sendCursorPosition,
    onCanvasUpdate,
    onCursorMove,
    onUserPresence,
  };
}
