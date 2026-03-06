import { randomUUID } from "crypto";
import type { IncomingMessage, ServerResponse } from "http";

import { TRPCError } from "@trpc/server";
import { createClient, type RedisClientType } from "redis";

/**
 * Error handling utilities for tRPC procedures
 */

/**
 * Wrap database operations with error handling
 * Catches errors and throws appropriate TRPCError
 */
export async function safeDbOperation<T>(
  operation: () => Promise<T>,
  errorMessage: string = "Database operation failed"
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    console.error(`[DB Error] ${errorMessage}:`, error);
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: errorMessage,
      cause: error,
    });
  }
}

/**
 * Wrap LLM operations with error handling and retry logic
 */
export async function safeLLMOperation<T>(
  operation: () => Promise<T>,
  options: {
    maxRetries?: number;
    timeout?: number;
    fallback?: T;
  } = {}
): Promise<T> {
  const { maxRetries = 2, timeout = 30000, fallback } = options;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // Create timeout promise
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("LLM operation timeout")), timeout)
      );

      // Race between operation and timeout
      const result = await Promise.race([operation(), timeoutPromise]);
      return result;
    } catch (error) {
      const isLastAttempt = attempt === maxRetries;
      
      if (isLastAttempt) {
        console.error(`[LLM Error] Failed after ${maxRetries + 1} attempts:`, error);
        
        if (fallback !== undefined) {
          console.warn("[LLM] Using fallback value");
          return fallback;
        }
        
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "AI service temporarily unavailable. Please try again.",
          cause: error,
        });
      }

      // Exponential backoff before retry
      const delay = Math.pow(2, attempt) * 1000;
      console.warn(`[LLM] Attempt ${attempt + 1} failed, retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  // TypeScript exhaustiveness check
  throw new Error("Unreachable code");
}

/**
 * Validate required fields and throw appropriate error
 */
export function validateRequired<T>(
  value: T | null | undefined,
  fieldName: string
): T {
  if (value === null || value === undefined) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `${fieldName} is required`,
    });
  }
  return value;
}

/**
 * Validate resource ownership
 */
export function validateOwnership(
  resourceUserId: string,
  currentUserId: string,
  resourceType: string = "resource"
): void {
  if (resourceUserId !== currentUserId) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: `You don't have permission to access this ${resourceType}`,
    });
  }
}

/**
 * Handle not found errors
 */
export function throwNotFound(resourceType: string): never {
  throw new TRPCError({
    code: "NOT_FOUND",
    message: `${resourceType} not found`,
  });
}

/**
 * Wrap async operations with generic error handling
 */
export async function safeAsync<T>(
  operation: () => Promise<T>,
  errorMessage: string = "Operation failed"
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    // If it's already a TRPCError, rethrow it
    if (error instanceof TRPCError) {
      throw error;
    }

    // Otherwise, wrap in a generic error
    console.error(`[Error] ${errorMessage}:`, error);
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: errorMessage,
      cause: error,
    });
  }
}

type RateLimitResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
  retryAfterSeconds?: number;
};

type RateLimitIdentifiers = {
  userId?: string | null;
  tenantId?: string | null;
  ip?: string | null;
};

type RateLimitIdentityUser = {
  id?: string | null;
  tenantId?: string | null;
};

let redisClient: RedisClientType | null = null;
let redisConnectPromise: Promise<RedisClientType | null> | null = null;

// Sliding-window rate limiter (Redis sorted-set + Lua for atomicity)
const RATE_LIMIT_SCRIPT = `
  local key = KEYS[1]
  local now = tonumber(ARGV[1])
  local window = tonumber(ARGV[2])
  local limit = tonumber(ARGV[3])
  local member = ARGV[4]

  redis.call('ZREMRANGEBYSCORE', key, 0, now - window)
  local count = redis.call('ZCARD', key)
  local allowed = 0

  if count < limit then
    redis.call('ZADD', key, now, member)
    count = count + 1
    allowed = 1
  end

  redis.call('PEXPIRE', key, window)
  local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
  local oldestScore = 0
  if oldest and #oldest >= 2 then
    oldestScore = tonumber(oldest[2])
  end

  return { allowed, count, oldestScore }
`;

