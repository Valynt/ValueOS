/**
 * Session Manager with Timeout and Auto-Refresh
 * Handles session expiration, refresh, and timeout warnings
 */

interface SessionConfig {
  warningThreshold: number; // Minutes before expiration to show warning
  refreshThreshold: number; // Minutes before expiration to attempt refresh
  maxSessionDuration: number; // Maximum session duration in minutes
  refreshInterval: number; // Check interval in seconds
}

class SessionManager {
  private config: SessionConfig = {
    warningThreshold: 5, // 5 minutes warning
    refreshThreshold: 10, // 10 minutes before expiration
    maxSessionDuration: 60, // 60 minutes max
    refreshInterval: 30, // Check every 30 seconds
  };

  private refreshTimer: NodeJS.Timeout | null = null;
  private warningTimer: NodeJS.Timeout | null = null;
  private expirationTimer: NodeJS.Timeout | null = null;
  private listeners: Set<(event: SessionEvent) => void> = new Set();

  constructor() {
    this.setupEventListeners();
  }

  /**
   * Session event types
   */
  private emit(event: SessionEvent): void {
    this.listeners.forEach((listener) => {
      try {
        listener(event);
      } catch (error) {
        console.error("Session event listener error:", error);
      }
    });
  }

  /**
   * Add session event listener
   */
  addEventListener(listener: (event: SessionEvent) => void): () => void {
    this.listeners.add(listener);

    // Return cleanup function
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Setup browser event listeners for session management
   */
  private setupEventListeners(): void {
    if (typeof window !== "undefined") {
      // Handle visibility change
      document.addEventListener("visibilitychange", () => {
        if (!document.hidden) {
          this.checkSessionStatus();
        }
      });

      // Handle page unload
      window.addEventListener("beforeunload", () => {
        this.cleanup();
      });

      // Handle user activity
      const activityEvents = ["mousedown", "mousemove", "keypress", "scroll", "touchstart"];
      activityEvents.forEach((event) => {
        document.addEventListener(event, this.handleUserActivity.bind(this), { passive: true });
      });
    }
  }

  /**
   * Handle user activity to extend session
   */
  private handleUserActivity(): void {
    // Could implement activity-based session extension here
    // For now, just check session status
    this.checkSessionStatus();
  }

  /**
   * Start session management
   */
  startSession(expiresAt: number): void {
    this.cleanup(); // Clear any existing timers

    const now = Date.now();
    const timeUntilExpiration = expiresAt - now;

    if (timeUntilExpiration <= 0) {
      this.emit({ type: "expired" });
      return;
    }

    // Set up periodic checks
    this.refreshTimer = setInterval(() => {
      this.checkSessionStatus();
    }, this.config.refreshInterval * 1000);

    // Set up warning timer
    const warningTime = expiresAt - this.config.warningThreshold * 60 * 1000;
    if (warningTime > now) {
      this.warningTimer = setTimeout(() => {
        this.emit({
          type: "warning",
          minutesRemaining: this.config.warningThreshold,
        });
      }, warningTime - now);
    }

    // Set up expiration timer
    this.expirationTimer = setTimeout(() => {
      this.emit({ type: "expired" });
    }, timeUntilExpiration);

    this.emit({ type: "started", expiresAt });
  }

  /**
   * Check current session status
   */
  private checkSessionStatus(): void {
    // This would typically check with the server
    // For now, we'll emit a check event
    this.emit({ type: "check" });
  }

  /**
   * Attempt to refresh the session
   */
  async refreshSession(): Promise<boolean> {
    try {
      // This would make an API call to refresh the token
      // For now, emit a refresh event
      this.emit({ type: "refresh" });

      // In a real implementation, you would:
      // 1. Call the refresh endpoint
      // 2. Update the stored token
      // 3. Restart the session timers

      return true;
    } catch (error) {
      console.error("Session refresh failed:", error);
      this.emit({ type: "refresh-failed", error: error as Error });
      return false;
    }
  }

  /**
   * Extend session duration
   */
  extendSession(newExpiresAt: number): void {
    this.cleanup();
    this.startSession(newExpiresAt);
    this.emit({ type: "extended", expiresAt: newExpiresAt });
  }

  /**
   * Get session status information
   */
  getSessionStatus(): {
    isActive: boolean;
    timeUntilExpiration?: number;
    minutesUntilExpiration?: number;
    needsWarning: boolean;
    needsRefresh: boolean;
  } {
    // This would check actual session data
    // For now, return default status
    return {
      isActive: false,
      needsWarning: false,
      needsRefresh: false,
    };
  }

  /**
   * Force session expiration
   */
  forceExpiration(): void {
    this.cleanup();
    this.emit({ type: "expired" });
  }

  /**
   * Cleanup all timers and event listeners
   */
  cleanup(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }

    if (this.warningTimer) {
      clearTimeout(this.warningTimer);
      this.warningTimer = null;
    }

    if (this.expirationTimer) {
      clearTimeout(this.expirationTimer);
      this.expirationTimer = null;
    }
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<SessionConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
}

// Session event types
export type SessionEvent =
  | { type: "started"; expiresAt: number }
  | { type: "warning"; minutesRemaining: number }
  | { type: "refresh" }
  | { type: "refresh-failed"; error: Error }
  | { type: "extended"; expiresAt: number }
  | { type: "expired" }
  | { type: "check" };

// Export singleton instance
export const sessionManager = new SessionManager();
