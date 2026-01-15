import { TRPCError } from "@trpc/server";

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

/**
 * Rate limiting helper (simple in-memory implementation)
 * For production, use Redis or similar
 */
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(
  key: string,
  maxRequests: number = 10,
  windowMs: number = 60000
): void {
  const now = Date.now();
  const record = rateLimitMap.get(key);

  if (!record || now > record.resetAt) {
    // Create new window
    rateLimitMap.set(key, {
      count: 1,
      resetAt: now + windowMs,
    });
    return;
  }

  if (record.count >= maxRequests) {
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: "Rate limit exceeded. Please try again later.",
    });
  }

  record.count++;
}

/**
 * Clean up old rate limit entries periodically
 */
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of rateLimitMap.entries()) {
    if (now > record.resetAt) {
      rateLimitMap.delete(key);
    }
  }
}, 60000); // Clean up every minute
