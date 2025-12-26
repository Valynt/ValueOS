/**
 * Secure JWT Token Manager
 * Provides secure JWT token management with validation and refresh handling
 */

import { supabase } from '../supabase';
import { createLogger } from '../logger';
import { Session, User } from '@supabase/supabase-js';

const logger = createLogger({ component: 'SecureTokenManager' });

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
        logger.info('Secure token manager initialized');
      }
    } catch (error) {
      logger.error('Failed to initialize secure token manager', error as Error);
    }
  }

  /**
   * Get current session with validation
   */
  async getCurrentSession(): Promise<Session | null> {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();

      if (error) {
        logger.error('Error getting current session', error);
        // continue to fallback to any stored demo session
      }

      if (session) {
        const validation = this.validateToken(session);
        if (!validation.isValid) {
          logger.warn('Current session is invalid', { needsRefresh: validation.needsRefresh });
          if (validation.needsRefresh) {
            return await this.refreshToken();
          }
          return null;
        }
        return session;
      }

      // Fallback: check for a developer/demo session stored by the AuthContext SecureSessionManager
      try {
        if (typeof window !== 'undefined' && window.sessionStorage) {
          const raw = sessionStorage.getItem('vc_session_v2');
          if (raw) {
            const parsed = JSON.parse(raw);
            // The stored object may include metadata (storedAt/rotatedAt); extract the session shape
            const candidate = parsed as any;
            if (candidate && candidate.user && candidate.access_token) {
              // Normalize to Supabase Session shape
              const demoSession: Session = {
                access_token: candidate.access_token,
                refresh_token: candidate.refresh_token,
                expires_in: candidate.expires_in,
                expires_at: candidate.expires_at,
                token_type: candidate.token_type,
                user: candidate.user,
              } as Session;

              const validation = this.validateToken(demoSession);
              if (validation.isValid) {
                logger.info('Using demo session from sessionStorage');
                return demoSession;
              }
            }
          }
        }
      } catch (err) {
        logger.debug('No demo session found in sessionStorage', err as Error);
      }

      return null;
    } catch (error) {
      logger.error('Failed to get current session', error as Error);
      return null;
    }
  }

  /**
   * Validate JWT token
   */
  validateToken(session: Session): TokenValidationResult {
    try {
      const now = Date.now();
      const expiresAt = session.expires_at ? new Date(session.expires_at * 1000) : null;
      const issuedAt = session.issued_at ? new Date(session.issued_at * 1000) : null;

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
      logger.error('Token validation failed', error as Error);
      return { isValid: false, needsRefresh: false };
    }
  }

  /**
   * Refresh JWT token securely
   */
  async refreshToken(): Promise<Session | null> {
    try {
      if (this.refreshAttempts >= this.MAX_REFRESH_ATTEMPTS) {
        logger.error('Max refresh attempts exceeded');
        await this.logout();
        return null;
      }

      this.refreshAttempts++;
      logger.info('Refreshing JWT token', { attempt: this.refreshAttempts });

      const { data, error } = await supabase.auth.refreshSession();

      if (error) {
        logger.error('Token refresh failed', error);

        // If refresh fails due to invalid refresh token, logout
        if (error.message?.includes('refresh_token_not_found') ||
            error.message?.includes('Invalid refresh token')) {
          await this.logout();
          return null;
        }

        return null;
      }

      if (data.session) {
        this.refreshAttempts = 0; // Reset on success
        this.scheduleTokenRefresh(data.session);
        logger.info('Token refreshed successfully');
        return data.session;
      }

      return null;
    } catch (error) {
      logger.error('Token refresh error', error as Error);
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

    const refreshTime = validation.expiresAt.getTime() - this.REFRESH_BUFFER_TIME - Date.now();

    if (refreshTime > 0) {
      this.tokenRefreshTimer = setTimeout(async () => {
        logger.info('Automatic token refresh triggered');
        await this.refreshToken();
      }, refreshTime);

      logger.debug('Token refresh scheduled', {
        refreshIn: Math.round(refreshTime / 1000),
        expiresAt: validation.expiresAt
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
      logger.debug('Auth state changed', { event });

      if (event === 'SIGNED_IN' && session) {
        this.scheduleTokenRefresh(session);
      } else if (event === 'SIGNED_OUT') {
        this.clearTokenRefreshTimer();
        this.refreshAttempts = 0;
      } else if (event === 'TOKEN_REFRESHED' && session) {
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

      const { error } = await supabase.auth.signOut();
      if (error) {
        logger.error('Logout error', error);
      } else {
        logger.info('Secure logout completed');
      }
    } catch (error) {
      logger.error('Logout failed', error as Error);
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
    const expiresAt = session.expires_at ? new Date(session.expires_at * 1000) : undefined;
    const issuedAt = session.issued_at ? new Date(session.issued_at * 1000) : undefined;

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
