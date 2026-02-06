/**
 * Authentication Service
 * Handles session management and authentication operations
 */

import { logger } from "../../lib/logger";
import { BaseService } from "./BaseService";
import {
  AuthenticationError,
  RateLimitError,
  SessionTimeoutAuthenticationError,
  ServiceError,
  TokenAuthenticationError,
  ValidationError,
} from "./errors";
import { Session, User } from "@supabase/supabase-js";
import { sanitizeErrorMessage, validatePassword } from "../utils/security";
import { securityLogger } from "./SecurityLogger";
import { getConfig } from "../config/environment";
import {
  checkPasswordBreach,
  consumeAuthRateLimit,
  RateLimitExceededError,
  resetRateLimit,
} from "../security";
import { clientRateLimit } from "./ClientRateLimit";
import { mfaService } from "./MFAService";
import { fetchWithCSRF } from "../security/CSRFProtection";

export interface LoginCredentials {
  email: string;
  password: string;
  otpCode?: string;
}

export interface SignupData {
  email: string;
  password: string;
  fullName: string;
}

export interface AuthSession {
  user: User;
  session: Session | null;
  requiresEmailVerification?: boolean;
}

export type AuthFailureCode =
  | "SESSION_IDLE_TIMEOUT"
  | "SESSION_ABSOLUTE_TIMEOUT"
  | "TOKEN_EXPIRED"
  | "INVALID_TOKEN"
  | "INVALID_TOKEN_CLAIMS"
  | "MFA_ENROLLMENT_REQUIRED"
  | "MFA_CODE_REQUIRED"
  | "MFA_INVALID_CODE";

interface MFAEnrollmentRequiredErrorPayload {
  code: "MFA_ENROLLMENT_REQUIRED";
  userId: string;
  role: string;
}

interface AuthEndpointErrorPayload {
  error?: string;
  code?: AuthFailureCode | string;
  details?: Record<string, unknown>;
  userId?: unknown;
  role?: unknown;
  [key: string]: unknown;
}

export class AuthService extends BaseService {
  constructor() {
    super("AuthService");
  }

  private isBrowser(): boolean {
    return typeof window !== "undefined";
  }

  private getAuthApiUrl(path: string): string {
    const config = getConfig();
    const baseUrl = config.app.apiBaseUrl || "/api";
    const normalizedBase = baseUrl.endsWith("/api") ? baseUrl : `${baseUrl.replace(/\/$/, "")}/api`;

    return `${normalizedBase}/auth${path}`;
  }

  private static readonly SESSION_TIMEOUTS = {
    ABSOLUTE_TIMEOUT_MS: 60 * 60 * 1000,
    IDLE_TIMEOUT_MS: 30 * 60 * 1000,
    CLOCK_SKEW_MS: 5 * 1000,
  };

  private decodeJwt(token: string): Record<string, unknown> | null {
    try {
      const parts = token.split(".");
      if (parts.length !== 3) {
        return null;
      }
      const normalized = parts[1].replace(/-/g, "+").replace(/_/g, "/");
      const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=");
      const payload =
        typeof Buffer !== "undefined"
          ? Buffer.from(padded, "base64").toString("utf-8")
          : typeof atob !== "undefined"
          ? atob(padded)
          : "";
      if (!payload) {
        return null;
      }
      const decoded = JSON.parse(payload) as Record<string, unknown>;
      return decoded;
    } catch {
      return null;
    }
  }

