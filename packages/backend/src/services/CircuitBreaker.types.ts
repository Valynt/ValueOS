/**
 * Circuit Breaker Type Definitions
 */

export interface CircuitBreakerConfig {
  failure_threshold: number;
  success_threshold: number;
  timeout_ms: number;
  reset_timeout_ms: number;
}

export type CircuitBreakerState = 'closed' | 'open' | 'half_open';

export interface CircuitBreakerMetrics {
  total_requests: number;
  successful_requests: number;
  failed_requests: number;
  rejected_requests: number;
  state: CircuitBreakerState;
  last_failure_time?: string;
  last_success_time?: string;
}
