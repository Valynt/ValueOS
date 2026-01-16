/**
 * Authentication Service Abstraction Layer
 * Provides a unified interface for all authentication operations
 * Integrates with secure storage, rate limiting, CSRF protection, and persistence
 */

import { secureTokenStorage } from "../lib/secureStorage";
import { authRateLimiter } from "../lib/rateLimiter";
import { csrfProtection } from "../lib/csrfProtection";
import { authPersistence } from "../lib/authPersistence";
import { sessionManager } from "../lib/sessionManager";
import { securityLogger } from "../lib/securityLogger";

// Types
export interface LoginCredentials {
  email: string;
  password: string;
}

export interface SignupData {
  email: string;
  password: string;
  fullName?: string;
}

export interface AuthUser {
  id: string;
  email: string;
  name?: string;
  role?: string;
  preferences?: Record<string, unknown>;
}

export interface AuthSession {
  user: AuthUser;
  token: string;
  refreshToken?: string;
  expiresAt: number;
  isActive: boolean;
}

export interface AuthResult {
  success: boolean;
  user?: AuthUser;
  session?: AuthSession;
  error?: string;
  requiresVerification?: boolean;
}

export interface AuthStatus {
  isAuthenticated: boolean;
  user?: AuthUser;
  session?: AuthSession;
  expiresAt?: number;
  rateLimitStatus?: {
    attempts: number;
    maxAttempts: number;
    isLocked: boolean;
    lockoutRemaining?: number;
  };
}

/**
 * Authentication Service - Abstracts all authentication operations
 */
class AuthService {
  private static instance: AuthService;
  private initialized = false;

  private constructor() {}

