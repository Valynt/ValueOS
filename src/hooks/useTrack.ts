/**
 * useTrack Analytics Hook
 *
 * Provides analytics tracking with automatic context injection.
 * Auto-includes tenant, user, session, and correlation IDs.
 * Supports offline queue with flush on reconnect.
 */

import { useCallback, useEffect, useRef } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useTenant } from "../contexts/TenantContext";
import { analyticsClient } from "../lib/analyticsClient";
import { v4 as uuidv4 } from "uuid";

interface TrackEvent {
  name: string;
  properties?: Record<string, unknown>;
  timestamp?: string;
}

interface TrackContext {
  tenantId?: string;
  tenantName?: string;
  userId?: string;
  userEmail?: string;
  sessionId: string;
  correlationId?: string;
  pageUrl?: string;
  userAgent?: string;
}

interface UseTrackOptions {
  /** Custom correlation ID for request tracing */
  correlationId?: string;
  /** Disable automatic page view tracking */
  disablePageViews?: boolean;
  /** Custom session ID (defaults to generated UUID) */
  sessionId?: string;
}

// Offline event queue
const offlineQueue: TrackEvent[] = [];
const MAX_QUEUE_SIZE = 100;

// Session ID persisted for the browser session
const getSessionId = (): string => {
  if (typeof window === "undefined") return uuidv4();

  let sessionId = sessionStorage.getItem("valueos-session-id");
  if (!sessionId) {
    sessionId = uuidv4();
    sessionStorage.setItem("valueos-session-id", sessionId);
  }
  return sessionId;
};

/**
 * Flush offline queue when online
 */
function flushOfflineQueue(context: TrackContext) {
  while (offlineQueue.length > 0) {
    const event = offlineQueue.shift();
    if (event) {
      try {
        analyticsClient.track(event.name, {
          ...event.properties,
          ...context,
          _queued: true,
          _queuedAt: event.timestamp,
        });
      } catch {
        // Re-queue if still offline
        if (!navigator.onLine) {
          offlineQueue.unshift(event);
          break;
        }
      }
    }
  }
}

export function useTrack(options: UseTrackOptions = {}) {
  const { user } = useAuth();
  const { currentTenant } = useTenant();

  const sessionId = useRef(options.sessionId || getSessionId());
  const correlationId = useRef(options.correlationId || uuidv4());

  // Build context object
  const getContext = useCallback((): TrackContext => {
    return {
      tenantId: currentTenant?.id,
      tenantName: currentTenant?.name,
      userId: user?.id,
      userEmail: user?.email,
      sessionId: sessionId.current,
      correlationId: correlationId.current,
      pageUrl: typeof window !== "undefined" ? window.location.href : undefined,
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
    };
  }, [currentTenant, user]);

  // Track event with context
  const track = useCallback(
    (eventName: string, properties?: Record<string, unknown>) => {
      const context = getContext();
      const eventData = {
        ...properties,
        ...context,
        timestamp: new Date().toISOString(),
      };

      // Check if online
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        // Queue for later
        if (offlineQueue.length < MAX_QUEUE_SIZE) {
          offlineQueue.push({
            name: eventName,
            properties: eventData,
            timestamp: new Date().toISOString(),
          });
        }
        return;
      }

      try {
        analyticsClient.track(eventName, eventData);
      } catch (error) {
        console.error("[useTrack] Failed to track event:", error);
      }
    },
    [getContext]
  );

  // Track page view
  const trackPageView = useCallback(
    (pageName?: string, properties?: Record<string, unknown>) => {
      track("page_view", {
        pageName: pageName || document.title,
        path: window.location.pathname,
        search: window.location.search,
        referrer: document.referrer,
        ...properties,
      });
    },
    [track]
  );

  // Track error
  const trackError = useCallback(
    (error: Error | string, properties?: Record<string, unknown>) => {
      const errorMessage = error instanceof Error ? error.message : error;
      const errorStack = error instanceof Error ? error.stack : undefined;

      track("error", {
        errorMessage,
        errorStack,
        errorType: error instanceof Error ? error.name : "Unknown",
        ...properties,
      });
    },
    [track]
  );

  // Track user action
  const trackAction = useCallback(
    (action: string, target?: string, properties?: Record<string, unknown>) => {
      track("user_action", {
        action,
        target,
        ...properties,
      });
    },
    [track]
  );

  // Track timing
  const trackTiming = useCallback(
    (
      category: string,
      variable: string,
      duration: number,
      properties?: Record<string, unknown>
    ) => {
      track("timing", {
        category,
        variable,
        duration,
        ...properties,
      });
    },
    [track]
  );

  // Identify user
  const identify = useCallback(
    (traits?: Record<string, unknown>) => {
      if (!user?.id) return;

      try {
        analyticsClient.identify?.(user.id, {
          email: user.email,
          tenantId: currentTenant?.id,
          tenantName: currentTenant?.name,
          ...traits,
        });
      } catch (error) {
        console.error("[useTrack] Failed to identify user:", error);
      }
    },
    [user, currentTenant]
  );

  // Listen for online/offline events
  useEffect(() => {
    const handleOnline = () => {
      flushOfflineQueue(getContext());
    };

    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, [getContext]);

  // Auto-track page views on mount
  useEffect(() => {
    if (!options.disablePageViews) {
      trackPageView();
    }
  }, [options.disablePageViews, trackPageView]);

  // Identify user when they log in
  useEffect(() => {
    if (user?.id) {
      identify();
    }
  }, [user?.id, identify]);

  return {
    track,
    trackPageView,
    trackError,
    trackAction,
    trackTiming,
    identify,
    sessionId: sessionId.current,
    correlationId: correlationId.current,
    context: getContext(),
  };
}

/**
 * Higher-order function to wrap event handlers with tracking
 */
export function withTracking<T extends (...args: unknown[]) => unknown>(
  handler: T,
  eventName: string,
  getProperties?: (...args: Parameters<T>) => Record<string, unknown>
): T {
  return ((...args: Parameters<T>) => {
    const { track } = useTrack();
    const properties = getProperties?.(...args);
    track(eventName, properties);
    return handler(...args);
  }) as T;
}

export default useTrack;