  private validateSessionTimeouts(session: Session): void {
    const accessToken = session.access_token;
    if (!accessToken) {
      return;
    }

    const claims = this.decodeJwt(accessToken);
    if (!claims) {
      return;
    }

    const issuedAt = typeof claims.iat === "number" ? claims.iat : undefined;
    const expiresAt = typeof claims.exp === "number" ? claims.exp : session.expires_at;
    if (!issuedAt || !expiresAt) {
      return;
    }

    const now = Math.floor(Date.now() / 1000);
    const clockSkewSeconds = AuthService.SESSION_TIMEOUTS.CLOCK_SKEW_MS / 1000;

    if (expiresAt + clockSkewSeconds < now) {
      throw new TokenAuthenticationError("Token expired", "TOKEN_EXPIRED", {
        expiresAt,
        currentTime: now,
      });
    }

    const tokenAge = now - issuedAt;
    const maxAge = AuthService.SESSION_TIMEOUTS.ABSOLUTE_TIMEOUT_MS / 1000;
    if (tokenAge > maxAge) {
      throw new SessionTimeoutAuthenticationError(
        "Session expired due to absolute timeout (1 hour)",
        "SESSION_ABSOLUTE_TIMEOUT",
        { tokenAge, maxAge }
      );
    }

    const maxIdle = AuthService.SESSION_TIMEOUTS.IDLE_TIMEOUT_MS / 1000;
    if (tokenAge > maxIdle) {
      throw new SessionTimeoutAuthenticationError(
        "Session expired due to inactivity (30 minutes idle)",
        "SESSION_IDLE_TIMEOUT",
        { idleTime: tokenAge, maxIdle }
      );
    }
  }

  private mapAuthFailure(payload: AuthEndpointErrorPayload, responseStatus: number): ServiceError {
    const isRecord = (value: unknown): value is Record<string, unknown> =>
      typeof value === "object" && value !== null && !Array.isArray(value);
    const payloadRecord = isRecord(payload) ? payload : {};
    const payloadDetails = isRecord(payloadRecord.details) ? payloadRecord.details : {};
    const { error: _error, code: _code, details: _details, ...rest } = payloadRecord;
    const normalizedDetails = {
      ...rest,
      ...payloadDetails,
    };
    const hasDetails = Object.keys(normalizedDetails).length > 0;
    const details = hasDetails ? normalizedDetails : undefined;
    const code = typeof payload.code === "string" ? payload.code : undefined;
    const errorCode = typeof payloadRecord.errorCode === "string" ? payloadRecord.errorCode : undefined;
    const message = typeof payload.error === "string" ? payload.error : "Request failed";
    const normalizedCode = code?.toUpperCase() ?? errorCode?.toUpperCase();

    if (
      normalizedCode === "SESSION_IDLE_TIMEOUT" ||
      normalizedCode === "SESSION_ABSOLUTE_TIMEOUT" ||
      responseStatus === 440
    ) {
      const timeoutCode: AuthFailureCode =
        normalizedCode === "SESSION_IDLE_TIMEOUT" ? "SESSION_IDLE_TIMEOUT" : "SESSION_ABSOLUTE_TIMEOUT";
      return new SessionTimeoutAuthenticationError(message, timeoutCode, details);
    }

    if (
      normalizedCode === "TOKEN_EXPIRED" ||
      normalizedCode === "INVALID_TOKEN" ||
      normalizedCode === "INVALID_TOKEN_CLAIMS"
    ) {
      const tokenCode: AuthFailureCode =
        normalizedCode === "INVALID_TOKEN_CLAIMS"
          ? "INVALID_TOKEN_CLAIMS"
          : normalizedCode === "TOKEN_EXPIRED"
          ? "TOKEN_EXPIRED"
          : "INVALID_TOKEN";
      return new TokenAuthenticationError(message, tokenCode, details);
    }

    if (normalizedCode === "RATE_LIMIT_EXCEEDED" || responseStatus === 429) {
      const retryAfter = typeof details?.retryAfter === "number" ? details.retryAfter : undefined;
      return new RateLimitError(message, retryAfter);
    }

    if (
      normalizedCode === "VALIDATION_ERROR" ||
      normalizedCode === "AUTH_VALIDATION_ERROR" ||
      responseStatus === 400
    ) {
      return new ValidationError(message, details);
    }

    if (normalizedCode === "MFA_ENROLLMENT_REQUIRED") {
      const mfaUserId =
        typeof details?.userId === "string"
          ? details.userId
          : typeof payload.userId === "string"
          ? payload.userId
          : undefined;
      const mfaRole =
        typeof details?.role === "string"
          ? details.role
          : typeof payload.role === "string"
          ? payload.role
          : undefined;
      const mfaDetails: MFAEnrollmentRequiredErrorPayload = {
        code: "MFA_ENROLLMENT_REQUIRED",
        userId: typeof mfaUserId === "string" && mfaUserId.length > 0 ? mfaUserId : "unknown",
        role: typeof mfaRole === "string" && mfaRole.length > 0 ? mfaRole : "manager",
      };

      return new AuthenticationError(message, { ...(details ?? {}), ...mfaDetails }, responseStatus, normalizedCode);
    }

    return new AuthenticationError(message, details, responseStatus, normalizedCode);
  }

