/**
 * Backend Security Utilities
 */

import crypto from 'crypto';

import { securityEvents as _securityEvents } from './securityLogger.js'

// Re-export from other modules
export { fetchWithCSRF } from './CSRFProtection.js'
export { sanitizeInput, sanitizeObject, sanitizeString } from './InputSanitizer.js'
export { _securityEvents as securityEvents };

export class RateLimitExceededError extends Error {
  constructor(public retryAfter: number) {
    super('Rate limit exceeded');
    this.name = 'RateLimitExceededError';
  }
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  retryAfter?: number;
}

// Pluggable rate limiter provider interface
export interface RateLimiterProvider {
  consume(identifier: string): Promise<RateLimitResult> | RateLimitResult;
  reset(identifier: string): Promise<void> | void;
}

// Default in-memory implementation (single-instance only)
const inMemoryAuthRateLimits = new Map<string, { count: number; resetTime: number }>();

const DEFAULT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const DEFAULT_MAX_ATTEMPTS = 5;

const defaultRateLimiter: RateLimiterProvider = {
  consume(identifier: string) {
    const now = Date.now();
    const windowMs = Number(process.env.AUTH_RATE_LIMIT_WINDOW_MS) || DEFAULT_WINDOW_MS;
    const maxAttempts = Number(process.env.AUTH_RATE_LIMIT_MAX) || DEFAULT_MAX_ATTEMPTS;

    const key = `auth:${identifier}`;
    const record = inMemoryAuthRateLimits.get(key);

    if (!record || now > record.resetTime) {
      inMemoryAuthRateLimits.set(key, { count: 1, resetTime: now + windowMs });
      return { allowed: true, remaining: maxAttempts - 1, resetTime: now + windowMs };
    }

    if (record.count >= maxAttempts) {
      const retryAfter = Math.ceil((record.resetTime - now) / 1000);
      // Emit audit event
      throw new RateLimitExceededError(retryAfter);
    }

    record.count++;
    const res: RateLimitResult = { allowed: true, remaining: maxAttempts - record.count, resetTime: record.resetTime };
    return res;
  },
  reset(identifier: string) {
    const key = `auth:${identifier}`;
    inMemoryAuthRateLimits.delete(key);
  }
};

let activeRateLimiter: RateLimiterProvider = defaultRateLimiter;

export function setAuthRateLimiter(provider: RateLimiterProvider) {
  activeRateLimiter = provider || defaultRateLimiter;
}

export function consumeAuthRateLimit(identifier: string): Promise<RateLimitResult> | RateLimitResult {
  return activeRateLimiter.consume(identifier);
}

export function resetRateLimit(identifier: string): Promise<void> | void {
  return activeRateLimiter.reset(identifier);
}

export type PasswordBreachStatus = 'breached' | 'not_breached' | 'unknown';

export interface PasswordBreachResult {
  status: PasswordBreachStatus;
  count?: number; // number of times seen (if available)
  reason?: string; // when status === 'unknown'
}

// HIBP client helpers: cache, circuit breaker, rate limit
const hibpCache = new Map<string, { text: string; fetchedAt: number }>();
const HIBP_CACHE_TTL_MS = Number(process.env.HIBP_CACHE_TTL_MS) || 24 * 60 * 60 * 1000; // 24h

let hibpFailureCount = 0;
let hibpCircuitOpenedUntil = 0;
const HIBP_CIRCUIT_THRESHOLD = Number(process.env.HIBP_CIRCUIT_THRESHOLD) || 5;
const HIBP_CIRCUIT_COOLDOWN_MS = Number(process.env.HIBP_CIRCUIT_COOLDOWN_MS) || 5 * 60 * 1000;

function isHibpCircuitOpen(): boolean {
  return Date.now() < hibpCircuitOpenedUntil;
}

function recordHibpFailure() {
  hibpFailureCount++;
  if (hibpFailureCount >= HIBP_CIRCUIT_THRESHOLD) {
    hibpCircuitOpenedUntil = Date.now() + HIBP_CIRCUIT_COOLDOWN_MS;
  }
}

function resetHibpFailures() {
  hibpFailureCount = 0;
}

async function fetchHibpRange(prefix: string, timeoutMs: number, attempts = 3): Promise<string> {
  // Check cache
  const cached = hibpCache.get(prefix);
  if (cached && Date.now() - cached.fetchedAt < HIBP_CACHE_TTL_MS) return cached.text;

  if (isHibpCircuitOpen()) throw new Error('HIBP circuit open');

  const url = `https://api.pwnedpasswords.com/range/${prefix}`;
  const headers: Record<string, string> = {
    Accept: 'text/plain',
    'User-Agent': process.env.HIBP_USER_AGENT || 'valueos-backend/1.0'
  };

  let attempt = 0;
  let lastErr: unknown = null;
  while (attempt < attempts) {
    attempt++;
    const controller = new AbortController();
    const to = setTimeout(() => controller.abort(), timeoutMs);
    try {
       
      const res = await fetch(url, { headers, signal: controller.signal });
      clearTimeout(to);
      if (!res.ok) throw new Error(`HIBP returned ${res.status}`);
      const text = await res.text();
      hibpCache.set(prefix, { text, fetchedAt: Date.now() });
      resetHibpFailures();
      return text;
    } catch (err: unknown) {
      clearTimeout(to);
      lastErr = err;
      recordHibpFailure();
      // Exponential backoff with jitter
      const backoff = Math.min(1000 * Math.pow(2, attempt), 5000);
      await new Promise((r) => setTimeout(r, backoff + Math.floor(Math.random() * 200)));
    }
  }

  throw lastErr || new Error('HIBP fetch failed');
}

export async function checkPasswordBreach(password: string): Promise<PasswordBreachResult> {
  const enabled = process.env.HIBP_ENABLED !== 'false';
  const timeoutMs = Number(process.env.HIBP_TIMEOUT_MS) || 2000;

  if (!enabled) {
    return { status: 'unknown', reason: 'hibp_disabled' };
  }

  // Hash without logging the raw password
  const hash = crypto.createHash('sha1').update(password).digest('hex').toUpperCase();
  const prefix = hash.substring(0, 5);
  const suffix = hash.substring(5);

  try {
    const text = await fetchHibpRange(prefix, timeoutMs);
    const lines = text.split('\n');
    for (const line of lines) {
      const [hashSuffix, countStr] = line.split(':');
      if (!hashSuffix) continue;
      if (hashSuffix === suffix) {
        const count = Number((countStr || '').trim()) || undefined;
        return { status: 'breached', count };
      }
    }
    return { status: 'not_breached' };
  } catch (err: unknown) {
    // Fail-closed: return unknown and emit telemetry — caller should treat unknown conservatively
    return { status: 'unknown', reason: String(err?.message || err) };
  }
}