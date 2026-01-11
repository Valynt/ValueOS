/**
 * useAgentStream Hook
 *
 * Connects agent state machine to WebSocket for real-time streaming.
 * Handles channel subscription, message parsing, and state updates.
 */

import { useEffect, useCallback, useRef, useState } from "react";
import { WebSocketManager, ConnectionState } from "../sdui/realtime/WebSocketManager";
import { AgentStateMachine } from "../lib/agent/AgentStateMachine";
import type { AgentEvent, AgentState, ExecutionProgress } from "../lib/agent/types";
import { useTenant } from "../contexts/TenantContext";
import { createLogger } from "../lib/logger";
import { getConfig } from "../config/environment";

const logger = createLogger({ component: "useAgentStream" });

/**
 * Agent WebSocket message types
 */
export type AgentMessageType =
  | "agent:state_change"
  | "agent:clarify"
  | "agent:plan"
  | "agent:progress"
  | "agent:reasoning"
  | "agent:artifact"
  | "agent:complete"
  | "agent:error";

/**
 * Agent WebSocket message payload
 */
export interface AgentStreamMessage {
  type: AgentMessageType;
  sessionId: string;
  data: unknown;
  timestamp: string;
}

export interface UseAgentStreamOptions {
  sessionId: string;
  stateMachine: AgentStateMachine | null;
  autoConnect?: boolean;
  onReasoning?: (text: string) => void;
  onArtifact?: (artifact: unknown) => void;
}

export interface UseAgentStreamReturn {
  isConnected: boolean;
  connectionState: ConnectionState;
  connect: () => Promise<void>;
  disconnect: () => void;
  sendMessage: (type: string, data: unknown) => void;
  lastReasoning: string | null;
}

