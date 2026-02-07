import React, {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { io, Socket } from "socket.io-client";

import { secureTokenStorage } from "../lib/secureStorage";

import { useAuth } from "./AuthContext";

export interface StreamData {
  channel: string;
  data: Record<string, unknown>;
  timestamp: number;
  metadata?: {
    source?: string;
    quality?: number;
    delay?: number;
  };
}

export interface WebhookNotification {
  id: string;
  type: "sec_filing" | "market_data" | "system_alert";
  title: string;
  message: string;
  data: Record<string, unknown>;
  timestamp: number;
  priority: "low" | "medium" | "high" | "critical";
}

interface WebSocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  subscribe: (channel: string, callback: (data: StreamData) => void) => () => void;
  unsubscribe: (channel: string) => void;
  broadcastToChannel: (channel: string, data: Record<string, unknown>) => void;
  notifications: WebhookNotification[];
  clearNotifications: () => void;
  connectionStatus: "connecting" | "connected" | "disconnected" | "error";
}

const WebSocketContext = createContext<WebSocketContextType | undefined>(undefined);

export const useWebSocket = () => {
  const context = useContext(WebSocketContext);
  if (context === undefined) {
    throw new Error("useWebSocket must be used within a WebSocketProvider");
  }
  return context;
};

interface WebSocketProviderProps {
  children: ReactNode;
}

export const WebSocketProvider: React.FC<WebSocketProviderProps> = ({ children }) => {
  const { user } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<
    "connecting" | "connected" | "disconnected" | "error"
  >("disconnected");
  const [notifications, setNotifications] = useState<WebhookNotification[]>([]);
  const [subscriptions, setSubscriptions] = useState<Map<string, (data: StreamData) => void>>(
    new Map()
  );

  // Initialize socket connection
  useEffect(() => {
    if (!user) {
      if (socket) {
        socket.disconnect();
        setSocket(null);
        setIsConnected(false);
        setConnectionStatus("disconnected");
      }
      return;
    }

    setConnectionStatus("connecting");

    // Get auth token from secure storage
    const tokenData = secureTokenStorage.getAccessToken();

    if (!tokenData) {
      console.error("No authentication token available for WebSocket connection");
      setConnectionStatus("error");
      return;
    }

    // Create socket connection with secure authentication
    const newSocket = io(process.env.REACT_APP_WS_URL || "http://localhost:3001", {
      auth: {
        token: tokenData,
        userId: user.id,
      },
      transports: ["websocket", "polling"],
      timeout: 5000,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      // Add security headers
      extraHeaders: {
        "X-Auth-Token": tokenData,
        "X-User-ID": user.id,
      },
    });

    // Connection event handlers
    newSocket.on("connect", () => {
      setIsConnected(true);
      setConnectionStatus("connected");
      console.log("WebSocket connected securely");
    });

    newSocket.on("disconnect", (reason) => {
      setIsConnected(false);
      setConnectionStatus("disconnected");
      console.log("WebSocket disconnected:", reason);

      // If disconnected due to authentication error, clear token
      if (reason.toString().includes("auth") || reason.toString().includes("unauthorized")) {
        secureTokenStorage.clearToken();
      }
    });

    newSocket.on("connect_error", (error) => {
      setConnectionStatus("error");
      console.error("WebSocket connection error:", error);

      // Handle authentication errors
      if (error.message?.includes("auth") || error.message?.includes("unauthorized")) {
        secureTokenStorage.clearToken();
      }
    });

    // Data event handler
    newSocket.on("data", (message: StreamData) => {
      const callback = subscriptions.get(message.channel);
      if (callback) {
        callback(message);
      }
    });

    // Webhook notification handler
    newSocket.on("webhook", (notification: WebhookNotification) => {
      setNotifications((prev) => {
        // Keep only last 50 notifications
        const updated = [notification, ...prev].slice(0, 50);
        return updated;
      });
    });

    // Welcome message handler
    newSocket.on("welcome", (data) => {
      console.log("WebSocket welcome:", data);
    });

    // Subscription error handler
    newSocket.on("subscription_error", (error) => {
      console.error("Subscription error:", error);
    });

    setSocket(newSocket);

    // Cleanup function
    return () => {
      newSocket.disconnect();
    };
  }, [user]);

  // Heartbeat to keep connection alive
  useEffect(() => {
    if (!socket || !isConnected) return;

    const heartbeat = setInterval(() => {
      socket.emit("ping");
    }, 30000); // Ping every 30 seconds

    return () => clearInterval(heartbeat);
  }, [socket, isConnected]);

  const subscribe = useCallback(
    (channel: string, callback: (data: StreamData) => void) => {
      if (!socket || !isConnected) {
        console.warn("Cannot subscribe: WebSocket not connected");
        return () => {};
      }

      // Validate channel name for security
      if (!/^[a-zA-Z0-9_-]+$/.test(channel)) {
        console.error("Invalid channel name:", channel);
        return () => {};
      }

      // Store callback
      setSubscriptions((prev) => new Map(prev.set(channel, callback)));

      // Subscribe on server with authentication
      socket.emit("subscribe", {
        channels: [channel],
        filters: {},
        userId: user?.id,
        timestamp: Date.now(),
      });

      // Return unsubscribe function
      return () => {
        unsubscribe(channel);
      };
    },
    [socket, isConnected, user]
  );

  const unsubscribe = useCallback(
    (channel: string) => {
      if (!socket || !isConnected) return;

      // Remove callback
      setSubscriptions((prev) => {
        const newSubs = new Map(prev);
        newSubs.delete(channel);
        return newSubs;
      });

      // Unsubscribe on server with authentication
      socket.emit("unsubscribe", {
        channels: [channel],
        userId: user?.id,
        timestamp: Date.now(),
      });
    },
    [socket, isConnected, user]
  );

  const broadcastToChannel = useCallback(
    (channel: string, data: Record<string, unknown>) => {
      if (!socket || !isConnected) {
        console.warn("Cannot broadcast: WebSocket not connected");
        return;
      }

      // Validate channel name for security
      if (!/^[a-zA-Z0-9_-]+$/.test(channel)) {
        console.error("Invalid channel name for broadcast:", channel);
        return;
      }

      // Validate data size to prevent abuse
      const dataSize = JSON.stringify(data).length;
      if (dataSize > 1024 * 1024) {
        // 1MB limit
        console.error("Data too large for broadcast:", dataSize);
        return;
      }

      socket.emit("broadcast", {
        channel,
        data,
        timestamp: Date.now(),
        userId: user?.id,
      });
    },
    [socket, isConnected, user]
  );

  const clearNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  const value: WebSocketContextType = {
    socket,
    isConnected,
    subscribe,
    unsubscribe,
    broadcastToChannel,
    notifications,
    clearNotifications,
    connectionStatus,
  };

  return <WebSocketContext.Provider value={value}>{children}</WebSocketContext.Provider>;
};