  static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  /**
   * Initialize the authentication service
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Initialize CSRF protection
      csrfProtection.initialize();

      // Check for persisted auth state
      const persistedState = await authPersistence.retrieveAuthState();
      if (persistedState) {
        // Restore session from persisted state
        sessionManager.startSession(persistedState.session.expiresAt);
      }

      this.initialized = true;
    } catch (error) {
      console.error("Failed to initialize auth service:", error);
      throw new Error("Authentication service initialization failed");
    }
  }

  /**
   * Login with email and password
   */
  async login(credentials: LoginCredentials): Promise<AuthResult> {
    const clientInfo = this.getClientInfo();

    try {
      // Log authentication attempt
      securityLogger.logAuthAttempt(credentials.email, clientInfo.ip, clientInfo.userAgent);

      // Validate input
      this.validateCredentials(credentials);

      // Check rate limiting
      const rateLimitStatus = authRateLimiter.canAttemptAuth(credentials.email);
      if (!rateLimitStatus.allowed) {
        const lockoutMinutes = rateLimitStatus.lockoutRemaining || 15;
        securityLogger.logRateLimitExceeded(
          credentials.email,
          clientInfo.ip,
          rateLimitStatus.maxAttempts,
          lockoutMinutes * 60 * 1000
        );

        return {
          success: false,
          error: `Too many failed attempts. Please try again in ${lockoutMinutes} minutes.`,
        };
      }

      // Make API call with CSRF protection
      const response = await csrfProtection.secureFetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(credentials),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        authRateLimiter.recordFailedAttempt(credentials.email);
        securityLogger.logAuthFailure(
          credentials.email,
          errorData.message || "Login failed",
          clientInfo.ip,
          clientInfo.userAgent
        );

        return {
          success: false,
          error: errorData.message || "Login failed",
        };
      }

      const authData = await response.json();

      // Validate response
      if (!authData.user || !authData.token) {
        authRateLimiter.recordFailedAttempt(credentials.email);
        return {
          success: false,
          error: "Invalid response from server",
        };
      }

      // Record successful attempt
      authRateLimiter.recordSuccessfulAttempt(credentials.email);
      securityLogger.logAuthSuccess(
        authData.user.id,
        credentials.email,
        clientInfo.ip,
        clientInfo.userAgent
      );

      // Store token securely
      const expiresAt = Date.now() + 60 * 60 * 1000; // 1 hour
      await secureTokenStorage.setToken({
        token: authData.token,
        refreshToken: authData.refreshToken,
        expiresAt,
        userId: authData.user.id,
      });

      // Log token issuance
      securityLogger.logTokenIssued(authData.user.id, "access", expiresAt);

      // Persist auth state
      await authPersistence.persistAuthState(
        authData.user,
        {
          expires_at: expiresAt,
          access_token: authData.token,
          refresh_token: authData.refreshToken,
        },
        "password"
      );

      // Start session management
      sessionManager.startSession(expiresAt);

      return {
        success: true,
        user: authData.user,
        session: {
          user: authData.user,
          token: authData.token,
          refreshToken: authData.refreshToken,
          expiresAt,
          isActive: true,
        },
      };
    } catch (error) {
      console.error("Login error:", error);
      return {
        success: false,
        error: "An unexpected error occurred during login",
      };
    }
  }

  /**
   * Sign up new user
   */
  async signup(data: SignupData): Promise<AuthResult> {
    try {
      // Validate input
      this.validateSignupData(data);

      // Check rate limiting
      const rateLimitStatus = authRateLimiter.canAttemptAuth(data.email);
      if (!rateLimitStatus.allowed) {
        const lockoutMinutes = rateLimitStatus.lockoutRemaining || 15;
        return {
          success: false,
          error: `Too many failed attempts. Please try again in ${lockoutMinutes} minutes.`,
        };
      }

      // Make API call with CSRF protection
      const response = await csrfProtection.secureFetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        authRateLimiter.recordFailedAttempt(data.email);
        return {
          success: false,
          error: errorData.message || "Registration failed",
        };
      }

      const authData = await response.json();

      // Handle email verification requirement
      if (!authData.session) {
        return {
          success: true,
          requiresVerification: true,
          user: authData.user,
        };
      }

      // Record successful attempt
      authRateLimiter.recordSuccessfulAttempt(data.email);

      // Store token securely
      const expiresAt = Date.now() + 60 * 60 * 1000;
      await secureTokenStorage.setToken({
        token: authData.token,
        refreshToken: authData.refreshToken,
        expiresAt,
        userId: authData.user.id,
      });

      // Persist auth state
      await authPersistence.persistAuthState(
        authData.user,
        {
          expires_at: expiresAt,
          access_token: authData.token,
          refresh_token: authData.refreshToken,
        },
        "password"
      );

      // Start session management
      sessionManager.startSession(expiresAt);

      return {
        success: true,
        user: authData.user,
        session: {
          user: authData.user,
          token: authData.token,
          refreshToken: authData.refreshToken,
          expiresAt,
          isActive: true,
        },
      };
    } catch (error) {
      console.error("Signup error:", error);
      return {
        success: false,
        error: "An unexpected error occurred during registration",
      };
    }
  }

  /**
   * Logout user
   */
  async logout(): Promise<void> {
    try {
      // Get current token
      const token = await secureTokenStorage.getAccessToken();

      if (token) {
        // Call logout endpoint with CSRF protection
        await csrfProtection.secureFetch("/api/auth/logout", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
      }

      // Clear all auth data
      await secureTokenStorage.clearToken();
      authPersistence.clearAuthState();
      sessionManager.cleanup();
      csrfProtection.clearToken();
    } catch (error) {
      console.error("Logout error:", error);
      // Still clear local data even if API call fails
      await secureTokenStorage.clearToken();
      authPersistence.clearAuthState();
      sessionManager.cleanup();
      csrfProtection.clearToken();
    }
  }

  /**
   * Get current authentication status
   */
  async getStatus(): Promise<AuthStatus> {
    try {
      const token = await secureTokenStorage.getAccessToken();
      const persistedState = await authPersistence.getAuthStateSummary();

      if (!token || !persistedState.isAuthenticated) {
        return { isAuthenticated: false };
      }

      return {
        isAuthenticated: true,
        user: persistedState.userId
          ? {
              id: persistedState.userId,
              email: persistedState.email || "",
            }
          : undefined,
        expiresAt: persistedState.expiresAt || undefined,
      };
    } catch (error) {
      console.error("Get status error:", error);
      return { isAuthenticated: false };
    }
  }

  /**
   * Refresh authentication token
   */
  async refreshToken(): Promise<boolean> {
    try {
      const refreshToken = await secureTokenStorage.getRefreshToken();
      if (!refreshToken) {
        return false;
      }

      const response = await csrfProtection.secureFetch("/api/auth/refresh", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ refreshToken }),
      });

      if (!response.ok) {
        return false;
      }

      const authData = await response.json();

      // Update stored token
      const expiresAt = Date.now() + 60 * 60 * 1000;
      await secureTokenStorage.updateToken(authData.token, expiresAt);

      // Extend session
      sessionManager.extendSession(expiresAt);

      return true;
    } catch (error) {
      console.error("Token refresh error:", error);
      return false;
    }
  }

  /**
   * Validate login credentials
   */
  private validateCredentials(credentials: LoginCredentials): void {
    if (!credentials.email || !credentials.password) {
      throw new Error("Email and password are required");
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(credentials.email)) {
      throw new Error("Invalid email format");
    }

    if (credentials.password.length < 8) {
      throw new Error("Password must be at least 8 characters");
    }
  }

  /**
   * Validate signup data
   */
  private validateSignupData(data: SignupData): void {
    if (!data.email || !data.password) {
      throw new Error("Email and password are required");
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.email)) {
      throw new Error("Invalid email format");
    }

    if (data.password.length < 8) {
      throw new Error("Password must be at least 8 characters");
    }

    if (data.fullName && data.fullName.trim().length < 2) {
      throw new Error("Name must be at least 2 characters");
    }
  }

  /**
   * Get client information for logging
   */
  private getClientInfo(): { ip?: string; userAgent?: string } {
    // In a real implementation, you would get the actual IP address
    // For now, we'll use placeholder values
    return {
      ip: undefined, // Would be extracted from request headers
      userAgent: navigator.userAgent,
    };
  }
}

// Export singleton instance
export const authService = AuthService.getInstance();
