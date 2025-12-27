/**
 * Exponential Backoff Utility
 */

import { RateLimitError } from "./errors";

export interface RetryOptions {
  maxRetries?: number;
  initialDelayMs?: number;
  multiplier?: number;
  shouldRetry?: (error: unknown) => boolean;
}

/**
 * Executes a task with exponential backoff retry logic.
 * Formula: delay = initialDelayMs * Math.pow(multiplier, attempt)
 *
 * @param task The async function to retry
 * @param options Retry options
 * @returns Result of the task
 */
export async function withRetry<T>(
  task: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const { maxRetries = 3, initialDelayMs = 100, multiplier = 2 } = options;

  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await task();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Stop retrying if we reached max retries
      if (attempt === maxRetries) {
        break;
      }

      // Check if error is retryable
      // Only retry RateLimitError or likely network errors (fetch definition of network error is usually TypeError)
      const isRetryable = options.shouldRetry
        ? options.shouldRetry(error)
        : error instanceof RateLimitError ||
          (error instanceof Error && error.name === "TypeError") || // fetch network error
          (error instanceof Error && error.message.includes("network"));

      if (!isRetryable) {
        break;
      }

      const delay = initialDelayMs * Math.pow(multiplier, attempt);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}
