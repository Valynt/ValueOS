import { RetryPolicy } from './policies';

const JITTER_FACTOR = 0.2;

export function calculateBackoffDelay(
  attempt: number,
  policy: RetryPolicy,
  startTimeMs: number,
  nowProvider: () => number = () => Date.now()
): number | null {
  const cappedAttempt = Math.max(attempt, 1);
  const exponential = policy.initial_delay_ms * Math.pow(policy.multiplier, cappedAttempt - 1);
  const clamped = Math.min(exponential, policy.max_delay_ms);

  const jitterAmount = policy.jitter ? clamped * JITTER_FACTOR : 0;
  const jitter = policy.jitter ? (Math.random() * 2 - 1) * jitterAmount : 0;
  const delay = Math.max(0, Math.round(clamped + jitter));

  if (!policy.max_elapsed_ms) {
    return delay;
  }

  const projectedElapsed = nowProvider() - startTimeMs + delay;
  if (projectedElapsed > policy.max_elapsed_ms) {
    return null;
  }

  return delay;
}

export function isRetryableError(error: unknown, policy: RetryPolicy): boolean {
  if (error && typeof error === 'object') {
    const name = (error as Error).name;
    const retryableFlag = (error as any).retryable;
    if (retryableFlag === false) return false;
    if (policy.non_retryable_errors?.includes(name)) return false;
  }
  return true;
}

export const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
