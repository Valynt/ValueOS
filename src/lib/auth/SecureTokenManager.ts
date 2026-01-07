/**
 * Secure JWT Token Manager
 * Provides secure JWT token management with validation and refresh handling
 */

import { supabase } from "../supabase";
import { createLogger } from "../logger";
import { Session, User } from "@supabase/supabase-js";

const logger = createLogger({ component: "SecureTokenManager" });

export interface TokenValidationResult {
  isValid: boolean;
  needsRefresh: boolean;
  expiresAt?: Date;
  timeToExpiry?: number;
}

export class SecureTokenManager {
  private static instance: SecureTokenManager;
  private tokenRefreshTimer: NodeJS.Timeout | null = null;
  private readonly REFRESH_BUFFER_TIME = 5 * 60 * 1000; // 5 minutes before expiry
  private readonly MAX_REFRESH_ATTEMPTS = 3;
  private refreshAttempts = 0;

  private static readonly SESSION_KEY = "vc_session_v2";
  private static readonly MAX_SESSION_AGE = 8 * 60 * 60 * 1000; // 8 hours
  private static readonly ROTATION_INTERVAL = 15 * 60 * 1000; // 15 minutes

  private constructor() {}

  static getInstance(): SecureTokenManager {
    if (!SecureTokenManager.instance) {
      SecureTokenManager.instance = new SecureTokenManager();
    }
    return SecureTokenManager.instance;
  }

  /**
   * Initialize secure token management
   */
  async initialize(): Promise<void> {
    try {
      // Set up automatic token refresh
      this.setupTokenRefresh();

      // Validate current session
      const session = await this.getCurrentSession();
      if (session) {
        this.scheduleTokenRefresh(session);
        logger.info("Secure token manager initialized");
      }
    } catch (error) {
      logger.error("Failed to initialize secure token manager", error as Error);
    }
  }

  /**
   * Store session securely in sessionStorage
   */
  storeSession(session: Session): void {
    try {
      if (typeof window === "undefined" || !window.sessionStorage) return;

      const sessionData = {
        ...session,
        storedAt: Date.now(),
        rotatedAt: Date.now(),
      };

      sessionStorage.setItem(
        SecureTokenManager.SESSION_KEY,
        JSON.stringify(sessionData)
      );
      logger.debug("Session stored securely in storage");
    } catch (error) {
      logger.error("Failed to store session", error as Error);
    }
  }

  /**
   * Clear session from storage
   */
  clearSessionStorage(): void {
    try {
      if (typeof window === "undefined" || !window.sessionStorage) return;

      sessionStorage.removeItem(SecureTokenManager.SESSION_KEY);
      localStorage.removeItem("supabase.auth.token"); // Clean up potential legacy tokens
      logger.debug("Session cleared from storage");
    } catch (error) {
      logger.error("Failed to clear session storage", error as Error);
    }
  }

  private rotateSessionStorage(sessionData: any): void {
    try {
      if (typeof window === "undefined" || !window.sessionStorage) return;

      sessionData.rotatedAt = Date.now();
      sessionStorage.setItem(
        SecureTokenManager.SESSION_KEY,
        JSON.stringify(sessionData)
      );
      logger.debug("Session storage rotated");
    } catch (error) {
      logger.error("Failed to rotate session storage", error as Error);
    }
  }

