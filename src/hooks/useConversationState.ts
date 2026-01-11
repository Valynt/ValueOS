/**
 * useConversationState Hook
 *
 * Manages persistent conversation state with WebSocket reconnection
 * and history caching. Maintains scroll position across navigation.
 * Part of P0 release-critical items.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { webSocketManager, WebSocketMessage } from "../services/WebSocketManager";

export interface ConversationMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
  metadata?: {
    agentId?: string;
    toolCalls?: string[];
    sources?: string[];
    state?: string;
  };
}

export interface ConversationState {
  id: string;
  messages: ConversationMessage[];
  scrollPosition: number;
  lastUpdated: Date;
  isActive: boolean;
}

interface UseConversationStateOptions {
  sessionId: string;
  userId: string;
  workspaceId: string;
  maxMessages?: number;
  persistToStorage?: boolean;
}

const STORAGE_KEY_PREFIX = "vros_conversation_";
const MAX_CACHED_CONVERSATIONS = 10;

/**
 * Get conversation from localStorage
 */
function getStoredConversation(sessionId: string): ConversationState | null {
  try {
    const key = `${STORAGE_KEY_PREFIX}${sessionId}`;
    const stored = localStorage.getItem(key);
    if (!stored) return null;

    const parsed = JSON.parse(stored);
    return {
      ...parsed,
      messages: parsed.messages.map((m: any) => ({
        ...m,
        timestamp: new Date(m.timestamp),
      })),
      lastUpdated: new Date(parsed.lastUpdated),
    };
  } catch {
    return null;
  }
}

/**
 * Store conversation to localStorage
 */
function storeConversation(state: ConversationState): void {
  try {
    const key = `${STORAGE_KEY_PREFIX}${state.id}`;
    localStorage.setItem(key, JSON.stringify(state));

    // Cleanup old conversations
    cleanupOldConversations();
  } catch {
    console.warn("[useConversationState] Failed to persist conversation");
  }
}

/**
 * Remove oldest conversations if over limit
 */
function cleanupOldConversations(): void {
  try {
    const keys: { key: string; timestamp: number }[] = [];

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(STORAGE_KEY_PREFIX)) {
        const stored = localStorage.getItem(key);
        if (stored) {
          const parsed = JSON.parse(stored);
          keys.push({ key, timestamp: new Date(parsed.lastUpdated).getTime() });
        }
      }
    }

    // Sort by timestamp (oldest first) and remove excess
    keys.sort((a, b) => a.timestamp - b.timestamp);
    while (keys.length > MAX_CACHED_CONVERSATIONS) {
      const oldest = keys.shift();
      if (oldest) localStorage.removeItem(oldest.key);
    }
  } catch {
    // Ignore cleanup errors
  }
}

export function useConversationState({
  sessionId,
  userId,
  workspaceId,
  maxMessages = 100,
  persistToStorage = true,
}: UseConversationStateOptions) {
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const scrollPositionRef = useRef(0);
  const containerRef = useRef<HTMLElement | null>(null);

  // Initialize from storage
  useEffect(() => {
    if (persistToStorage) {
      const stored = getStoredConversation(sessionId);
      if (stored) {
        setMessages(stored.messages);
        scrollPositionRef.current = stored.scrollPosition;
      }
    }
  }, [sessionId, persistToStorage]);

  // Connect to WebSocket
  useEffect(() => {
    const wsUrl = import.meta.env.VITE_WS_URL || "wss://api.valueos.app/ws";

    webSocketManager.connect({
      url: wsUrl,
      workspaceId,
      userId,
      reconnect: true,
      maxReconnectAttempts: 10,
      exponentialBackoff: true,
    });

    // Handle connection state changes
    const handleStateChange = ({ to }: { from: string; to: string }) => {
      setIsConnected(to === "connected");
      setIsReconnecting(to === "reconnecting");
      if (to === "error") {
        setError(new Error("WebSocket connection failed"));
      }
    };

    // Handle incoming messages
    const handleMessage = (message: WebSocketMessage) => {
      if (message.type === "conversation_message") {
        const newMessage: ConversationMessage = {
          id: message.messageId,
          role: message.payload.role,
          content: message.payload.content,
          timestamp: new Date(message.timestamp),
          metadata: message.payload.metadata,
        };

        setMessages((prev) => {
          const updated = [...prev, newMessage];
          // Trim to max messages
          if (updated.length > maxMessages) {
            return updated.slice(-maxMessages);
          }
          return updated;
        });
      }

      // Handle history sync on reconnect
      if (message.type === "conversation_history") {
        const history: ConversationMessage[] = message.payload.messages.map((m: any) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          timestamp: new Date(m.timestamp),
          metadata: m.metadata,
        }));
        setMessages(history);
      }
    };

    // Handle max reconnect attempts
    const handleMaxReconnect = () => {
      setError(new Error("Maximum reconnection attempts reached"));
      setIsReconnecting(false);
    };

    webSocketManager.on("state_change", handleStateChange);
    webSocketManager.on("message", handleMessage);
    webSocketManager.on("max_reconnect_attempts", handleMaxReconnect);

    return () => {
      webSocketManager.off("state_change", handleStateChange);
      webSocketManager.off("message", handleMessage);
      webSocketManager.off("max_reconnect_attempts", handleMaxReconnect);
    };
  }, [workspaceId, userId, maxMessages]);

  // Persist to storage on message changes
  useEffect(() => {
    if (persistToStorage && messages.length > 0) {
      const state: ConversationState = {
        id: sessionId,
        messages,
        scrollPosition: scrollPositionRef.current,
        lastUpdated: new Date(),
        isActive: true,
      };
      storeConversation(state);
    }
  }, [messages, sessionId, persistToStorage]);

  // Send message
  const sendMessage = useCallback(
    async (content: string, metadata?: Record<string, unknown>) => {
      const message: ConversationMessage = {
        id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        role: "user",
        content,
        timestamp: new Date(),
        metadata: metadata as ConversationMessage["metadata"],
      };

      // Optimistically add to local state
      setMessages((prev) => [...prev, message]);

      // Send via WebSocket
      await webSocketManager.send({
        type: "conversation_message",
        payload: {
          sessionId,
          role: "user",
          content,
          metadata,
        },
        timestamp: Date.now(),
        messageId: message.id,
      });

      return message;
    },
    [sessionId]
  );

  // Save scroll position
  const saveScrollPosition = useCallback((position: number) => {
    scrollPositionRef.current = position;
  }, []);

  // Restore scroll position
  const restoreScrollPosition = useCallback(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = scrollPositionRef.current;
    }
  }, []);

  // Set container ref for scroll management
  const setScrollContainer = useCallback(
    (element: HTMLElement | null) => {
      containerRef.current = element;
      if (element) {
        restoreScrollPosition();
      }
    },
    [restoreScrollPosition]
  );

  // Clear conversation
  const clearConversation = useCallback(() => {
    setMessages([]);
    if (persistToStorage) {
      localStorage.removeItem(`${STORAGE_KEY_PREFIX}${sessionId}`);
    }
  }, [sessionId, persistToStorage]);

  // Request history sync
  const syncHistory = useCallback(async () => {
    await webSocketManager.send({
      type: "sync_history",
      payload: { sessionId },
      timestamp: Date.now(),
      messageId: `sync-${Date.now()}`,
    });
  }, [sessionId]);

  return {
    messages,
    isConnected,
    isReconnecting,
    error,
    sendMessage,
    clearConversation,
    syncHistory,
    saveScrollPosition,
    restoreScrollPosition,
    setScrollContainer,
    scrollPosition: scrollPositionRef.current,
  };
}

export default useConversationState;
