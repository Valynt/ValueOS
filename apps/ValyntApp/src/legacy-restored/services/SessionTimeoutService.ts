/**
 * Session Timeout Service
 *
 * Manages role-based session timeouts and automatic renewals
 *
 * AUTH-004: Enhanced session management with role-specific policies
 *
 * Features:
 * - Role-based idle and absolute timeouts
 * - Automatic session renewal before expiry
 * - Session expiry warnings
 * - Graceful logout on timeout
 */

import { logger } from "@lib/logger";
import {
  getSessionTimeoutForRole,
  RoleSessionConfig,
} from "../security/SecurityConfig";

export interface SessionInfo {
  userId: string;
  role: string;
  createdAt: number;
  lastActivity: number;
  renewedAt?: number;
}

export interface SessionStatus {
  valid: boolean;
  reason?: "idle_timeout" | "absolute_timeout" | "active";
  timeUntilExpiry?: number;
  shouldWarn?: boolean;
  shouldRenew?: boolean;
}

export class SessionTimeoutService {
  /**
   * Check if session is valid based on role-specific timeouts
   */
  checkSession(session: SessionInfo): SessionStatus {
    const config = getSessionTimeoutForRole(session.role);
    const now = Date.now();

    // Check absolute timeout (time since session creation)
    const sessionAge = now - session.createdAt;
    if (sessionAge > config.absoluteTimeout) {
      logger.info("Session expired (absolute timeout)", {
        userId: session.userId,
        role: session.role,
        sessionAge: Math.round(sessionAge / 1000) + "s",
      });

      return {
        valid: false,
        reason: "absolute_timeout",
      };
    }

    // Check idle timeout (time since last activity)
    const idleTime = now - session.lastActivity;
    if (idleTime > config.idleTimeout) {
      logger.info("Session expired (idle timeout)", {
        userId: session.userId,
        role: session.role,
        idleTime: Math.round(idleTime / 1000) + "s",
      });

      return {
        valid: false,
        reason: "idle_timeout",
      };
    }

    // Calculate time until expiry (whichever comes first)
    const timeUntilIdleExpiry = config.idleTimeout - idleTime;
    const timeUntilAbsoluteExpiry = config.absoluteTimeout - sessionAge;
    const timeUntilExpiry = Math.min(
      timeUntilIdleExpiry,
      timeUntilAbsoluteExpiry
    );

    // Check if should show warning
    const shouldWarn = timeUntilExpiry <= config.warningThreshold;

    // Check if should auto-renew
    const shouldRenew = timeUntilExpiry <= config.renewalThreshold;

    return {
      valid: true,
      reason: "active",
      timeUntilExpiry,
      shouldWarn,
      shouldRenew,
    };
  }

  /**
   * Update last activity timestamp
   */
  updateActivity(session: SessionInfo): SessionInfo {
    return {
      ...session,
      lastActivity: Date.now(),
    };
  }

  /**
   * Renew session (reset timers)
   */
  renewSession(session: SessionInfo): SessionInfo {
    const now = Date.now();
    logger.info("Session renewed", {
      userId: session.userId,
      role: session.role,
    });

    return {
      ...session,
      lastActivity: now,
      renewedAt: now,
    };
  }

  /**
   * Format time remaining for display
   */
  formatTimeRemaining(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }

  /**
   * Get session info from request (Express)
   */
  getSessionInfo(req: any): SessionInfo | null {
    if (!req.session || !req.user) {
      return null;
    }

    return {
      userId: req.user.id,
      role: req.user.role || "member",
      createdAt: req.session.createdAt || Date.now(),
      lastActivity: req.session.lastActivity || Date.now(),
      renewedAt: req.session.renewedAt,
    };
  }

  /**
   * Update session in request (Express)
   */
  updateSessionInfo(req: any, session: SessionInfo): void {
    if (req.session) {
      req.session.createdAt = session.createdAt;
      req.session.lastActivity = session.lastActivity;
      req.session.renewedAt = session.renewedAt;
    }
  }
}

export const sessionTimeoutService = new SessionTimeoutService();