  /**
   * Get stored session synchronously (for optimistic UI)
   */
  getStoredSession(): Session | null {
    try {
      if (typeof window !== "undefined" && window.sessionStorage) {
        const stored = sessionStorage.getItem(SecureTokenManager.SESSION_KEY);
        if (stored) {
          const sessionData = JSON.parse(stored);
          const now = Date.now();

          // Check session age (8 hours max)
          if (
            now - (sessionData.storedAt || 0) >
            SecureTokenManager.MAX_SESSION_AGE
          ) {
            this.clearSessionStorage();
            logger.warn("Stored session expired due to max age");
            return null;
          }

          // Extract session shape
          if (sessionData && sessionData.user && sessionData.access_token) {
            const demoSession: Session = {
              access_token: sessionData.access_token,
              refresh_token: sessionData.refresh_token,
              expires_in: sessionData.expires_in,
              expires_at: sessionData.expires_at,
              token_type: sessionData.token_type,
              user: sessionData.user,
            } as Session;

            const validation = this.validateToken(demoSession);
            if (validation.isValid) {
              // Rotate if needed (client-side timestamp update)
              if (
                now - (sessionData.rotatedAt || 0) >
                SecureTokenManager.ROTATION_INTERVAL
              ) {
                this.rotateSessionStorage(sessionData);
              }
              return demoSession;
            } else if (validation.needsRefresh) {
              // Return it so the caller can attempt refresh, but mark as needing refresh if possible?
              // Standard Session object doesn't have "needsRefresh".
              // We'll return it, and let validation checks elsewhere handle it.
              return demoSession;
            }
          }
        }
      }
    } catch (err) {
      logger.debug("No valid session found in storage", err as Error);
    }
    return null;
  }

  /**
   * Get current session with validation, checking both Supabase state and secure storage
   */
  async getCurrentSession(): Promise<Session | null> {
    try {
      // 1. Try to get session from Supabase SDK (authoritative source)
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();

      if (session) {
        const validation = this.validateToken(session);
        if (!validation.isValid) {
          logger.warn("Current Supabase session is invalid", {
            needsRefresh: validation.needsRefresh,
          });
          if (validation.needsRefresh) {
            return await this.refreshToken();
          }
          return null;
        }
        // Sync to storage
        this.storeSession(session);
        return session;
      }

      // 2. Fallback: Check secure storage (Session Recovery)
      const storedSession = this.getStoredSession();
      if (storedSession) {
        logger.info("Restored session from secure storage");
        // Try to re-hydrate Supabase session if needed
        const { data, error: setSessionError } = await supabase.auth.setSession(
          {
            access_token: storedSession.access_token,
            refresh_token: storedSession.refresh_token,
          }
        );

        if (!setSessionError) {
          // If we successfully set it, return it (or refresh if needed)
          const validation = this.validateToken(storedSession);
          if (validation.needsRefresh) {
            return await this.refreshToken();
          }
          return storedSession;
        }
      }

      return null;
    } catch (error) {
      logger.error("Failed to get current session", error as Error);
      return null;
    }
  }

  /**
   * Validate JWT token
   */
  validateToken(session: Session): TokenValidationResult {
    try {
      const now = Date.now();
      const expiresAt = session.expires_at
        ? new Date(session.expires_at * 1000)
        : null;
      const issuedAt = session.issued_at
        ? new Date(session.issued_at * 1000)
        : null;

      // Check if token exists and is properly formatted
      if (!session.access_token || !session.refresh_token) {
        return { isValid: false, needsRefresh: false };
      }

      // Check expiration
      if (!expiresAt) {
        return { isValid: false, needsRefresh: false };
      }

      const timeToExpiry = expiresAt.getTime() - now;

      // Token is expired
      if (timeToExpiry <= 0) {
        return { isValid: false, needsRefresh: true };
      }

      // Token needs refresh (expires within buffer time)
      if (timeToExpiry <= this.REFRESH_BUFFER_TIME) {
        return { isValid: true, needsRefresh: true, expiresAt, timeToExpiry };
      }

      // Token is valid
      return { isValid: true, needsRefresh: false, expiresAt, timeToExpiry };
    } catch (error) {
      logger.error("Token validation failed", error as Error);
      return { isValid: false, needsRefresh: false };
    }
  }

