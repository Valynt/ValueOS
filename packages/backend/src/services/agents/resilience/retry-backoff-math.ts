import type { RetryError, RetryOptions } from "./AgentRetryTypes.js";

export function calculateRetryDelay(
  attemptNumber: number,
  options: RetryOptions,
  recentSuccessRate: number
): number {
  let delay: number;

  switch (options.strategy) {
    case "exponential_backoff":
      delay = options.baseDelay * Math.pow(options.backoffMultiplier, attemptNumber - 1);
      break;

    case "linear_backoff":
      delay = options.baseDelay * attemptNumber;
      break;

    case "fixed_delay":
      delay = options.baseDelay;
      break;

    case "adaptive":
      if (recentSuccessRate < 0.5) {
        delay =
          options.baseDelay * Math.pow(options.backoffMultiplier, attemptNumber - 1) * 2;
      } else {
        delay = options.baseDelay * Math.pow(options.backoffMultiplier, attemptNumber - 1);
      }
      break;

    default:
      delay = options.baseDelay * Math.pow(options.backoffMultiplier, attemptNumber - 1);
  }

  if (options.jitterFactor > 0) {
    const jitter = delay * options.jitterFactor * Math.random();
    delay += jitter;
  }

  delay = Math.min(delay, options.maxDelay);

  return Math.floor(delay);
}

export function shouldRetryError(
  error: RetryError,
  options: RetryOptions
): boolean {
  if (options.nonRetryableErrors.includes(error.type)) {
    return false;
  }

  if (options.retryableErrors.includes(error.type)) {
    return true;
  }

  if (error.severity === "critical") {
    return false;
  }

  const retryablePatterns = [
    /timeout/i,
    /network/i,
    /connection/i,
    /temporary/i,
    /rate.?limit/i,
    /too.?many.?requests/i,
    /service.?unavailable/i,
  ];

  return retryablePatterns.some((pattern) => pattern.test(error.message));
}
