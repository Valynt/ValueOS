/**
 * Authentication Service
 * Handles session management and authentication operations
 */

import { logger } from '../lib/logger';
import { BaseService } from './BaseService';
import { AuthenticationError, RateLimitError, ValidationError } from './errors';
import { User, Session } from '@supabase/supabase-js';
import { RateLimiter, sanitizeErrorMessage, validatePassword } from '../utils/security';
import { securityLogger } from './SecurityLogger';

const loginRateLimiter = new RateLimiter({
  maxAttempts: 5,
  windowMs: 5 * 60 * 1000,
  lockoutMs: 15 * 60 * 1000,
});

const signupRateLimiter = new RateLimiter({
  maxAttempts: 3,
  windowMs: 10 * 60 * 1000,
  lockoutMs: 30 * 60 * 1000,
});

const resetRateLimiter = new RateLimiter({
  maxAttempts: 5,
  windowMs: 60 * 60 * 1000,
  lockoutMs: 2 * 60 * 60 * 1000,
});

export interface LoginCredentials {
  email: string;
  password: string;
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
    super('AuthService');
  }

  /**
   * Sign up a new user
  */
  async signup(data: SignupData): Promise<AuthSession> {
    this.validateRequired(data, ['email', 'password', 'fullName']);

    const passwordValidation = validatePassword(data.password);
    if (!passwordValidation.valid) {
      throw new ValidationError(passwordValidation.errors.join('. '));
    }

    const rateStatus = signupRateLimiter.canAttempt(data.email);
    if (!rateStatus.allowed) {
      securityLogger.log({
        category: 'authentication',
        action: 'signup-rate-limit',
        severity: 'warn',
        metadata: { email: data.email, retryAfter: rateStatus.retryAfter },
      });
      throw new RateLimitError('Too many signup attempts. Please try again later.', rateStatus.retryAfter);
    }

    this.log('info', 'User signup', { email: data.email });

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
          signupRateLimiter.recordFailure(data.email);
          throw new AuthenticationError(sanitizeErrorMessage(error));
        }
        if (!authData.user || !authData.session) {
          throw new AuthenticationError('Signup failed');
        }

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
   */
  async login(credentials: LoginCredentials): Promise<AuthSession> {
    this.validateRequired(credentials, ['email', 'password']);

    const rateStatus = loginRateLimiter.canAttempt(credentials.email);
    if (!rateStatus.allowed) {
      securityLogger.log({
        category: 'authentication',
        action: 'login-rate-limit',
        severity: 'warn',
        metadata: { email: credentials.email, retryAfter: rateStatus.retryAfter },
      });
      throw new RateLimitError('Too many login attempts. Please try again later.', rateStatus.retryAfter);
    }

    this.log('info', 'User login', { email: credentials.email });

    return this.executeRequest(
      async () => {
        const { data, error } = await this.supabase.auth.signInWithPassword({
          email: credentials.email,
          password: credentials.password,
        });

        if (error) {
          loginRateLimiter.recordFailure(credentials.email);
          securityLogger.log({
            category: 'authentication',
            action: 'login-failed',
            severity: 'warn',
            metadata: { email: credentials.email },
          });
          throw new AuthenticationError('Invalid credentials');
        }
        if (!data.user || !data.session) {
          loginRateLimiter.recordFailure(credentials.email);
          securityLogger.log({
            category: 'authentication',
            action: 'login-failed',
            severity: 'warn',
            metadata: { email: credentials.email, reason: 'missing-session' },
          });
          throw new AuthenticationError('Invalid credentials');
        }

        loginRateLimiter.reset(credentials.email);
        securityLogger.log({
          category: 'authentication',
          action: 'login-success',
          metadata: { email: credentials.email },
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
    this.log('info', 'User logout');

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
      { deduplicationKey: 'current-session' }
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
      { deduplicationKey: 'current-user' }
    );
  }

  /**
   * Refresh session
   */
  async refreshSession(): Promise<AuthSession> {
    this.log('info', 'Refreshing session');

    return this.executeRequest(
      async () => {
        const { data, error } = await this.supabase.auth.refreshSession();
        if (error) throw new AuthenticationError(sanitizeErrorMessage(error));
        if (!data.user || !data.session) {
          throw new AuthenticationError('Session refresh failed');
        }

        this.clearCache('current-session');
        this.clearCache('current-user');

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
    const rateStatus = resetRateLimiter.canAttempt(email);
    if (!rateStatus.allowed) {
      securityLogger.log({
        category: 'authentication',
        action: 'password-reset-rate-limit',
        severity: 'warn',
        metadata: { email, retryAfter: rateStatus.retryAfter },
      });
      throw new RateLimitError('Too many reset attempts. Please try again later.', rateStatus.retryAfter);
    }

    this.log('info', 'Password reset requested', { email });

    return this.executeRequest(
      async () => {
        const { error } = await this.supabase.auth.resetPasswordForEmail(email);
        if (error) {
          resetRateLimiter.recordFailure(email);
          throw new AuthenticationError(sanitizeErrorMessage(error));
        }
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
      throw new ValidationError(passwordValidation.errors.join('. '));
    }

    this.log('info', 'Updating password');

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
   * Verify if user is authenticated
   */
  async isAuthenticated(): Promise<boolean> {
    const session = await this.getSession();
    return session !== null;
  }
}

export const authService = new AuthService();
