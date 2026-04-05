/**
 * Rate Limiter for Authentication Attempts
 * Prevents brute force attacks by limiting authentication attempts.
 *
 * IMPORTANT: Browser-side counters are UX-only hints. They are easy to clear
 * and must never be treated as authoritative security enforcement.
 *
 * Authoritative lockout and retry policy MUST come from backend responses
 * (for example HTTP 429 plus retry metadata).
 */

import { logger } from "@/lib/logger";

interface RateLimitEntry {
  attempts: number;
  firstAttempt: number;
  lastAttempt: number;
  isLocked: boolean;
  lockUntil?: number;
}

/**
 * API contract for backend-provided lockout metadata.
 *
 * This is the authoritative source for lockout messaging/state in UI flows.
 * LocalStorage-based values are only a fallback when backend metadata is absent.
 */
export interface AuthLockoutMetadata {
  locked: boolean;
  retryAfterSeconds?: number;
  remainingAttempts?: number;
}

export class AuthRateLimitError extends Error {
  readonly status?: number;
  readonly lockout: AuthLockoutMetadata;

  constructor(message: string, lockout: AuthLockoutMetadata, status?: number) {
    super(message);
    this.name = "AuthRateLimitError";
    this.lockout = lockout;
    this.status = status;
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const asOptionalNumber = (value: unknown): number | undefined =>
  typeof value === "number" && Number.isFinite(value) ? value : undefined;

const asOptionalBoolean = (value: unknown): boolean | undefined =>
  typeof value === "boolean" ? value : undefined;

/**
 * Extracts lockout metadata from backend error-like objects.
 *
 * Supports either top-level fields or nested `{ lockout: { ... } }`.
 */
export const parseAuthLockoutMetadata = (
  value: unknown,
): AuthLockoutMetadata | undefined => {
  if (!isRecord(value)) {
    return undefined;
  }

  const candidate = isRecord(value.lockout) ? value.lockout : value;
  const locked = asOptionalBoolean(candidate.locked);
  if (typeof locked !== "boolean") {
    return undefined;
  }

  return {
    locked,
    retryAfterSeconds: asOptionalNumber(candidate.retryAfterSeconds),
    remainingAttempts: asOptionalNumber(candidate.remainingAttempts),
  };
};

class AuthRateLimiter {
  private readonly storageKey = "auth_rate_limit";
  private readonly maxAttempts = 5; // Maximum failed attempts
  private readonly lockoutDuration = 15 * 60 * 1000; // 15 minutes
  private readonly windowDuration = 5 * 60 * 1000; // 5 minutes window

  /**
   * Get rate limit data for an identifier (email/IP)
   *
   * NOTE: data is local and mutable by the user; this is not an enforcement source.
   */
  private getRateLimitData(identifier: string): RateLimitEntry {
    try {
      const data = localStorage.getItem(`${this.storageKey}_${identifier}`);
      return data
        ? JSON.parse(data)
        : {
            attempts: 0,
            firstAttempt: Date.now(),
            lastAttempt: Date.now(),
            isLocked: false,
          };
    } catch (error) {
      return {
        attempts: 0,
        firstAttempt: Date.now(),
        lastAttempt: Date.now(),
        isLocked: false,
      };
    }
  }

  /**
   * Save rate limit data for an identifier
   *
   * NOTE: writes to localStorage can fail and are not security guarantees.
   */
  private setRateLimitData(identifier: string, data: RateLimitEntry): void {
    try {
      localStorage.setItem(`${this.storageKey}_${identifier}`, JSON.stringify(data));
    } catch (error) {
      logger.error("Failed to save rate limit data", error);
    }
  }

  /**
   * Check if authentication is allowed for an identifier
   *
   * NOTE: this should only be used for non-authoritative UX guidance.
   */
  canAttemptAuth(identifier: string): {
    allowed: boolean;
    remainingAttempts: number;
    lockoutRemaining?: number;
  } {
    const data = this.getRateLimitData(identifier);
    const now = Date.now();

    // Check if currently locked out
    if (data.isLocked && data.lockUntil && data.lockUntil > now) {
      return {
        allowed: false,
        remainingAttempts: 0,
        lockoutRemaining: Math.ceil((data.lockUntil - now) / 1000 / 60), // minutes
      };
    }

    // Reset if window has expired
    if (now - data.firstAttempt > this.windowDuration) {
      this.setRateLimitData(identifier, {
        attempts: 0,
        firstAttempt: now,
        lastAttempt: now,
        isLocked: false,
      });
      return { allowed: true, remainingAttempts: this.maxAttempts };
    }

    const remainingAttempts = Math.max(0, this.maxAttempts - data.attempts);

    return {
      allowed: remainingAttempts > 0,
      remainingAttempts,
    };
  }

  /**
   * Record a failed authentication attempt
   *
   * NOTE: local tracking is a fallback for messaging only.
   */
  recordFailedAttempt(identifier: string): { isLocked: boolean; lockoutRemaining?: number } {
    const data = this.getRateLimitData(identifier);
    const now = Date.now();

    // Reset if window has expired
    if (now - data.firstAttempt > this.windowDuration) {
      data.attempts = 0;
      data.firstAttempt = now;
    }

    data.attempts += 1;
    data.lastAttempt = now;

    // Check if should lock out
    if (data.attempts >= this.maxAttempts) {
      data.isLocked = true;
      data.lockUntil = now + this.lockoutDuration;
    }

    this.setRateLimitData(identifier, data);

    if (data.isLocked && data.lockUntil) {
      return {
        isLocked: true,
        lockoutRemaining: Math.ceil((data.lockUntil - now) / 1000 / 60),
      };
    }

    return { isLocked: false };
  }

  /**
   * Record a successful authentication attempt (reset counter)
   *
   * NOTE: clearing local data does not override backend lockout state.
   */
  recordSuccessfulAttempt(identifier: string): void {
    try {
      localStorage.removeItem(`${this.storageKey}_${identifier}`);
    } catch (error) {
      logger.error("Failed to clear rate limit data", error);
    }
  }

  /**
   * Get rate limit status for UI display
   *
   * NOTE: do not treat this as security state; backend state is authoritative.
   */
  getRateLimitStatus(identifier: string): {
    attempts: number;
    maxAttempts: number;
    isLocked: boolean;
    lockoutRemaining?: number;
  } {
    const data = this.getRateLimitData(identifier);
    const now = Date.now();

    let lockoutRemaining;
    if (data.isLocked && data.lockUntil && data.lockUntil > now) {
      lockoutRemaining = Math.ceil((data.lockUntil - now) / 1000 / 60);
    }

    return {
      attempts: data.attempts,
      maxAttempts: this.maxAttempts,
      isLocked: data.isLocked && (!data.lockUntil || data.lockUntil > now),
      lockoutRemaining,
    };
  }

  /**
   * Clear all rate limit data (for testing/admin)
   */
  clearAllData(): void {
    try {
      const keys = Object.keys(localStorage);
      keys.forEach((key) => {
        if (key.startsWith(this.storageKey)) {
          localStorage.removeItem(key);
        }
      });
    } catch (error) {
      logger.error("Failed to clear rate limit data", error);
    }
  }
}

// Export singleton instance
export const authRateLimiter = new AuthRateLimiter();
