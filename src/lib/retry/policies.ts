export interface RetryPolicy {
  name?: string;
  max_attempts: number;
  initial_delay_ms: number;
  max_delay_ms: number;
  multiplier: number;
  jitter: boolean;
  max_elapsed_ms?: number;
  non_retryable_errors?: string[];
}

export type RetryPolicyInput = RetryPolicy | string | undefined;

export const RETRY_POLICIES: Record<string, RetryPolicy> = {
  conservative: {
    name: 'conservative',
    max_attempts: 2,
    initial_delay_ms: 250,
    max_delay_ms: 2_000,
    multiplier: 1.5,
    jitter: true,
    max_elapsed_ms: 5_000
  },
  standard: {
    name: 'standard',
    max_attempts: 3,
    initial_delay_ms: 500,
    max_delay_ms: 5_000,
    multiplier: 2,
    jitter: true,
    max_elapsed_ms: 12_000
  },
  aggressive: {
    name: 'aggressive',
    max_attempts: 5,
    initial_delay_ms: 200,
    max_delay_ms: 8_000,
    multiplier: 2,
    jitter: true,
    max_elapsed_ms: 15_000
  }
};

const DEFAULT_POLICY: RetryPolicy = RETRY_POLICIES.standard;

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function parseRetryPolicy(policy?: RetryPolicyInput): RetryPolicy {
  if (!policy) {
    return { ...DEFAULT_POLICY };
  }

  if (typeof policy === 'string') {
    return { ...RETRY_POLICIES[policy] ?? DEFAULT_POLICY };
  }

  const base = policy.name ? (RETRY_POLICIES[policy.name] ?? DEFAULT_POLICY) : DEFAULT_POLICY;

  return {
    ...base,
    ...policy,
    max_attempts: clampNumber(policy.max_attempts ?? base.max_attempts, 1, 10),
    initial_delay_ms: clampNumber(policy.initial_delay_ms ?? base.initial_delay_ms, 50, base.max_delay_ms ?? 60_000),
    max_delay_ms: clampNumber(policy.max_delay_ms ?? base.max_delay_ms, base.initial_delay_ms, 60_000),
    multiplier: clampNumber(policy.multiplier ?? base.multiplier, 1, 10),
    jitter: policy.jitter ?? base.jitter,
    max_elapsed_ms: policy.max_elapsed_ms ?? base.max_elapsed_ms,
    non_retryable_errors: policy.non_retryable_errors ?? base.non_retryable_errors
  };
}