  private mapSupabaseAuthError(error: unknown): AuthenticationError {
    const isRecord = (value: unknown): value is Record<string, unknown> =>
      typeof value === "object" && value !== null && !Array.isArray(value);
    const record = isRecord(error) ? error : {};
    const status = typeof record.status === "number" ? record.status : undefined;
    const code = typeof record.code === "string" ? record.code : undefined;
    const message = typeof record.message === "string" ? record.message : "Invalid credentials";
    const details = this.sanitizeAuthErrorDetails(record);

    const normalizedCode = code?.toLowerCase();
    const normalizedMessage = message.toLowerCase();

    const isSessionTimeout =
      status === 440 ||
      normalizedCode?.includes("session") ||
      (normalizedMessage.includes("session") &&
        (normalizedMessage.includes("timeout") ||
          normalizedMessage.includes("expired") ||
          normalizedMessage.includes("inactivity")));
    if (isSessionTimeout) {
      const timeoutCode: AuthFailureCode =
        normalizedCode?.includes("idle") || normalizedMessage.includes("idle")
          ? "SESSION_IDLE_TIMEOUT"
          : "SESSION_ABSOLUTE_TIMEOUT";
      return new SessionTimeoutAuthenticationError(message, timeoutCode, details);
    }

    const isTokenIssue =
      normalizedCode?.includes("jwt") ||
      normalizedCode?.includes("token") ||
      normalizedMessage.includes("jwt") ||
      normalizedMessage.includes("token");
    if (isTokenIssue) {
      const tokenCode: AuthFailureCode =
        normalizedCode?.includes("claim") || normalizedMessage.includes("claim")
          ? "INVALID_TOKEN_CLAIMS"
          : normalizedCode?.includes("expired") || normalizedMessage.includes("expired")
          ? "TOKEN_EXPIRED"
          : "INVALID_TOKEN";
      return new TokenAuthenticationError(message, tokenCode, details);
    }

    const isMfaIssue =
      normalizedCode?.includes("mfa") ||
      normalizedCode?.includes("otp") ||
      normalizedMessage.includes("mfa") ||
      normalizedMessage.includes("otp");
    if (isMfaIssue) {
      let authCode: AuthFailureCode = "MFA_INVALID_CODE";
      if (
        normalizedCode?.includes("enroll") ||
        normalizedMessage.includes("enroll") ||
        normalizedMessage.includes("setup")
      ) {
        authCode = "MFA_ENROLLMENT_REQUIRED";
      } else if (
        normalizedCode?.includes("required") ||
        normalizedMessage.includes("required") ||
        normalizedMessage.includes("missing")
      ) {
        authCode = "MFA_CODE_REQUIRED";
      }

      return new AuthenticationError(message, details, status ?? 401, authCode);
    }

    return new AuthenticationError(message, details, status ?? 401);
  }