export function useAgentStream(options: UseAgentStreamOptions): UseAgentStreamReturn {
  const { sessionId, stateMachine, autoConnect = true, onReasoning, onArtifact } = options;

  const { currentTenant } = useTenant();
  const wsManagerRef = useRef<WebSocketManager | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  const [connectionState, setConnectionState] = useState<ConnectionState>("disconnected");
  const [lastReasoning, setLastReasoning] = useState<string | null>(null);

  const channelName = `agent:${sessionId}`;

  /**
   * Initialize WebSocket manager
   */
  const getWebSocketManager = useCallback((): WebSocketManager | null => {
    if (wsManagerRef.current) {
      return wsManagerRef.current;
    }

    try {
      const config = getConfig();
      const wsUrl = config.agents.websocketUrl || config.agents.apiUrl?.replace("http", "ws");

      if (!wsUrl) {
        logger.warn("WebSocket URL not configured");
        return null;
      }

      wsManagerRef.current = WebSocketManager.getInstance({
        url: wsUrl,
        reconnect: true,
        reconnectMaxAttempts: 5,
        debug: config.app.env === "development",
      });

      return wsManagerRef.current;
    } catch (error) {
      logger.error("Failed to initialize WebSocket manager", error as Error);
      return null;
    }
  }, []);

  /**
   * Handle incoming agent messages
   */
  const handleMessage = useCallback(
    (data: AgentStreamMessage) => {
      if (!stateMachine) {
        logger.warn("Received message but state machine not available");
        return;
      }

      logger.debug("Agent stream message received", { type: data.type, sessionId: data.sessionId });

      try {
        switch (data.type) {
          case "agent:state_change":
            // State changes are handled by dispatching events
            const stateData = data.data as { state: AgentState; event?: AgentEvent };
            if (stateData.event) {
              stateMachine.dispatch(stateData.event);
            }
            break;

          case "agent:clarify":
            stateMachine.dispatch({
              type: "CLARIFY_NEEDED",
              payload: data.data as any,
            });
            break;

          case "agent:plan":
            stateMachine.dispatch({
              type: "PLAN_READY",
              payload: { plan: data.data as any },
            });
            break;

          case "agent:progress":
            stateMachine.dispatch({
              type: "EXECUTE_PROGRESS",
              payload: data.data as ExecutionProgress,
            });
            break;

          case "agent:reasoning":
            const reasoning = (data.data as { text: string }).text;
            setLastReasoning(reasoning);
            onReasoning?.(reasoning);
            break;

          case "agent:artifact":
            onArtifact?.(data.data);
            break;

          case "agent:complete":
            stateMachine.dispatch({
              type: "EXECUTE_COMPLETE",
              payload: { results: data.data as any },
            });
            break;

          case "agent:error":
            stateMachine.dispatch({
              type: "EXECUTE_ERROR",
              payload: data.data as any,
            });
            break;

          default:
            logger.warn("Unknown agent message type", { type: data.type });
        }
      } catch (error) {
        logger.error("Error handling agent message", error as Error, { type: data.type });
      }
    },
    [stateMachine, onReasoning, onArtifact]
  );

  /**
   * Connect to WebSocket and subscribe to agent channel
   */
  const connect = useCallback(async () => {
    const wsManager = getWebSocketManager();
    if (!wsManager) {
      setConnectionState("error");
      return;
    }

    try {
      setConnectionState("connecting");

      // Set tenant context for authentication
      if (currentTenant) {
        wsManager.setTenantContext({
          tenantId: currentTenant.id,
          organizationId: currentTenant.id,
          userId: stateMachine?.session.userId || "",
          permissions: [],
          theme: { mode: "dark" },
          featureFlags: {},
          dataResidency: "us",
        });
      }

      await wsManager.connect();
      setConnectionState("connected");

      // Subscribe to agent channel
      unsubscribeRef.current = wsManager.subscribe(
        channelName,
        handleMessage,
        (msg) => msg.sessionId === sessionId
      );

      // Update state machine connection status
      stateMachine?.setConnected(true);

      logger.info("Connected to agent stream", { channel: channelName });
    } catch (error) {
      logger.error("Failed to connect to agent stream", error as Error);
      setConnectionState("error");
      stateMachine?.setConnected(false);
    }
  }, [getWebSocketManager, currentTenant, channelName, sessionId, handleMessage, stateMachine]);

  /**
   * Disconnect from WebSocket
   */
  const disconnect = useCallback(() => {
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }

    stateMachine?.setConnected(false);
    setConnectionState("disconnected");

    logger.info("Disconnected from agent stream", { channel: channelName });
  }, [channelName, stateMachine]);

  /**
   * Send message to agent
   */
  const sendMessage = useCallback(
    (type: string, data: unknown) => {
      const wsManager = wsManagerRef.current;
      if (!wsManager || !wsManager.isConnected()) {
        logger.warn("Cannot send message - not connected");
        return;
      }

      wsManager.send({
        type,
        channel: channelName,
        data: {
          sessionId,
          ...(data as object),
        },
        timestamp: new Date().toISOString(),
      });
    },
    [channelName, sessionId]
  );

  // Auto-connect on mount
  useEffect(() => {
    if (autoConnect && sessionId && stateMachine) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [autoConnect, sessionId, stateMachine, connect, disconnect]);

  // Listen for connection state changes
  useEffect(() => {
    const wsManager = wsManagerRef.current;
    if (!wsManager) return;

    const removeOpenListener = wsManager.addEventListener("open", () => {
      setConnectionState("connected");
    });

    const removeCloseListener = wsManager.addEventListener("close", () => {
      setConnectionState("disconnected");
    });

    const removeErrorListener = wsManager.addEventListener("error", () => {
      setConnectionState("error");
    });

    const removeReconnectListener = wsManager.addEventListener("reconnect", () => {
      setConnectionState("reconnecting");
    });

    return () => {
      removeOpenListener();
      removeCloseListener();
      removeErrorListener();
      removeReconnectListener();
    };
  }, []);

  return {
    isConnected: connectionState === "connected",
    connectionState,
    connect,
    disconnect,
    sendMessage,
    lastReasoning,
  };
}

export default useAgentStream;
