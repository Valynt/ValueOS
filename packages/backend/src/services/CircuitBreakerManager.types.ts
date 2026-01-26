/**
 * Circuit Breaker Manager Type Definitions
 */

export interface CircuitBreakerRegistry {
  [key: string]: any;
}

export interface CircuitBreakerManagerConfig {
  default_threshold: number;
  default_timeout_ms: number;
  enable_metrics: boolean;
}
