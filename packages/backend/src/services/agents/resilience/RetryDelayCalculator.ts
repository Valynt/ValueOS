import type { RetryOptions } from "./AgentRetryTypes.js";

export function calculateRetryDelay(
  attemptNumber: number,
  options: RetryOptions,
  getRecentSuccessRate: (options: RetryOptions) => number
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

    case "adaptive": {
      const recentSuccessRate = getRecentSuccessRate(options);
      if (recentSuccessRate < 0.5) {
        delay = options.baseDelay * Math.pow(options.backoffMultiplier, attemptNumber - 1) * 2;
      } else {
        delay = options.baseDelay * Math.pow(options.backoffMultiplier, attemptNumber - 1);
      }
      break;
    }

    default:
      delay = options.baseDelay * Math.pow(options.backoffMultiplier, attemptNumber - 1);
  }

  if (options.jitterFactor > 0) {
    const jitter = delay * options.jitterFactor * Math.random();
    delay += jitter;
  }

  return Math.floor(Math.min(delay, options.maxDelay));
}
