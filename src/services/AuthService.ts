/**
 * Authentication Service
 * Handles session management and authentication operations
 */

import { logger } from "../lib/logger";
import { BaseService } from "./BaseService";
import { AuthenticationError, RateLimitError, ValidationError } from "./errors";
import { Session, User } from "@supabase/supabase-js";
import { sanitizeErrorMessage, validatePassword } from "../utils/security";
import { securityLogger } from "./SecurityLogger";
import { getConfig } from "../config/environment";
import { checkPasswordBreach } from "../security";
import {
  consumeAuthRateLimit,
  RateLimitExceededError,
  resetRateLimit,
} from "../security";
import { clientRateLimit } from "./ClientRateLimit";
import { mfaService } from "./MFAService";

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
  session: Session;
}

export class AuthService extends BaseService {
  constructor() {
    super("AuthService");
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
      throw new ValidationError(
        "Password appears in breach corpus. Choose a different password."
      );
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

    return this.executeRequest(
      async () => {
        const { data: authData, error } = await this.supabase.auth.signUp({
          email: data.email,
          password: data.password,
          options: {
            data: {
              full_name: data.fullName,
            },
          },
        });

        if (error) {
          throw new AuthenticationError(sanitizeErrorMessage(error));
        }
        if (!authData.user || !authData.session) {
          throw new AuthenticationError("Signup failed");
        }

        resetRateLimit("auth", data.email);

        return {
          user: authData.user,
          session: authData.session,
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
      throw new RateLimitError(
        "Too many authentication attempts. Please try again later.",
        900
      );
    }

    this.enforceAuthRateLimit(credentials.email, "login");

    this.log("info", "User login", { email: credentials.email });

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
          throw new AuthenticationError("Invalid credentials");
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
              "MFA_ENROLLMENT_REQUIRED: Your role requires multi-factor authentication. Please complete MFA setup."
            );
          }

          // Verify MFA token
          if (!credentials.otpCode) {
            throw new ValidationError("MFA code required for your role");
          }

          const mfaResult = await mfaService.verifyMFAToken(
            data.user.id,
            credentials.otpCode
          );

          if (!mfaResult.verified) {
            securityLogger.log({
              category: "authentication",
              action: "mfa-verification-failed",
              severity: "warn",
              metadata: { userId: data.user.id },
            });
            throw new AuthenticationError("Invalid MFA code");
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
      throw new ValidationError(
        "Password appears in breach corpus. Choose a different password."
      );
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
  async signInWithProvider(
    provider: "google" | "apple" | "github"
  ): Promise<void> {
    this.log("info", "OAuth sign in initiated", { provider });

    return this.executeRequest(
      async () => {
        const { data: _data, error } = await this.supabase.auth.signInWithOAuth(
          {
            provider,
            options: {
              redirectTo: `${window.location.origin}/auth/callback`,
              queryParams: {
                access_type: "offline",
                prompt: "consent",
              },
            },
          }
        );

        if (error) {
          securityLogger.log({
            category: "authentication",
            action: "oauth-failed",
            severity: "warn",
            metadata: { provider, error: sanitizeErrorMessage(error) },
          });
          throw new AuthenticationError(
            `OAuth sign in failed: ${sanitizeErrorMessage(error)}`
          );
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
}

export const authService = new AuthService();