const DEFAULT_REDIS_URL = "redis://localhost:6379";

async function getRedisClient(): Promise<RedisClientType | null> {
  if (redisClient?.isReady) {
    return redisClient;
  }

  if (!redisConnectPromise) {
    const client = createClient({
      url: process.env.REDIS_URL || DEFAULT_REDIS_URL,
    });

    client.on("error", (error) => {
      console.error("[RateLimit] Redis error:", error);
    });

    redisConnectPromise = client.connect()
      .then(() => {
        redisClient = client;
        return client;
      })
      .catch((error) => {
        console.error("[RateLimit] Redis connection failed:", error);
        redisClient = null;
        redisConnectPromise = null;
        return null;
      });
  }

  return redisConnectPromise;
}

export function getRateLimitIdentifiers(req: IncomingMessage, user?: { id?: string | null; tenantId?: string | null } | null): RateLimitIdentifiers {
  const forwardedFor = req.headers["x-forwarded-for"];
  const ip = Array.isArray(forwardedFor)
    ? forwardedFor[0]
    : typeof forwardedFor === "string"
    ? forwardedFor.split(",")[0]?.trim()
    : req.socket.remoteAddress;

  const tenantFromHeaders = req.headers["x-tenant-id"] || req.headers["x-organization-id"];
  const tenantId = Array.isArray(tenantFromHeaders)
    ? tenantFromHeaders[0]
    : typeof tenantFromHeaders === "string"
      ? tenantFromHeaders.trim()
      : null;

  return {
    userId: user?.id ?? null,
    tenantId: user?.tenantId ?? tenantId,
    ip: ip ?? null,
  };
}

export function buildRateLimitKey(prefix: string, identifiers: RateLimitIdentifiers): string {
  const userId = identifiers.userId || "anonymous";
  const tenantId = identifiers.tenantId || "unknown";
  const ip = identifiers.ip || "unknown";

  return `${prefix}:user:${userId}:tenant:${tenantId}:ip:${ip}`;
}

export function applyRateLimitHeaders(res: ServerResponse | undefined, result: RateLimitResult): void {
  if (!res || res.headersSent) {
    return;
  }

  res.setHeader("X-RateLimit-Limit", result.limit.toString());
  res.setHeader("X-RateLimit-Remaining", result.remaining.toString());
  res.setHeader("X-RateLimit-Reset", Math.ceil(result.resetAt / 1000).toString());

  if (!result.allowed && result.retryAfterSeconds !== undefined) {
    res.setHeader("Retry-After", result.retryAfterSeconds.toString());
  }
}

export async function checkRateLimit(
  key: string,
  maxRequests: number = 10,
  windowMs: number = 60000
): Promise<RateLimitResult> {
  const now = Date.now();
  const redis = await getRedisClient();

  if (!redis) {
    console.warn("[RateLimit] Redis unavailable, allowing request.");
    return {
      allowed: true,
      limit: maxRequests,
      remaining: maxRequests,
      resetAt: now + windowMs,
    };
  }

  const member = `${now}:${randomUUID()}`;
  const result = await redis.eval(RATE_LIMIT_SCRIPT, {
    keys: [key],
    arguments: [now.toString(), windowMs.toString(), maxRequests.toString(), member],
  });

  const [allowedRaw, countRaw, oldestRaw] = result as [number, number, number];
  const allowed = allowedRaw === 1;
  const count = Number(countRaw) || 0;
  const oldest = Number(oldestRaw) || 0;
  const resetAt = oldest > 0 ? oldest + windowMs : now + windowMs;
  const remaining = Math.max(maxRequests - count, 0);
  const retryAfterSeconds = !allowed ? Math.max(Math.ceil((resetAt - now) / 1000), 1) : undefined;

  return {
    allowed,
    limit: maxRequests,
    remaining,
    resetAt,
    retryAfterSeconds,
  };
}

export function throwRateLimitExceeded(): never {
  throw new TRPCError({
    code: "TOO_MANY_REQUESTS",
    message: "Rate limit exceeded. Please try again later.",
  });
}

export type { RateLimitIdentityUser, RateLimitIdentifiers, RateLimitResult };
