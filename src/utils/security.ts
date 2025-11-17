export interface PasswordPolicy {
  minLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumbers: boolean;
  requireSymbols: boolean;
}

export const defaultPasswordPolicy: PasswordPolicy = {
  minLength: 12,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSymbols: true,
};

export interface PasswordValidationResult {
  valid: boolean;
  errors: string[];
}

export function validatePassword(
  password: string,
  policy: PasswordPolicy = defaultPasswordPolicy
): PasswordValidationResult {
  const errors: string[] = [];

  if (!password || password.length < policy.minLength) {
    errors.push(`Password must be at least ${policy.minLength} characters`);
  }
  if (policy.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push('Password must include at least one uppercase letter');
  }
  if (policy.requireLowercase && !/[a-z]/.test(password)) {
    errors.push('Password must include at least one lowercase letter');
  }
  if (policy.requireNumbers && !/\d/.test(password)) {
    errors.push('Password must include at least one number');
  }
  if (policy.requireSymbols && !/[^A-Za-z0-9]/.test(password)) {
    errors.push('Password must include at least one symbol');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function sanitizeErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return 'Request failed. Please try again or contact support.';
  }
  return 'An unexpected error occurred.';
}

interface RateLimiterOptions {
  maxAttempts: number;
  windowMs: number;
  lockoutMs: number;
}

export class RateLimiter {
  private attempts: Map<string, { count: number; firstAttempt: number; lockedUntil?: number }> = new Map();
  private options: RateLimiterOptions;

  constructor(options: RateLimiterOptions) {
    this.options = options;
  }

  canAttempt(key: string): { allowed: boolean; retryAfter?: number } {
    const entry = this.attempts.get(key);
    if (!entry) return { allowed: true };

    const now = Date.now();
    if (entry.lockedUntil && entry.lockedUntil > now) {
      return { allowed: false, retryAfter: entry.lockedUntil - now };
    }

    if (now - entry.firstAttempt > this.options.windowMs) {
      this.attempts.delete(key);
      return { allowed: true };
    }

    if (entry.count >= this.options.maxAttempts) {
      const lockedUntil = now + this.options.lockoutMs;
      this.attempts.set(key, { ...entry, lockedUntil });
      return { allowed: false, retryAfter: this.options.lockoutMs };
    }

    return { allowed: true };
  }

  recordFailure(key: string): void {
    const now = Date.now();
    const entry = this.attempts.get(key);
    if (!entry) {
      this.attempts.set(key, { count: 1, firstAttempt: now });
      return;
    }

    if (now - entry.firstAttempt > this.options.windowMs) {
      this.attempts.set(key, { count: 1, firstAttempt: now });
      return;
    }

    this.attempts.set(key, { ...entry, count: entry.count + 1 });
  }

  reset(key: string): void {
    this.attempts.delete(key);
  }
}

export function sanitizeLLMContent(content: string): string {
  if (!content) return '';
  const withoutScripts = content.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  return withoutScripts
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