  /**
   * Refresh JWT token securely
   */
  async refreshToken(): Promise<Session | null> {
    try {
      if (this.refreshAttempts >= this.MAX_REFRESH_ATTEMPTS) {
        logger.error("Max refresh attempts exceeded");
        await this.logout();
        return null;
      }

      this.refreshAttempts++;
      logger.info("Refreshing JWT token", { attempt: this.refreshAttempts });

      const { data, error } = await supabase.auth.refreshSession();

      if (error) {
        logger.error("Token refresh failed", error);

        // If refresh fails due to invalid refresh token, logout
        if (
          error.message?.includes("refresh_token_not_found") ||
          error.message?.includes("Invalid refresh token")
        ) {
          await this.logout();
          return null;
        }

        return null;
      }

      if (data.session) {
        this.refreshAttempts = 0; // Reset on success
        this.scheduleTokenRefresh(data.session);
        logger.info("Token refreshed successfully");
        return data.session;
      }

      return null;
    } catch (error) {
      logger.error("Token refresh error", error as Error);
      return null;
    }
  }

  /**
   * Schedule automatic token refresh
   */
  private scheduleTokenRefresh(session: Session): void {
    this.clearTokenRefreshTimer();

    const validation = this.validateToken(session);
    if (!validation.expiresAt || !validation.needsRefresh) {
      return;
    }

    const refreshTime =
      validation.expiresAt.getTime() - this.REFRESH_BUFFER_TIME - Date.now();

    if (refreshTime > 0) {
      this.tokenRefreshTimer = setTimeout(async () => {
        logger.info("Automatic token refresh triggered");
        await this.refreshToken();
      }, refreshTime);

      logger.debug("Token refresh scheduled", {
        refreshIn: Math.round(refreshTime / 1000),
        expiresAt: validation.expiresAt,
      });
    } else {
      // Token expires soon, refresh immediately
      this.refreshToken();
    }
  }

  /**
   * Set up token refresh listeners
   */
  private setupTokenRefresh(): void {
    // Listen for auth state changes
    supabase.auth.onAuthStateChange(async (event, session) => {
      logger.debug("Auth state changed", { event });

      if (event === "SIGNED_IN" && session) {
        this.scheduleTokenRefresh(session);
      } else if (event === "SIGNED_OUT") {
        this.clearTokenRefreshTimer();
        this.refreshAttempts = 0;
      } else if (event === "TOKEN_REFRESHED" && session) {
        this.scheduleTokenRefresh(session);
      }
    });
  }

  /**
   * Logout and clear all tokens
   */
  async logout(): Promise<void> {
    try {
      this.clearTokenRefreshTimer();
      this.refreshAttempts = 0;
      this.clearSessionStorage();

      const { error } = await supabase.auth.signOut();
      if (error) {
        logger.error("Logout error", error);
      } else {
        logger.info("Secure logout completed");
      }
    } catch (error) {
      logger.error("Logout failed", error as Error);
    }
  }

  /**
   * Get token metadata for debugging
   */
  getTokenMetadata(session: Session | null): {
    hasAccessToken: boolean;
    hasRefreshToken: boolean;
    expiresAt?: Date;
    issuedAt?: Date;
    timeToExpiry?: number;
    validation: TokenValidationResult;
  } | null {
    if (!session) return null;

    const validation = this.validateToken(session);
    const expiresAt = session.expires_at
      ? new Date(session.expires_at * 1000)
      : undefined;
    const issuedAt = session.issued_at
      ? new Date(session.issued_at * 1000)
      : undefined;

    return {
      hasAccessToken: !!session.access_token,
      hasRefreshToken: !!session.refresh_token,
      expiresAt,
      issuedAt,
      timeToExpiry: validation.timeToExpiry,
      validation,
    };
  }

  /**
   * Clear token refresh timer
   */
  private clearTokenRefreshTimer(): void {
    if (this.tokenRefreshTimer) {
      clearTimeout(this.tokenRefreshTimer);
      this.tokenRefreshTimer = null;
    }
  }

  /**
   * Destroy the token manager
   */
  destroy(): void {
    this.clearTokenRefreshTimer();
    this.refreshAttempts = 0;
  }
}

// Export singleton instance
export const secureTokenManager = SecureTokenManager.getInstance();
