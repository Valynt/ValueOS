/**
 * Authentication Service Abstraction Layer
 * Provides a unified interface for all authentication operations
 * Integrates with secure storage, rate limiting, CSRF protection, and persistence
 */

import { csrfProtection } from "../index";
import { authRateLimiter } from "../index";
import { secureTokenStorage } from "../index";

// Types
export interface LoginCredentials {
  email: string;
  password: string;
}

export interface SignupData {
  email: string;
  password: string;
  name: string;
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: "user" | "admin";
  permissions: string[];
  apiKeys: Array<{ id: string; name: string; key: string; createdAt: Date }>;
  createdAt: Date;
  lastLogin: Date;
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
    try {
      // Validate input
      this.validateCredentials(credentials);

      // Check rate limiting
      const rateLimitStatus = authRateLimiter.canAttemptAuth(credentials.email);
      if (!rateLimitStatus.allowed) {
        const lockoutMinutes = rateLimitStatus.lockoutRemaining || 15;
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

      // Store token securely
      const expiresAt = Date.now() + 60 * 60 * 1000; // 1 hour
      await secureTokenStorage.setToken({
        token: authData.token,
        refreshToken: authData.refreshToken,
        expiresAt,
        userId: authData.user.id,
      });

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
      csrfProtection.clearToken();
    } catch (error) {
      console.error("Logout error:", error);
      // Still clear local data even if API call fails
      await secureTokenStorage.clearToken();
      csrfProtection.clearToken();
    }
  }

  /**
   * Get current authentication status
   */
  async getStatus(): Promise<AuthStatus> {
    try {
      const token = await secureTokenStorage.getAccessToken();

      if (!token) {
        return { isAuthenticated: false };
      }

      // Validate token with server
      const response = await fetch("/api/auth/validate", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        await secureTokenStorage.clearToken();
        return { isAuthenticated: false };
      }

      const userData = await response.json();

      return {
        isAuthenticated: true,
        user: userData,
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

      return true;
    } catch (error) {
      console.error("Token refresh error:", error);
      return false;
    }
  }

  /**
   * Get rate limit status for an email
   */
  getRateLimitStatus(email: string) {
    return authRateLimiter.getRateLimitStatus(email);
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
    if (!data.email || !data.password || !data.name) {
      throw new Error("Email, password, and name are required");
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.email)) {
      throw new Error("Invalid email format");
    }

    if (data.password.length < 8) {
      throw new Error("Password must be at least 8 characters");
    }

    if (data.name.trim().length < 2) {
      throw new Error("Name must be at least 2 characters");
    }
  }
}

// Export singleton instance
export const authService = AuthService.getInstance();
