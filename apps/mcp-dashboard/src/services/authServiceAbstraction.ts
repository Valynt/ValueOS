/**
 * Authentication Service Abstraction Layer
 * Browser authentication is managed through server-issued HttpOnly cookies.
 * No bearer or refresh tokens are persisted in browser-accessible storage.
 */

import { csrfProtection } from "../index";
import { authRateLimiter } from "../index";
import { secureTokenStorage } from "../index";

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
  managedByServer: true;
  expiresAt?: number;
  rotatedAt?: number;
  isActive: boolean;
}

export interface AuthResult {
  success: boolean;
  user?: AuthUser;
  session?: AuthSession;
  error?: string;
  requiresEmailVerification?: boolean;
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

function buildManagedSession(session?: { expiresAt?: number; rotatedAt?: number }): AuthSession {
  return {
    managedByServer: true,
    isActive: true,
    ...(session?.expiresAt !== undefined ? { expiresAt: session.expiresAt } : {}),
    ...(session?.rotatedAt !== undefined ? { rotatedAt: session.rotatedAt } : {}),
  };
}

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

  async initialize(): Promise<void> {
    if (this.initialized) return;

    csrfProtection.initialize();
    secureTokenStorage.invalidateLegacyStorageOnLoad();
    this.initialized = true;
  }

  async login(credentials: LoginCredentials): Promise<AuthResult> {
    try {
      this.validateCredentials(credentials);

      const rateLimitStatus = authRateLimiter.canAttemptAuth(credentials.email);
      if (!rateLimitStatus.allowed) {
        const lockoutMinutes = rateLimitStatus.lockoutRemaining || 15;
        return {
          success: false,
          error: `Too many failed attempts. Please try again in ${lockoutMinutes} minutes.`,
        };
      }

      const response = await csrfProtection.secureFetch("/api/auth/login", {
        method: "POST",
        credentials: "include",
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
          error: (errorData as { message?: string; error?: string }).message || (errorData as { error?: string }).error || "Login failed",
        };
      }

      const authData = (await response.json()) as {
        user?: AuthUser;
        session?: { managedByServer?: boolean; expiresAt?: number; rotatedAt?: number };
      };

      if (!authData.user) {
        authRateLimiter.recordFailedAttempt(credentials.email);
        return {
          success: false,
          error: "Invalid response from server",
        };
      }

      authRateLimiter.recordSuccessfulAttempt(credentials.email);

      return {
        success: true,
        user: authData.user,
        session: buildManagedSession(authData.session),
      };
    } catch (error) {
      console.error("Login error:", error);
      return {
        success: false,
        error: "An unexpected error occurred during login",
      };
    }
  }

  async signup(data: SignupData): Promise<AuthResult> {
    try {
      this.validateSignupData(data);

      const rateLimitStatus = authRateLimiter.canAttemptAuth(data.email);
      if (!rateLimitStatus.allowed) {
        const lockoutMinutes = rateLimitStatus.lockoutRemaining || 15;
        return {
          success: false,
          error: `Too many failed attempts. Please try again in ${lockoutMinutes} minutes.`,
        };
      }

      const response = await csrfProtection.secureFetch("/api/auth/signup", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ...data, fullName: data.name }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        authRateLimiter.recordFailedAttempt(data.email);
        return {
          success: false,
          error: (errorData as { message?: string; error?: string }).message || (errorData as { error?: string }).error || "Registration failed",
        };
      }

      const authData = (await response.json()) as {
        user?: AuthUser;
        session?: { managedByServer?: boolean; expiresAt?: number; rotatedAt?: number };
        requiresEmailVerification?: boolean;
      };

      authRateLimiter.recordSuccessfulAttempt(data.email);

      if (authData.requiresEmailVerification) {
        return {
          success: true,
          requiresEmailVerification: true,
        };
      }

      if (!authData.user) {
        return {
          success: false,
          error: "Invalid response from server",
        };
      }

      return {
        success: true,
        user: authData.user,
        session: buildManagedSession(authData.session),
      };
    } catch (error) {
      console.error("Signup error:", error);
      return {
        success: false,
        error: "An unexpected error occurred during registration",
      };
    }
  }

  async logout(): Promise<void> {
    try {
      await csrfProtection.secureFetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
    } finally {
      secureTokenStorage.clearToken();
      csrfProtection.clearToken();
    }
  }

  async getStatus(): Promise<AuthStatus> {
    try {
      const response = await fetch("/api/auth/session", {
        credentials: "include",
      });

      if (response.status === 401) {
        return { isAuthenticated: false };
      }

      if (!response.ok) {
        return { isAuthenticated: false };
      }

      const sessionData = (await response.json()) as {
        user?: AuthUser;
        session?: { managedByServer?: boolean; expiresAt?: number; rotatedAt?: number };
      };

      if (!sessionData.user) {
        return { isAuthenticated: false };
      }

      return {
        isAuthenticated: true,
        user: sessionData.user,
        session: buildManagedSession(sessionData.session),
      };
    } catch (error) {
      console.error("Get status error:", error);
      return { isAuthenticated: false };
    }
  }

  async refreshToken(): Promise<boolean> {
    try {
      const response = await csrfProtection.secureFetch("/api/auth/refresh", {
        method: "POST",
        credentials: "include",
      });

      return response.ok;
    } catch (error) {
      console.error("Token refresh error:", error);
      return false;
    }
  }

  getRateLimitStatus(email: string) {
    return authRateLimiter.getRateLimitStatus(email);
  }

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

export const authService = AuthService.getInstance();
