/**
 * Client-side rate limiter for authentication attempts.
 *
 * SECURITY NOTE: This is a UX-only safeguard. Because state is stored in
 * localStorage, a determined attacker can bypass it by clearing storage.
 * Brute-force protection MUST be enforced server-side (e.g. via the backend
 * auth middleware). This class exists solely to give honest users early
 * feedback and to reduce accidental repeated submissions.
 */

interface RateLimitEntry {
  attempts: number;
  firstAttempt: number;
  lastAttempt: number;
  isLocked: boolean;
  lockUntil?: number;
}

class AuthRateLimiter {
  private readonly storageKey = "auth_rate_limit";
  private readonly maxAttempts = 5; // Maximum failed attempts
  private readonly lockoutDuration = 15 * 60 * 1000; // 15 minutes
  private readonly windowDuration = 5 * 60 * 1000; // 5 minutes window

  /**
   * Get rate limit data for an identifier (email/IP)
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
   */
  private setRateLimitData(identifier: string, data: RateLimitEntry): void {
    try {
      localStorage.setItem(`${this.storageKey}_${identifier}`, JSON.stringify(data));
    } catch (error) {
      console.error("Failed to save rate limit data");
    }
  }

  /**
   * Check if authentication is allowed for an identifier
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
   */
  recordSuccessfulAttempt(identifier: string): void {
    try {
      localStorage.removeItem(`${this.storageKey}_${identifier}`);
    } catch (error) {
      console.error("Failed to clear rate limit data");
    }
  }

  /**
   * Get rate limit status for UI display
   */
  getRateLimitStatus(identifier: string): {
    attempts: number;
    maxAttempts: number;
    isLocked: boolean;
    lockoutRemaining?: number;
  } {
    const data = this.getRateLimitData(identifier);
    const now = Date.now();

    const isLocked = data.isLocked && (!data.lockUntil || data.lockUntil > now);
    const base = {
      attempts: data.attempts,
      maxAttempts: this.maxAttempts,
      isLocked,
    };

    if (data.isLocked && data.lockUntil && data.lockUntil > now) {
      return { ...base, lockoutRemaining: Math.ceil((data.lockUntil - now) / 1000 / 60) };
    }
    return base;
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
      console.error("Failed to clear rate limit data");
    }
  }
}

// Export singleton instance
export const authRateLimiter = new AuthRateLimiter();