  private sanitizeAuthErrorDetails(error: Record<string, unknown>): Record<string, unknown> | undefined {
    const redactions = new Set(["access_token", "refresh_token", "token", "password", "authorization", "cookie"]);
    const sanitized: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(error)) {
      if (redactions.has(key.toLowerCase())) {
        continue;
      }
      if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
        sanitized[key] = value;
      }
    }

    return Object.keys(sanitized).length > 0 ? sanitized : undefined;
  }

  private async callAuthEndpoint<T>(path: string, options: RequestInit): Promise<T> {
    const headers = new Headers(options.headers);
    const { data: sessionData } = await this.supabase.auth.getSession();
    if (sessionData?.session?.access_token && !headers.has("Authorization")) {
      headers.set("Authorization", `Bearer ${sessionData.session.access_token}`);
    }

    const response = await fetchWithCSRF(this.getAuthApiUrl(path), {
      credentials: "include",
      ...options,
      headers,
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw this.mapAuthFailure(payload as AuthEndpointErrorPayload, response.status);
    }

    return payload as T;
  }

  /**
   * Enforce auth-specific rate limits backed by the shared security configuration.
   */
  private enforceAuthRateLimit(identifier: string, action: string): void {
    try {
      consumeAuthRateLimit(identifier);
    } catch (error) {
      if (error instanceof RateLimitExceededError) {
        securityLogger.log({
          category: "authentication",
          action: `${action}-rate-limit`,
          severity: "warn",
          metadata: { identifier, retryAfter: error.retryAfter },
        });
        throw new RateLimitError(
          "Too many authentication attempts. Please try again later.",
          error.retryAfter
        );
      }
      throw error;
    }
  }

  /**
   * Sign up a new user
   */
  async signup(data: SignupData): Promise<AuthSession> {
    this.validateRequired(data, ["email", "password", "fullName"]);

    const passwordValidation = validatePassword(data.password);
    if (!passwordValidation.valid) {
      throw new ValidationError(passwordValidation.errors.join(". "));
    }

    const breached = await checkPasswordBreach(data.password);
    if (breached) {
      throw new ValidationError("Password appears in breach corpus. Choose a different password.");
    }

    const config = getConfig();
    if (config.auth.mfaEnabled) {
      securityLogger.log({
        category: "authentication",
        action: "signup-mfa-hint",
        severity: "info",
        metadata: { email: data.email },
      });
    }

    this.enforceAuthRateLimit(data.email, "signup");

    this.log("info", "User signup", { email: data.email });

    if (this.isBrowser()) {
      const payload = await this.callAuthEndpoint<{
        user: User;
        session: Session | null;
        requiresEmailVerification?: boolean;
      }>("/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (payload.session?.access_token && payload.session.refresh_token) {
        const { data: sessionData, error } = await this.supabase.auth.setSession({
          access_token: payload.session.access_token,
          refresh_token: payload.session.refresh_token,
        });

        if (error) {
          throw new AuthenticationError(sanitizeErrorMessage(error));
        }

        return {
          user: sessionData.user ?? payload.user,
          session: sessionData.session,
          requiresEmailVerification: payload.requiresEmailVerification,
        };
      }

      return {
        user: payload.user,
        session: null,
        requiresEmailVerification: payload.requiresEmailVerification ?? true,
      };
    }

    return this.executeRequest(
      async () => {
        const { data: authData, error } = await this.supabase.auth.signUp({
          email: data.email,
          password: data.password,
          options: {
            data: {
              full_name: data.fullName,
            },
            emailRedirectTo: `${getConfig().app.url}/auth/callback`,
          },
        });

        if (error) {
          throw new AuthenticationError(sanitizeErrorMessage(error));
        }
        if (!authData.user) {
          throw new AuthenticationError("Signup failed");
        }

        resetRateLimit("auth", data.email);

        return {
          user: authData.user,
          session: authData.session ?? null,
          requiresEmailVerification: !authData.session,
        };
      },
      { skipCache: true }
    );
  }

  /**
   * Sign in with email and password
   *
   * AUTH-001: Enforces MFA for privileged roles (super_admin, admin, manager)
   */
  async login(credentials: LoginCredentials): Promise<AuthSession> {
    this.validateRequired(credentials, ["email", "password"]);

    // Apply client-side rate limiting
    const rateLimitAllowed = await clientRateLimit.checkLimit("auth-attempts");
    if (!rateLimitAllowed) {
      throw new RateLimitError("Too many authentication attempts. Please try again later.", 900);
    }

    this.enforceAuthRateLimit(credentials.email, "login");

    this.log("info", "User login", { email: credentials.email });

    if (this.isBrowser()) {
      const payload = await this.callAuthEndpoint<{
        user: User;
        session: Session;
      }>("/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(credentials),
      });

      const { data: sessionData, error } = await this.supabase.auth.setSession({
        access_token: payload.session.access_token,
        refresh_token: payload.session.refresh_token,
      });

      if (error) {
        throw new AuthenticationError(sanitizeErrorMessage(error));
      }

      return {
        user: sessionData.user ?? payload.user,
        session: sessionData.session,
      };
    }

    return this.executeRequest(
      async () => {
        // First, authenticate with Supabase
        const { data, error } = await this.supabase.auth.signInWithPassword({
          email: credentials.email,
          password: credentials.password,
        });

        if (error) {
          securityLogger.log({
            category: "authentication",
            action: "login-failed",
            severity: "warn",
            metadata: { email: credentials.email },
          });
          throw this.mapSupabaseAuthError(error);
        }
        if (!data.user || !data.session) {
          securityLogger.log({
            category: "authentication",
            action: "login-failed",
            severity: "warn",
            metadata: { email: credentials.email, reason: "missing-session" },
          });
          throw new AuthenticationError("Invalid credentials");
        }

        this.validateSessionTimeouts(data.session);

        // AUTH-001: Check if user's role requires MFA
        const userRole = data.user.user_metadata?.role as string;
        const mfaRequired = mfaService.isMFARequiredForRole(userRole);

        if (mfaRequired) {
          // Check if user has MFA enabled
          const mfaEnabled = await mfaService.hasMFAEnabled(data.user.id);

          if (!mfaEnabled) {
            // User needs to enroll in MFA
            securityLogger.log({
              category: "authentication",
              action: "mfa-enrollment-required",
              severity: "warn",
              metadata: { userId: data.user.id, role: userRole },
            });

            throw new AuthenticationError(
              "Your role requires multi-factor authentication. Please complete MFA setup.",
              { code: "MFA_ENROLLMENT_REQUIRED", mfaEnrollmentRequired: true, userId: data.user.id, role: userRole },
              403,
              "MFA_ENROLLMENT_REQUIRED"
            );
          }

          // Verify MFA token
          if (!credentials.otpCode) {
            throw new AuthenticationError(
              "MFA code required for your role",
              { code: "MFA_CODE_REQUIRED" },
              400,
              "MFA_CODE_REQUIRED"
            );
          }

          const mfaResult = await mfaService.verifyMFAToken(data.user.id, credentials.otpCode);

          if (!mfaResult.verified) {
            securityLogger.log({
              category: "authentication",
              action: "mfa-verification-failed",
              severity: "warn",
              metadata: { userId: data.user.id },
            });
            throw new AuthenticationError(
              "Invalid MFA code",
              { code: "MFA_INVALID_CODE", userId: data.user.id },
              401,
              "MFA_INVALID_CODE"
            );
          }

          if (mfaResult.usedBackupCode) {
            logger.warn("User logged in with backup code", {
              userId: data.user.id,
            });
          }
        }

        resetRateLimit("auth", credentials.email);
        securityLogger.log({
          category: "authentication",
          action: "login-success",
          metadata: { email: credentials.email, mfaUsed: mfaRequired },
        });

        return {
          user: data.user,
          session: data.session,
        };
      },
      { skipCache: true }
    );
  }

  /**
   * Sign out current user
   */
  async logout(): Promise<void> {
    this.log("info", "User logout");

    if (this.isBrowser()) {
      await this.callAuthEndpoint("/logout", { method: "POST" });
      const { error } = await this.supabase.auth.signOut();
      if (error) {
        throw new AuthenticationError(sanitizeErrorMessage(error));
      }
      return;
    }

    return this.executeRequest(
      async () => {
        const { error } = await this.supabase.auth.signOut();
        if (error) throw new AuthenticationError(sanitizeErrorMessage(error));

        this.clearCache();
      },
      { skipCache: true }
    );
  }

  /**
   * Get current session
   */
  async getSession(): Promise<Session | null> {
    return this.executeRequest(
      async () => {
        const { data, error } = await this.supabase.auth.getSession();
        if (error) throw new AuthenticationError(sanitizeErrorMessage(error));
        return data.session;
      },
      { deduplicationKey: "current-session" }
    );
  }

  /**
   * Get current user
   */
  async getCurrentUser(): Promise<User | null> {
    return this.executeRequest(
      async () => {
        const { data, error } = await this.supabase.auth.getUser();
        if (error) throw new AuthenticationError(sanitizeErrorMessage(error));
        return data.user;
      },
      { deduplicationKey: "current-user" }
    );
  }

  /**
   * Refresh session
   */
  async refreshSession(): Promise<AuthSession> {
    this.log("info", "Refreshing session");

    if (this.isBrowser()) {
      const payload = await this.callAuthEndpoint<{
        user: User;
        session: Session;
      }>("/refresh", { method: "POST" });

      const { data: sessionData, error } = await this.supabase.auth.setSession({
        access_token: payload.session.access_token,
        refresh_token: payload.session.refresh_token,
      });

      if (error) {
        throw new AuthenticationError(sanitizeErrorMessage(error));
      }

      return {
        user: sessionData.user ?? payload.user,
        session: sessionData.session,
      };
    }

    return this.executeRequest(
      async () => {
        const { data, error } = await this.supabase.auth.refreshSession();
        if (error) throw new AuthenticationError(sanitizeErrorMessage(error));
        if (!data.user || !data.session) {
          throw new AuthenticationError("Session refresh failed");
        }

        this.clearCache("current-session");
        this.clearCache("current-user");

        return {
          user: data.user,
          session: data.session,
        };
      },
      { skipCache: true }
    );
  }

  /**
   * Request password reset
   */
  async requestPasswordReset(email: string): Promise<void> {
    this.enforceAuthRateLimit(email, "password-reset");

    this.log("info", "Password reset requested", { email });

    if (this.isBrowser()) {
      await this.callAuthEndpoint("/password/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      return;
    }

    return this.executeRequest(
      async () => {
        const { error } = await this.supabase.auth.resetPasswordForEmail(email);
        if (error) {
          throw new AuthenticationError(sanitizeErrorMessage(error));
        }
        resetRateLimit("auth", email);
      },
      { skipCache: true }
    );
  }

  /**
   * Update password
   */
  async updatePassword(newPassword: string): Promise<void> {
    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.valid) {
      throw new ValidationError(passwordValidation.errors.join(". "));
    }

    const breached = await checkPasswordBreach(newPassword);
    if (breached) {
      throw new ValidationError("Password appears in breach corpus. Choose a different password.");
    }

    const config = getConfig();
    if (config.auth.mfaEnabled) {
      securityLogger.log({
        category: "authentication",
        action: "password-update-mfa-required",
        severity: "info",
      });
    }

    this.log("info", "Updating password");

    if (this.isBrowser()) {
      await this.callAuthEndpoint("/password/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword }),
      });
      return;
    }

    return this.executeRequest(
      async () => {
        const { error } = await this.supabase.auth.updateUser({
          password: newPassword,
        });
        if (error) throw new AuthenticationError(sanitizeErrorMessage(error));
      },
      { skipCache: true }
    );
  }

  /**
   * Sign in with OAuth provider (Google, Apple, GitHub)
   */
  async signInWithProvider(provider: "google" | "apple" | "github"): Promise<void> {
    this.log("info", "OAuth sign in initiated", { provider });

    return this.executeRequest(
      async () => {
        const { data: _data, error } = await this.supabase.auth.signInWithOAuth({
          provider,
          options: {
            redirectTo: `${window.location.origin}/auth/callback`,
            queryParams: {
              access_type: "offline",
              prompt: "consent",
            },
          },
        });

        if (error) {
          securityLogger.log({
            category: "authentication",
            action: "oauth-failed",
            severity: "warn",
            metadata: { provider, error: sanitizeErrorMessage(error) },
          });
          throw new AuthenticationError(`OAuth sign in failed: ${sanitizeErrorMessage(error)}`);
        }

        securityLogger.log({
          category: "authentication",
          action: "oauth-initiated",
          metadata: { provider },
        });

        // OAuth redirect happens automatically, no return needed
      },
      { skipCache: true }
    );
  }

  /**
   * Verify if user is authenticated
   */
  async isAuthenticated(): Promise<boolean> {
    const session = await this.getSession();
    return session !== null;
  }

  /**
   * Resend verification email for signup confirmation
   */
  async resendVerificationEmail(email: string): Promise<void> {
    this.log("info", "Resending verification email", { email });

    if (this.isBrowser()) {
      await this.callAuthEndpoint("/verify/resend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      return;
    }

    const { error } = await this.supabase.auth.resend({
      type: "signup",
      email,
      options: {
        emailRedirectTo: `${getConfig().app.url}/auth/callback`,
      },
    });

    if (error) {
      throw new AuthenticationError(sanitizeErrorMessage(error));
    }
  }
}

export const authService = new AuthService();
